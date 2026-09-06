import { withApi } from '@/lib/api-handler';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { User, Group } from '@/models';
import { findActiveByEmail, findActiveById } from '@/repositories/user-repository';
import { getFrontendUrl } from '@/lib/frontend-url';
import { toPublicUser } from '@/lib/sanitize';
import {
    responseErrorEntryNotFound,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorGet,
    responseErrorDelete,
    responseErrorPut,
} from '@/lib/response-error-generator';
import {
    UpdateUserRequestSchema,
    UserIdParamSchema,
} from 'shared/src/schemas/api';
import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

const getHandler = withApi(
    { method: 'GET', guard: 'admin', query: UserIdParamSchema },
    async (_req, res, { query }) => {
        try {
            const user = await findActiveById(query.userId);
            if (!user) {
                return responseErrorEntryNotFound(res, 'User');
            }

            let registrationLink: string | null = null;
            if (!user.registered && user.registrationToken) {
                const frontendUrl = getFrontendUrl();
                const inviteParams = new URLSearchParams({
                    name: user.name,
                    email: user.email,
                });
                registrationLink = `${frontendUrl}/register/${user.registrationToken}?${inviteParams.toString()}`;
            }

            res.status(200).json({
                success: true,
                data: { registrationLink },
            });
        } catch (error) {
            console.error('Get user registration link error:', error);
            return responseErrorGet(res);
        }
    }
);

// Soft delete: data stays in the DB, the user is just hidden and locked out.
const deleteHandler = withApi(
    { method: 'DELETE', guard: 'admin', query: UserIdParamSchema },
    async (req, res, { query }) => {
        try {
            const userId = query.userId;

            const user = await findActiveById(userId);
            if (!user) {
                return responseErrorEntryNotFound(res, 'User');
            }
            if (user.role === ADMIN_ROLE) {
                return responseErrorIncorrectParameter(res, 'userId', [
                    'CannotDeleteAdmin',
                ]);
            }
            if (req.user?.userId === userId) {
                return responseErrorIncorrectParameter(res, 'userId', [
                    'CannotDeleteSelf',
                ]);
            }

            // updateOne (not save()) skips full-document validation.
            await User.updateOne(
                { _id: user._id },
                {
                    $set: {
                        deleted: true,
                        deletedAt: new Date(),
                        updatedAt: new Date(),
                    },
                }
            );

            // The user's own groups array is kept so a restore can re-add them.
            await Group.updateMany(
                { members: user._id },
                { $pull: { members: user._id } }
            );

            res.status(200).json({
                success: true,
                data: { deleted: true },
            });
        } catch (error) {
            console.error('Delete user error:', error);
            return responseErrorDelete(res);
        }
    }
);

const putHandler = withApi(
    {
        method: 'PUT',
        guard: 'admin',
        query: UserIdParamSchema,
        body: UpdateUserRequestSchema,
    },
    async (req, res, { query, body }) => {
        try {
            const userId = query.userId;
            const { name, email, role, dni, expectedWorkHours, workDays } =
                body;

            // NOTE: unlike GET/DELETE, PUT intentionally does not reject
            // deleted users here (pre-existing behavior).
            const user = await User.findById(userId);
            if (!user) {
                return responseErrorEntryNotFound(res, 'User');
            }

            if (
                email !== undefined &&
                email.toLowerCase() !== user.email.toLowerCase()
            ) {
                // Email is unique per non-deleted user.
                const existingEmail = await findActiveByEmail(
                    email.toLowerCase(),
                    { excludeId: user._id }
                );
                if (existingEmail) {
                    return responseErrorIncorrectParameter(res, 'email', [
                        'AlreadyExists',
                    ]);
                }
            }

            if (name !== undefined) user.name = name;
            if (email !== undefined) user.email = email.toLowerCase();
            if (role !== undefined) {
                // Admins cannot be demoted (prevents lockouts and a stale-token
                // admin gaining/losing privileges mid-session).
                if (user.role === ADMIN_ROLE && role !== ADMIN_ROLE) {
                    return responseErrorIncorrectParameter(res, 'role', [
                        'CannotDemoteAdmin',
                    ]);
                }
                user.role = role;
            }
            if (dni !== undefined) user.dni = dni;
            if (expectedWorkHours !== undefined)
                user.expectedWorkHours = expectedWorkHours;
            if (workDays !== undefined) user.workDays = workDays;
            if ('checkInRequired' in body && body.checkInRequired !== undefined)
                user.checkInRequired = body.checkInRequired;
            // trackingStartDate accepts "YYYY-MM-DD" (local day, stored as local
            // midnight). The field is non-nullable, so only a valid date is allowed.
            if (
                'trackingStartDate' in body &&
                body.trackingStartDate !== undefined
            ) {
                const d = new Date(`${body.trackingStartDate}T00:00:00`);
                if (isNaN(d.getTime())) {
                    return responseErrorIncorrectParameter(
                        res,
                        'trackingStartDate',
                        ['InvalidTimestamp']
                    );
                }
                user.trackingStartDate = d;
            }
            if (body.invalidatePassword) {
                // Forces forgot-password recovery; admins never set known passwords.
                const randomPw = '!' + crypto.randomBytes(32).toString('hex') + 'A1';
                user.password = randomPw;
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;
            }
            user.updatedAt = new Date();
            await user.save();

            res.status(200).json({
                success: true,
                data: {
                    user: toPublicUser(user),
                },
            });
        } catch (error) {
            console.error('Update user error:', error);
            return responseErrorPut(res);
        }
    }
);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') return getHandler(req, res);
    if (req.method === 'DELETE') return deleteHandler(req, res);
    if (req.method === 'PUT') return putHandler(req, res);
    return responseErrorMethodNotAllowed(res);
}
