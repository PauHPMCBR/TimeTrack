import { User, WorkSession } from '@/models';
import { findActiveInRange } from '@/repositories/work-session-repository';
import {
    responseErrorEntryNotFound,
    responseErrorIllegalAction,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { ApplyAutoScheduleRequestSchema } from 'shared/src/schemas/api';
import { withApi } from '@/lib/api-handler';
import { computeDayHours } from 'shared/src/lib/work-hours';
import { withUserLock } from '@/lib/user-lock';
import { dateKey } from '@/lib/date-key';
import { dayRange, dayTimestamp } from '@/lib/date-range';
import { isMonthApproved } from '@/lib/monthly-approvals';
import { getCompanyLanguage } from '@/lib/mail';
import type { EmailLanguage } from '@/lib/mail/types';
import {
    getAutoTimetable,
    AutoScheduleEntry,
} from '@/lib/auto-schedule';
import { upsertWorkDaySource } from '@/repositories/work-day-source-repository';
import {
    CHECK_IN,
    CHECK_OUT,
    SOURCE_USER_AUTOMATIC,
    SESSION_ACTIVE,
    SESSION_REPLACED,
} from 'shared/src/lib/constants';

interface AutoScheduleUser {
    autoTimetable?: AutoScheduleEntry[];
}
const AUTO_TIMETABLE_NOTES: Record<EmailLanguage, string> = {
    ca: 'Horari automàtic aplicat',
    en: 'Automatic timetable applied',
    es: 'Horario automático aplicado',
};

function autoTimetableNote(): string {
    return AUTO_TIMETABLE_NOTES[getCompanyLanguage()];
}

// Fills a day's timestamps with the user's configured automatic timetable
// (one check-in/check-out per interval), superseding any existing sessions for
// that day (the previous set is flagged 'replaced', never deleted). The day
// source becomes "userAutomatic" so manual edits are never overwritten by the
// reminder again.
export default withApi(
    { method: 'POST', body: ApplyAutoScheduleRequestSchema },
    async (req, res, { body }) => {
    try {
        const requestedDate =
            typeof body?.date === 'string' ? body.date : dateKey(new Date());

        if (requestedDate > dateKey(new Date())) {
            return responseErrorIllegalAction(res, 'FutureDate');
        }

        // Hard lock: an approved month is the worker's confirmed record —
        // the automatic timetable cannot overwrite any day in it.
        const [requestYear, requestMonth] = requestedDate
            .split('-')
            .map(Number);
        if (await isMonthApproved(req.user!.userId, requestYear, requestMonth)) {
            return responseErrorIllegalAction(res, 'MonthApprovedLocked');
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
            // Versioning / audit trail: the day's current sessions are flagged
            // 'replaced' (never deleted) and the timetable set is stored as
            // the next version of that (user, day) sequence.
            const active = (await findActiveInRange(start, end, {
                userId: req.user!.userId,
            }).lean()) as unknown as { _id: unknown; version?: number }[];
            const now = new Date();
            const nextVersion =
                active.reduce((max, s) => Math.max(max, s.version ?? 1), 0) + 1;
            if (active.length > 0) {
                await WorkSession.updateMany(
                    { _id: { $in: active.map((s) => s._id) } },
                    {
                        $set: {
                            status: SESSION_REPLACED,
                            replacedByVersion: nextVersion,
                            replacedAt: now,
                            updatedAt: now,
                        },
                    }
                );
            }

            const sessions = timetable.flatMap((entry) => [
                new WorkSession({
                    userId: req.user!.userId,
                    type: CHECK_IN,
                    timestamp: dayTimestamp(requestedDate, entry.checkIn),
                    version: nextVersion,
                    status: SESSION_ACTIVE,
                    notes: autoTimetableNote(),
                    createdAt: now,
                    // Self-declaration: the worker applied their timetable.
                    editedBy: req.user!.userId,
                }),
                new WorkSession({
                    userId: req.user!.userId,
                    type: CHECK_OUT,
                    timestamp: dayTimestamp(requestedDate, entry.checkOut),
                    version: nextVersion,
                    status: SESSION_ACTIVE,
                    notes: autoTimetableNote(),
                    createdAt: now,
                    editedBy: req.user!.userId,
                }),
            ]);

            await Promise.all(sessions.map((s) => s.save()));

            await upsertWorkDaySource(
                req.user!.userId,
                requestedDate,
                SOURCE_USER_AUTOMATIC
            );

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
);