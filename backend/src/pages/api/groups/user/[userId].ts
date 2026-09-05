import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireSelfOrAdmin } from '@/lib/auth';
import { Group } from '@/models';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { runValidation, validateQueryParams } from '@/lib/validation';
import { UserIdParamSchema } from 'shared/src/schemas/api';

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

        const groups = await Group.find({
            members: userId,
        })
            .sort({ name: 1 })
            .lean();

        res.status(200).json({ success: true, data: { groups: groups } });
    } catch (error) {
        console.error('Get group error:', error);
        return responseErrorGet(res);
    }
}

export default requireSelfOrAdmin(handler);
