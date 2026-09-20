import { withApi } from '@/lib/api-handler';
import { AuthorizedLeave, User } from '@/models';
import { AuthorizedLeaveRow } from '@/lib/rows';
import { AdminAuthorizedLeaveUpdateRequestSchema } from 'shared/src/schemas/api';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
    responseErrorEntryNotFound,
    responseErrorIllegalAction,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { recomputeWorkDayRecordsForRange } from '@/lib/work-day-records';

const findLeave = (leaveId: string) =>
    AuthorizedLeave.findById(leaveId).lean<AuthorizedLeaveRow | null>();

const putHandler = withApi(
    {
        method: 'PUT',
        guard: 'admin',
        body: AdminAuthorizedLeaveUpdateRequestSchema,
        audit: {
            action: 'authorized_leave_changed',
            targetType: 'authorized_leave',
            targetId: (req) => req.query.leaveId as string,
            metadata: (_req, ctx) => {
                const body = ctx.body as {
                    startDate?: string;
                    endDate?: string;
                };
                return {
                    ...(body.startDate ? { startDate: body.startDate } : {}),
                    ...(body.endDate ? { endDate: body.endDate } : {}),
                };
            },
        },
    },
    async (req, res, { body }) => {
        try {
            const leaveId = req.query.leaveId as string;
            const leave = await findLeave(leaveId);
            if (!leave) {
                return responseErrorEntryNotFound(res, 'AuthorizedLeave');
            }

            const startDate = body.startDate ?? leave.startDate;
            const endDate = body.endDate ?? leave.endDate;
            if (endDate < startDate) {
                return responseErrorIllegalAction(res, 'InvalidInterval');
            }

            const user = await User.findById(leave.userId);
            if (!user || user.deleted) {
                return responseErrorEntryNotFound(res, 'User');
            }

            await AuthorizedLeave.updateOne(
                { _id: leaveId },
                {
                    $set: {
                        ...(body.startDate ? { startDate } : {}),
                        ...(body.endDate ? { endDate } : {}),
                        ...(body.notes !== undefined
                            ? { notes: body.notes }
                            : {}),
                        updatedAt: new Date(),
                    },
                }
            );

            await recomputeWorkDayRecordsForRange(
                leave.userId,
                startDate < leave.startDate ? startDate : leave.startDate,
                endDate > leave.endDate ? endDate : leave.endDate
            );

            const updated = await findLeave(leaveId);

            res.status(200).json({ success: true, data: { leave: updated } });
        } catch (error) {
            console.error('Update authorized leave error:', error);
            return responseErrorPost(res);
        }
    }
);

const deleteHandler = withApi(
    {
        method: 'DELETE',
        guard: 'admin',
        audit: {
            action: 'authorized_leave_changed',
            targetType: 'authorized_leave',
            targetId: (req) => req.query.leaveId as string,
            metadata: () => ({ deleted: true }),
        },
    },
    async (req, res) => {
        try {
            const leaveId = req.query.leaveId as string;
            const leave = await findLeave(leaveId);
            if (!leave) {
                return responseErrorEntryNotFound(res, 'AuthorizedLeave');
            }

            await AuthorizedLeave.deleteOne({ _id: leaveId });

            await recomputeWorkDayRecordsForRange(
                leave.userId,
                leave.startDate,
                leave.endDate
            );

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Delete authorized leave error:', error);
            return responseErrorPost(res);
        }
    }
);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'PUT') return putHandler(req, res);
    if (req.method === 'DELETE') return deleteHandler(req, res);
    return responseErrorMethodNotAllowed(res);
}
