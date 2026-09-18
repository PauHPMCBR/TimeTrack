import { withApi } from '@/lib/api-handler';
import { AuthorizedLeave, User } from '@/models';
import { AuthorizedLeaveRow } from '@/lib/rows';
import {
    AdminAuthorizedLeaveRequestSchema,
    AdminAuthorizedLeavesQuerySchema,
} from 'shared/src/schemas/api';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
    responseErrorEntryNotFound,
    responseErrorGet,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { recomputeWorkDayRecordsForRange } from '@/lib/work-day-records';

const getHandler = withApi(
    {
        method: 'GET',
        guard: 'admin',
        query: AdminAuthorizedLeavesQuerySchema,
    },
    async (req, res) => {
        try {
            const query = req.query as unknown as {
                userId?: string;
                from?: string;
                to?: string;
            };
            const leaves = (await AuthorizedLeave.find({
                ...(query.userId ? { userId: query.userId } : {}),
                ...(query.to ? { startDate: { $lte: query.to } } : {}),
                ...(query.from ? { endDate: { $gte: query.from } } : {}),
            })
                .sort({ startDate: -1 })
                .lean()) as unknown as AuthorizedLeaveRow[];

            res.status(200).json({ success: true, data: { leaves } });
        } catch (error) {
            console.error('List authorized leaves error:', error);
            return responseErrorGet(res);
        }
    }
);

const postHandler = withApi(
    {
        method: 'POST',
        guard: 'admin',
        body: AdminAuthorizedLeaveRequestSchema,
        audit: {
            action: 'authorized_leave_changed',
            targetType: 'authorized_leave',
            targetId: (_req, ctx) =>
                `${(ctx.body as { userId: string }).userId}:${(ctx.body as { startDate: string }).startDate}`,
            metadata: (_req, ctx) => {
                const body = ctx.body as {
                    startDate: string;
                    endDate: string;
                };
                return { startDate: body.startDate, endDate: body.endDate };
            },
        },
    },
    async (req, res, { body }) => {
        try {
            const { userId, startDate, endDate, notes } = body;

            const user = await User.findById(userId);
            if (!user || user.deleted) {
                return responseErrorEntryNotFound(res, 'User');
            }

            const created = (await AuthorizedLeave.create({
                userId,
                startDate,
                endDate,
                notes: notes ?? '',
                createdBy: req.user!.userId,
            })) as unknown as AuthorizedLeaveRow;

            await recomputeWorkDayRecordsForRange(userId, startDate, endDate);

            res.status(200).json({
                success: true,
                data: { leave: { ...created, _id: created._id.toString() } },
            });
        } catch (error) {
            console.error('Create authorized leave error:', error);
            return responseErrorPost(res);
        }
    }
);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') return getHandler(req, res);
    if (req.method === 'POST') return postHandler(req, res);
    return responseErrorMethodNotAllowed(res);
}
