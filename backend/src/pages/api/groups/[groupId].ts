import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireInGroupOrAdmin } from '@/lib/auth';
import { Group, User } from '@/models';
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

        const group = (await Group.findById(
            groupId
        ).lean()) as Record<string, unknown> | null;

        if (!group) {
            return responseErrorEntryNotFound(res, 'Group');
        }

        // GroupSchema.members stores plain user id strings (no mongoose ref),
        // so the member docs are resolved manually. Blocked and soft-deleted
        // users are excluded; the stored order is preserved.
        const memberIds = (group.members as string[]) ?? [];
        const memberDocs = memberIds.length
            ? await User.find({
                  _id: { $in: memberIds },
                  blocked: { $ne: true },
                  deleted: { $ne: true },
              })
                  .select('name email role registered avatar')
                  .lean()
            : [];
        const byId = new Map(
            memberDocs.map((m) => [String(m._id), m as Record<string, unknown>])
        );
        const members = memberIds
            .map((id) => byId.get(String(id)))
            .filter((m) => m !== undefined);

        res.status(200).json({
            success: true,
            data: { group: { ...group, members } },
        });
    } catch (error) {
        console.error('Get group error:', error);
        return responseErrorGet(res);
    }
}

export default requireInGroupOrAdmin(handler);
