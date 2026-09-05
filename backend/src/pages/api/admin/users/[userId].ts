import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { User, Group } from '@/models';
import { getFrontendUrl } from '@/lib/frontend-url';
import { toPublicUser } from '@/lib/sanitize';
import {
    responseErrorEntryNotFound,
    responseErrorGet,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorPut,
    responseErrorDelete,
} from '@/lib/response-error-generator';
import {
    runValidation,
    validateQueryParams,
    validateRequestBody,
} from '@/lib/validation';
import {
    UpdateUserRequestSchema,
    UserIdParamSchema,
} from 'shared/src/schemas/api';
import crypto from 'crypto';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        if (
            !(await runValidation(
                validateQueryParams(UserIdParamSchema),
                req,
                res
            ))
        )
            return;

        try {
            await dbConnect();
            const userId = req.query.userId as string;

            const user = await User.findById(userId);
            if (!user || user.deleted) {
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
        return;
    }

    // Soft delete: data stays in the DB, the user is just hidden and locked out.
    if (req.method === 'DELETE') {
        if (
            !(await runValidation(
                validateQueryParams(UserIdParamSchema),
                req,
                res
            ))
        )
            return;

        try {
            await dbConnect();
            const userId = req.query.userId as string;

            const user = await User.findById(userId);
            if (!user || user.deleted) {
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
        return;
    }

    if (req.method !== 'PUT') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(validateQueryParams(UserIdParamSchema), req, res))
    )
        return;

    if (
        !(await runValidation(
            validateRequestBody(UpdateUserRequestSchema),
            req,
            res
        ))
    )
        return;

    try {
        await dbConnect();
        const userId = req.query.userId as string;
        const { name, email, role, dni, expectedWorkHours, workDays } =
            req.body;

        const user = await User.findById(userId);
        if (!user) {
            return responseErrorEntryNotFound(res, 'User');
        }

        if (
            email !== undefined &&
            email.toLowerCase() !== user.email.toLowerCase()
        ) {
            // Email is unique per non-deleted user.
            const existingEmail = await User.findOne({
                email: email.toLowerCase(),
                _id: { $ne: user._id },
                deleted: { $ne: true },
            });
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
        if ('checkInRequired' in req.body && req.body.checkInRequired !== undefined)
            user.checkInRequired = req.body.checkInRequired;
        // trackingStartDate accepts "YYYY-MM-DD" (local day, stored as local
        // midnight). The field is non-nullable, so only a valid date is allowed.
        if ('trackingStartDate' in req.body && req.body.trackingStartDate !== undefined) {
            const d = new Date(`${req.body.trackingStartDate}T00:00:00`);
            if (isNaN(d.getTime())) {
                return responseErrorIncorrectParameter(res, 'trackingStartDate', [
                    'InvalidTimestamp',
                ]);
            }
            user.trackingStartDate = d;
        }
        if (req.body.invalidatePassword) {
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

export default requireRole([ADMIN_ROLE], handler);
