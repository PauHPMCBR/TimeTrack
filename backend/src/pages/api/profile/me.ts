import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { authenticateToken, AuthRequest } from '@/lib/auth';
import { User } from '@/models';
import {
    responseErrorEntryNotFound,
    responseErrorGet,
    responseErrorMethodNotAllowed,
    responseErrorPut,
} from '@/lib/response-error-generator';
import { runValidation, validateRequestBody } from '@/lib/validation';
import { UpdateProfileRequestSchema } from 'shared/src/schemas/api';

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
            const { autoTimetable } = req.body;

            const update: Record<string, unknown> = { updatedAt: new Date() };
            if (autoTimetable !== undefined) update.autoTimetable = autoTimetable;

            const user = await User.findByIdAndUpdate(
                req.user?.userId,
                update,
                { new: true }
            )
                .select('-password -registrationToken -resetPasswordToken -resetPasswordExpires')
                .populate('groups', 'name description')
                .lean();

            if (!user) {
                return responseErrorEntryNotFound(res, 'User');
            }

            res.status(200).json({ success: true, data: { user } });
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
        const user = await User.findById(req.user?.userId)
            .select('-password -registrationToken -resetPasswordToken -resetPasswordExpires')
            .populate('groups', 'name description')
            .lean();

        if (!user) {
            return responseErrorEntryNotFound(res, 'User');
        }

        res.status(200).json({ success: true, data: { user: user } });
    } catch (error) {
        console.error('Get profile error:', error);
        return responseErrorGet(res);
    }
}

export default authenticateToken(handler);