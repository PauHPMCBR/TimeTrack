import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { Group, User } from '@/models';
import {
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { runValidation, validateRequestBody } from '@/lib/validation';
import { CreateGroupRequestSchema } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(
            validateRequestBody(CreateGroupRequestSchema),
            req,
            res
        ))
    )
        return;

    try {
        await dbConnect();
        const { name, description, members } = req.body;

        const group = await Group.create({
            name,
            description,
            members: members || [],
        });

        if (members && members.length > 0) {
            await User.updateMany(
                { _id: { $in: members }, deleted: { $ne: true } },
                { $addToSet: { groups: group._id } }
            );
        }

        res.status(201).json({ success: true, data: { group: group } });
    } catch (error) {
        console.error('Create group error:', error);
        return responseErrorPost(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
