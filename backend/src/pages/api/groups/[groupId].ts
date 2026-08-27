import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireInGroupOrAdmin } from '@/lib/auth';
import { Group } from '@/models';
import {
    responseErrorEntryNotFound,
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { runValidation, validateQueryParams } from '@/lib/validation';
import { GroupIdParamSchema } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(
            validateQueryParams(GroupIdParamSchema),
            req,
            res
        ))
    )
        return;

    try {
        await dbConnect();
        const groupId = req.query.groupId as string;

        const group = await Group.findById(groupId)
            .populate('members', 'name email role registered')
            .lean();

        if (!group) {
            return responseErrorEntryNotFound(res, 'Group');
        }

        res.status(200).json({ success: true, data: { group: group } });
    } catch (error) {
        console.error('Get group error:', error);
        return responseErrorGet(res);
    }
}

export default requireInGroupOrAdmin(handler);
