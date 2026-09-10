import { withApi } from '@/lib/api-handler';
import { User } from '@/models';
import { toPublicUser } from '@/lib/sanitize';
import {
    responseErrorEntryNotFound,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorPut,
} from '@/lib/response-error-generator';
import { UpdateProfileRequestSchema } from 'shared/src/schemas/api';
import { validatePassword } from '@/lib/password';
import type { NextApiRequest, NextApiResponse } from 'next';

const getHandler = withApi({ method: 'GET' }, async (req, res) => {
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
});

const putHandler = withApi(
    { method: 'PUT', body: UpdateProfileRequestSchema },
    async (req, res, { body }) => {
        try {
            const { autoTimetable, currentPassword, password, notifyNewFile, notifyInconsistency } =
                body;

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
                    return responseErrorIncorrectParameter(
                        res,
                        'currentPassword',
                        ['InvalidCurrentPassword']
                    );
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
            if (notifyNewFile !== undefined)
                update.notifyNewFile = notifyNewFile;
            if (notifyInconsistency !== undefined)
                update.notifyInconsistency = notifyInconsistency;

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
    }
);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') return getHandler(req, res);
    if (req.method === 'PUT') return putHandler(req, res);
    return responseErrorMethodNotAllowed(res);
}
