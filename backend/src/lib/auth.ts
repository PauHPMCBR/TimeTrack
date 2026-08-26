import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { User, Group } from '@/models';
import { responseError } from './response-error-generator';

export interface AuthRequest extends NextApiRequest {
  user?: {
    userId: string;
    email: string;
    role: 'employee' | 'admin' | 'manager';
  };
}

type Handler = (req: AuthRequest, res: NextApiResponse) => unknown;

export const getJwtSecret = (): string | null => process.env.JWT_SECRET ?? null;

export const authenticateToken = (handler: Handler) => {
  return async (req: AuthRequest, res: NextApiResponse) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return responseError(res, 401, 'TokenRequired');
    }

    const JWT_SECRET = getJwtSecret();
    if (!JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set');
      return responseError(res, 500, 'InternalError');
    }

    try {
      const user = jwt.verify(token, JWT_SECRET) as AuthRequest['user'];
      req.user = user;
      return handler(req, res);
    } catch {
      return responseError(res, 403, 'InvalidToken');
    }
  };
};

export const requireRole = (roles: string[], handler: Handler) => {
  return authenticateToken(async (req: AuthRequest, res: NextApiResponse) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return responseError(res, 403, 'InsufficientPermissions');
    }
    return handler(req, res);
  });
};

export const requireSameGroupOrAdmin = (handler: Handler) => {
  return authenticateToken(async (req: AuthRequest, res: NextApiResponse) => {
    try {
      if (req.user?.role === 'admin') {
        return handler(req, res);
      }

      const targetUserId = req.query.userId as string;

      // Fast path: users can always view their own data — no DB round-trips.
      if (targetUserId && targetUserId === req.user?.userId) {
        return handler(req, res);
      }

      if (!targetUserId) {
        return responseError(res, 403, 'NoAccessToUser');
      }

      await dbConnect();

      const [currentUser, targetUser] = await Promise.all([
        User.findById(req.user?.userId),
        User.findById(targetUserId),
      ]);

      if (!currentUser || !targetUser) {
        return responseError(res, 404, 'UserNotFound');
      }

      const currentUserGroups = (currentUser.groups ?? []).map((g: Types.ObjectId) => g.toString());
      const targetUserGroups = new Set(
        (targetUser.groups ?? []).map((g: Types.ObjectId) => g.toString())
      );
      const sharedGroups = currentUserGroups.filter((groupId: string) => targetUserGroups.has(groupId));

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
      if (req.user?.role === 'admin') {
        return handler(req, res);
      }

      const groupId = req.query.groupId as string;

      if (!req.user?.userId || !groupId) {
        return responseError(res, 403, 'NoAccessToGroup');
      }

      await dbConnect();

      const group = await Group.findById(groupId);
      if (!group) {
        return responseError(res, 404, 'GroupNotFound');
      }

      const isMember = (group.members ?? []).some((memberId: Types.ObjectId) =>
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
