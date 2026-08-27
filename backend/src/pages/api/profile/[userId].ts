import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireSameGroupOrAdmin, AuthRequest } from '@/lib/auth';
import { User } from '@/models';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
    responseErrorEntryNotFound,
} from '@/lib/response-error-generator';
import { UserIdParamSchema } from 'shared/src/schemas/api';
import { runValidation, validateQueryParams } from '@/lib/validation';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(validateQueryParams(UserIdParamSchema), req, res))
    )
        return;

    try {
        await dbConnect();
        const userId = req.query.userId as string;
        const user = await User.findById(userId)
            .select('-password -registrationToken')
            .populate('groups', 'name description')
            .lean();

        if (!user) {
            return responseErrorEntryNotFound(res, 'User');
        }

        res.status(200).json({ success: true, data: { user: user } });
    } catch (error) {
        console.error('Get user profile error:', error);
        return responseErrorGet(res);
    }
}

export default requireSameGroupOrAdmin(handler);
