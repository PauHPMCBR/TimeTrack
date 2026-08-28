import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { authenticateToken, AuthRequest } from '@/lib/auth';
import { User, WorkSession } from '@/models';
import {
    responseErrorEntryNotFound,
    responseErrorIllegalAction,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { runValidation, validateRequestBody } from '@/lib/validation';
import { ApplyAutoScheduleRequestSchema } from 'shared/src/schemas/api';
import { computeDayHours } from 'shared/src/lib/work-hours';
import { withUserLock } from '@/lib/user-lock';
import { dateKey } from '@/lib/date-key';
import { dayRange, dayTimestamp } from '@/lib/date-range';
import {
    getAutoTimetable,
    AutoScheduleEntry,
} from '@/lib/auto-schedule';
import {
    CHECK_IN,
    CHECK_OUT,
    SOURCE_AUTOMATIC,
} from 'shared/src/lib/constants';

interface AutoScheduleUser {
    autoTimetable?: AutoScheduleEntry[];
}

// Fills a day's timestamps with the user's configured automatic timetable
// (one check-in/check-out per interval), replacing any existing sessions for
// that day. Sessions get source "automatic" so manual edits are never
// overwritten by the reminder again.
async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(
            validateRequestBody(ApplyAutoScheduleRequestSchema),
            req,
            res
        ))
    )
        return;

    try {
        await dbConnect();
        const requestedDate =
            typeof req.body?.date === 'string'
                ? req.body.date
                : dateKey(new Date());

        if (requestedDate > dateKey(new Date())) {
            return responseErrorIllegalAction(res, 'FutureDate');
        }

        const user = (await User.findById(
            req.user?.userId
        ).lean()) as unknown as AutoScheduleUser | null;
        if (!user) {
            return responseErrorEntryNotFound(res, 'User');
        }

        const timetable = getAutoTimetable(user);
        const { start, end } = dayRange(requestedDate);

        const result = await withUserLock(req.user!.userId, async () => {
            await WorkSession.deleteMany({
                userId: req.user!.userId,
                timestamp: { $gte: start, $lt: end },
            });

            const sessions = timetable.flatMap((entry) => [
                new WorkSession({
                    userId: req.user!.userId,
                    type: CHECK_IN,
                    timestamp: dayTimestamp(requestedDate, entry.checkIn),
                    source: SOURCE_AUTOMATIC,
                }),
                new WorkSession({
                    userId: req.user!.userId,
                    type: CHECK_OUT,
                    timestamp: dayTimestamp(requestedDate, entry.checkOut),
                    source: SOURCE_AUTOMATIC,
                }),
            ]);

            await Promise.all(sessions.map((s) => s.save()));

            return {
                workSessions: sessions,
                totalHours: computeDayHours(sessions).totalHours,
                anomalies: computeDayHours(sessions).anomalies,
            };
        });

        res.status(200).json({
            success: true,
            data: {
                workSessions: result.workSessions,
                totalHours: result.totalHours,
                anomalies: result.anomalies,
            },
        });
    } catch (error) {
        console.error('Apply auto schedule error:', error);
        return responseErrorPost(res);
    }
}

export default authenticateToken(handler);