import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { authenticateToken, AuthRequest } from '@/lib/auth';
import { User } from '@/models';
import { toPublicUser } from '@/lib/sanitize';
import {
    responseErrorEntryNotFound,
    responseErrorGet,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorPut,
} from '@/lib/response-error-generator';
import { runValidation, validateRequestBody } from '@/lib/validation';
import { UpdateProfileRequestSchema } from 'shared/src/schemas/api';
import { validatePassword } from '@/lib/password';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method === 'PUT') {
        if (
            !(await runValidation(
                validateRequestBody(UpdateProfileRequestSchema),
                req,
                res
            ))
        )
            return;

        try {
            await dbConnect();
            const { autoTimetable, currentPassword, password } = req.body;

            // Self-service password change: requires the current password and
            // passes the full policy validation.
            if (password !== undefined) {
                if (!currentPassword) {
                    return responseErrorIncorrectParameter(res, 'password', [
                        'CurrentPasswordRequired',
                    ]);
                }

                const userDoc = await User.findById(req.user?.userId);
                if (!userDoc) {
                    return responseErrorEntryNotFound(res, 'User');
                }

                const currentOk = await userDoc.comparePassword(
                    String(currentPassword)
                );
                if (!currentOk) {
                    return responseErrorIncorrectParameter(res, 'currentPassword', [
                        'InvalidCurrentPassword',
                    ]);
                }

                const errors = validatePassword(
                    String(password),
                    userDoc.email,
                    userDoc.name
                );
                if (errors.length > 0) {
                    return responseErrorIncorrectParameter(res, 'password', errors);
                }

                userDoc.password = password;
                userDoc.updatedAt = new Date();
                await userDoc.save();
            }

            const update: Record<string, unknown> = { updatedAt: new Date() };
            if (autoTimetable !== undefined) update.autoTimetable = autoTimetable;

            const userDoc = await User.findByIdAndUpdate(
                req.user?.userId,
                update,
                { new: true }
            )
                .populate('groups', 'name description')
                .lean();

            if (!userDoc) {
                return responseErrorEntryNotFound(res, 'User');
            }

            res.status(200).json({
                success: true,
                data: {
                    user: toPublicUser(userDoc as unknown as Record<string, unknown>),
                },
            });
        } catch (error) {
            console.error('Update profile error:', error);
            return responseErrorPut(res);
        }
        return;
    }

    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        await dbConnect();
        const userDoc = await User.findById(req.user?.userId)
            .populate('groups', 'name description')
            .lean();

        if (!userDoc) {
            return responseErrorEntryNotFound(res, 'User');
        }

        res.status(200).json({
            success: true,
            data: {
                user: toPublicUser(userDoc as unknown as Record<string, unknown>),
            },
        });
    } catch (error) {
        console.error('Get profile error:', error);
        return responseErrorGet(res);
    }
}

export default authenticateToken(handler);