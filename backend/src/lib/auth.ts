import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { User, Group } from '@/models';
import { responseError } from './response-error-generator';
import {
    ADMIN_ROLE,
    MS_PER_DAY,
    REFRESH_TOKEN_HEADER,
} from 'shared/src/lib/constants';
import type { UserRole } from 'shared/src/schemas/database';

export { REFRESH_TOKEN_HEADER };

// The JWT is stored in an httpOnly cookie (not localStorage) so it is not
// readable from XSS-injected script. The cookie is SameSite=Lax because
// frontend (:3000) and backend (:3001) are same-site (same host, different
// port), which keeps it working over plain http in dev while staying protected
// against CSRF on cross-site requests.
export const AUTH_COOKIE_NAME = 'auth_token';

export const AUTH_COOKIE_MAX_AGE_MS = 30 * MS_PER_DAY;

// Set the JWT as an httpOnly cookie. `persist` controls whether it is a
// session cookie (cleared when the browser closes) or a persistent one (30d).
export function setAuthCookie(
    res: NextApiResponse,
    token: string,
    persist: boolean,
    options: { secure?: boolean } = {}
): void {
    const secure = options.secure ?? process.env.NODE_ENV === 'production';
    const parts = [
        `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
        'HttpOnly',
        'SameSite=Lax',
        'Path=/',
    ];
    if (persist) {
        parts.push(`Max-Age=${Math.floor(AUTH_COOKIE_MAX_AGE_MS / 1000)}`);
    }
    if (secure) {
        parts.push('Secure');
    }
    // Append so auth flows can also set other headers on the same response.
    const existing = res.getHeader('Set-Cookie');
    const setCookies = existing
        ? Array.isArray(existing)
            ? existing
            : [String(existing)]
        : [];
    res.setHeader('Set-Cookie', [...setCookies, parts.join('; ')]);
}

export function clearAuthCookie(res: NextApiResponse): void {
    const existing = res.getHeader('Set-Cookie');
    const setCookies = existing
        ? Array.isArray(existing)
            ? existing
            : [String(existing)]
        : [];
    res.setHeader('Set-Cookie', [
        ...setCookies,
        `${AUTH_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    ]);
}

// Read the JWT from the Authorization header (legacy) or the httpOnly cookie.
export function extractToken(
    req: NextApiRequest
): { token: string; persist: boolean } | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return { token: authHeader.split(' ')[1], persist: false };
    }
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        for (const part of cookieHeader.split(';')) {
            const [name, ...rest] = part.trim().split('=');
            if (name === AUTH_COOKIE_NAME && rest.length > 0) {
                const value = rest.join('=');
                try {
                    return { token: decodeURIComponent(value), persist: true };
                } catch {
                    return { token: value, persist: true };
                }
            }
        }
    }
    return null;
}

// Whether the request was made over TLS (drives the Secure cookie attribute).
export function isHttpsRequest(req: NextApiRequest): boolean {
    const proto = req.headers['x-forwarded-proto'];
    if (Array.isArray(proto)) return proto[0] === 'https';
    if (typeof proto === 'string') return proto === 'https';
    return process.env.NODE_ENV === 'production';
}

// Minimal shape of the live User document used by the auth guards.
export interface AuthUserDoc {
    _id?: { toString(): string };
    role: UserRole;
    deleted?: boolean;
    groups?: Types.ObjectId[];
    // Present on the full document fetched by authenticateToken.
    workDays?: number[];
}

export interface AuthRequest extends NextApiRequest {
    user?: {
        userId: string;
        email: string;
        role: UserRole | 'manager';
    };
    // Live DB user fetched by authenticateToken; guards reuse it to avoid
    // a second identical query.
    dbUser?: AuthUserDoc | null;
}

type Handler = (req: AuthRequest, res: NextApiResponse) => unknown;

// Reuses the authenticateToken fetch when available, else reads from the DB.
const getLiveUser = async (req: AuthRequest): Promise<AuthUserDoc | null> => {
    if (req.dbUser !== undefined) return req.dbUser;
    await dbConnect();
    return req.user?.userId
        ? ((await User.findById(req.user.userId)) as AuthUserDoc | null)
        : null;
};

export const getJwtSecret = (): string | null => process.env.JWT_SECRET ?? null;

// Rolling session: tokens are valid 96h, and get re-issued (extended by another
// 96h) whenever an authenticated request arrives with less than REFRESH_AFTER_MS
// left. Active users therefore never get logged out; idle sessions die ~96h
// after their last action. The new token is returned in the X-Auth-Token header.
// An absolute cap forces a re-login after ABSOLUTE_MAX_MS even with activity.
const TOKEN_TTL = '96h';
const REFRESH_AFTER_MS = MS_PER_DAY;
const ABSOLUTE_MAX_MS = 30 * MS_PER_DAY;

export const signToken = (
    user: AuthRequest['user'],
    options?: { sessionStart?: number }
): string => {
    const JWT_SECRET = getJwtSecret();
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not set');
    }
    // `sessionStart` anchors the 30-day cap to the first login; it is carried
    // across refreshes while `iat`/`exp` keep reflecting each issue, so a
    // refreshed token stays valid 96h from *now*, not from the original login.
    return jwt.sign(
        {
            userId: user!.userId,
            email: user!.email,
            role: user!.role,
            sessionStart:
                options?.sessionStart ?? Math.floor(Date.now() / 1000),
        },
        JWT_SECRET,
        { expiresIn: TOKEN_TTL }
    );
};

