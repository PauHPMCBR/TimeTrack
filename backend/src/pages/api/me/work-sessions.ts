import { withApi } from '@/lib/api-handler';
import { z } from 'zod';
import {
    responseErrorIllegalAction,
    responseErrorIncorrectParameter,
    responseErrorPut,
} from '@/lib/response-error-generator';
import { replaceDaySessions } from '@/lib/replace-day';
import {
    AdminWorkSessionInputSchema,
} from 'shared/src/schemas/api';
import {
    DATE_KEY_REGEX,
    SOURCE_USER_MANUAL,
} from 'shared/src/lib/constants';
import { dateKey } from '@/lib/date-key';

const ReplaceMyDayWorkSessionsRequestSchema = z.object({
    date: z.string().regex(DATE_KEY_REGEX, 'date must be YYYY-MM-DD'),
    sessions: z.array(AdminWorkSessionInputSchema),
    // Audit note: why the day is being corrected (stored on the new version).
    reason: z.string().max(500).optional(),
});

// Worker self-edit of one of their own past days: same replacement semantics
// as the admin day correction (mandatory reason note, ordering/coherence
// validation, versioned, blocked on approved months) but attributed to the
// worker themself with source 'userManual'. Future days are refused — live
// punches and the auto-timetable remain the only ways to produce future data.
export default withApi(
    {
        method: 'PUT',
        guard: 'auth',
        body: ReplaceMyDayWorkSessionsRequestSchema,
        audit: {
            action: 'work_sessions_replaced',
            targetType: 'work_session_day',
            targetId: (req, ctx) =>
                `${req.user!.userId}:${(ctx.body as { date: string }).date}`,
            metadata: (req, ctx) => ({
                count: (ctx.body as { sessions: unknown[] }).sessions.length,
                source: 'userManual',
            }),
        },
    },
    async (req, res, { body }) => {
        try {
            const userId = req.user!.userId;

            if (body.date > dateKey(new Date())) {
                return responseErrorIllegalAction(res, 'FutureDate');
            }

            const result = await replaceDaySessions({
                userId,
                date: body.date,
                sessions: body.sessions,
                reason: body.reason,
                source: SOURCE_USER_MANUAL,
                editedBy: userId,
            });
            if (!result.ok) {
                if (result.code === 'MonthApprovedLocked') {
                    return responseErrorIllegalAction(
                        res,
                        'MonthApprovedLocked'
                    );
                }
                if (result.code === 'InvalidDate') {
                    return responseErrorIncorrectParameter(res, 'date', [
                        'InvalidTimestamp',
                    ]);
                }
                if (result.code === 'OutOfDay') {
                    return responseErrorIncorrectParameter(res, 'timestamp', [
                        'OutOfDay',
                    ]);
                }
                return responseErrorIncorrectParameter(res, result.field, [
                    'NotInOrder',
                ]);
            }

            res.status(200).json({
                success: true,
                data: { workSessions: result.workSessions },
            });
        } catch (error) {
            console.error('Worker replace day work sessions error:', error);
            return responseErrorPut(res);
        }
    }
);
