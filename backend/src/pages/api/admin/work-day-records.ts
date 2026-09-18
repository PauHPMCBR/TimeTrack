import { withApi } from '@/lib/api-handler';
import { User } from '@/models';
import { AdminWorkDayRecordUpdateRequestSchema } from 'shared/src/schemas/api';
import { isMonthApproved } from '@/lib/monthly-approvals';
import { recomputeWorkDayRecords } from '@/lib/work-day-records';
import { dateKey } from '@/lib/date-key';
import {
    responseErrorEntryNotFound,
    responseErrorIllegalAction,
    responseErrorPut,
    } from '@/lib/response-error-generator';

export default withApi(
    {
        method: 'PUT',
        guard: 'admin',
        body: AdminWorkDayRecordUpdateRequestSchema,
        audit: {
            action: 'work_day_record_updated',
            targetType: 'work_day_record',
            targetId: (_req, ctx) =>
                `${(ctx.body as { userId: string }).userId}:${(ctx.body as { date: string }).date}`,
            metadata: (_req, ctx) => {
                const body = ctx.body as {
                    classification: string;
                    date: string;
                };
                return { classification: body.classification, date: body.date };
            },
        },
    },
    async (req, res, { body }) => {
        try {
            const { userId, date, classification } = body;

            const user = await User.findById(userId);
            if (!user || user.deleted) {
                return responseErrorEntryNotFound(res, 'User');
            }

            if (date > dateKey(new Date())) {
                return responseErrorIllegalAction(res, 'FutureDate');
            }

            if (
                await isMonthApproved(
                    userId,
                    Number(date.slice(0, 4)),
                    Number(date.slice(5, 7))
                )
            ) {
                return responseErrorIllegalAction(res, 'MonthApprovedLocked');
            }

            await recomputeWorkDayRecords(userId, [date], {
                actorId: req.user!.userId,
                reason: body.reason,
                overrides: {
                    classification,
                    checkMode: body.checkMode,
                    timetableIntervals: body.timetableIntervals,
                    expectedHours: body.expectedHours,
                },
            });

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Admin work day record update error:', error);
            return responseErrorPut(res);
        }
    }
);