export const authenticateToken = (handler: Handler) => {
    return async (req: AuthRequest, res: NextApiResponse) => {
        const extracted = extractToken(req);
        const token = extracted?.token ?? null;
        const persist = extracted?.persist ?? false;

        if (!token) {
            return responseError(res, 401, 'TokenRequired');
        }

        const JWT_SECRET = getJwtSecret();
        if (!JWT_SECRET) {
            console.error('JWT_SECRET environment variable is not set');
            return responseError(res, 500, 'InternalError');
        }

        try {
            const user = jwt.verify(
                token,
                JWT_SECRET
            ) as AuthRequest['user'] & {
                exp?: number;
                iat?: number;
                sessionStart?: number;
            };
            req.user = user;

            // Deleted users must not pass with a still-valid token; the
            // fetched doc is cached on the request for the guards below.
            if (user?.userId) {
                await dbConnect();
                const liveUser = (await User.findById(
                    user.userId
                )) as AuthUserDoc | null;
                req.dbUser = liveUser;
                if (!liveUser || liveUser.deleted) {
                    return responseError(res, 403, 'InvalidToken');
                }
            } else {
                return responseError(res, 403, 'InvalidToken');
            }

            // Absolute cap: force a re-login after ABSOLUTE_MAX_MS even with activity.
            const sessionStart = user?.sessionStart ?? user?.iat;
            if (
                sessionStart &&
                Date.now() - sessionStart * 1000 > ABSOLUTE_MAX_MS
            ) {
                return responseError(res, 403, 'InvalidToken');
            }

            if (
                user?.userId &&
                user.exp &&
                user.exp * 1000 - Date.now() < REFRESH_AFTER_MS
            ) {
                const refreshed = signToken(user, { sessionStart });
                res.setHeader(REFRESH_TOKEN_HEADER, refreshed);
                if (persist) {
                    setAuthCookie(res, refreshed, true, {
                        secure: isHttpsRequest(req),
                    });
                }
            }

            return handler(req, res);
        } catch {
            return responseError(res, 403, 'InvalidToken');
        }
    };
};

export const requireRole = (roles: string[], handler: Handler) => {
    return authenticateToken(async (req: AuthRequest, res: NextApiResponse) => {
        try {
            // Live role from the DB: the JWT role can be stale.
            const currentUser = await getLiveUser(req);
            if (!currentUser || currentUser.deleted) {
                return responseError(res, 403, 'InsufficientPermissions');
            }
            if (!roles.includes(currentUser.role)) {
                return responseError(res, 403, 'InsufficientPermissions');
            }
            req.user!.role = currentUser.role;
            return handler(req, res);
        } catch {
            return responseError(res, 500, 'PermissionVerificationError');
        }
    });
};

export const requireSameGroupOrAdmin = (handler: Handler) => {
    return authenticateToken(async (req: AuthRequest, res: NextApiResponse) => {
        try {
            const targetUserId = req.query.userId as string;

            // Fast path: users can always view their own data — no DB round-trips.
            if (targetUserId && targetUserId === req.user?.userId) {
                return handler(req, res);
            }

            if (!targetUserId || !req.user?.userId) {
                return responseError(res, 403, 'NoAccessToUser');
            }

            await dbConnect();

            const [currentUser, targetUser] = await Promise.all([
                getLiveUser(req),
                User.findById(targetUserId),
            ]);

            // A deleted target is treated as not found.
            if (
                !currentUser ||
                currentUser.deleted ||
                !targetUser ||
                targetUser.deleted
            ) {
                return responseError(res, 404, 'UserNotFound');
            }

            // Admin check against the live role, not the possibly-stale JWT role.
            if (currentUser.role === ADMIN_ROLE) {
                req.user!.role = currentUser.role;
                return handler(req, res);
            }

            const currentUserGroups = (currentUser.groups ?? []).map(
                (g: Types.ObjectId) => g.toString()
            );
            const targetUserGroups = new Set(
                (targetUser.groups ?? []).map((g: Types.ObjectId) =>
                    g.toString()
                )
            );
            const sharedGroups = currentUserGroups.filter((groupId: string) =>
                targetUserGroups.has(groupId)
            );

            if (sharedGroups.length === 0) {
                return responseError(res, 403, 'NoAccessToUser');
            }

            return handler(req, res);
        } catch {
            return responseError(res, 500, 'PermissionVerificationError');
        }
    });
};

export const requireInGroupOrAdmin = (handler: Handler) => {
    return authenticateToken(async (req: AuthRequest, res: NextApiResponse) => {
        try {
            const groupId = req.query.groupId as string;

            if (!req.user?.userId || !groupId) {
                return responseError(res, 403, 'NoAccessToGroup');
            }

            await dbConnect();

            // Live admin check: a demoted admin must not keep group-wide access.
            const currentUser = await getLiveUser(req);
            if (!currentUser || currentUser.deleted) {
                return responseError(res, 404, 'UserNotFound');
            }
            if (currentUser.role === ADMIN_ROLE) {
                req.user!.role = currentUser.role;
                return handler(req, res);
            }

            const group = await Group.findById(groupId);
            if (!group) {
                return responseError(res, 404, 'GroupNotFound');
            }

            const isMember = (group.members ?? []).some(
                (memberId: Types.ObjectId) =>
                    memberId.toString() === req.user!.userId
            );
            if (!isMember) {
                return responseError(res, 403, 'NoAccessToGroup');
            }

            return handler(req, res);
        } catch {
            return responseError(res, 500, 'PermissionVerificationError');
        }
    });
};
