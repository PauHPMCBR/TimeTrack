import { User, WorkDaySessions } from '@/models';
import { findActiveDay } from '@/repositories/work-day-sessions-repository';
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
import { isMonthApproved } from '@/lib/monthly-approvals';
import { recomputeWorkDayRecords } from '@/lib/work-day-records';
import { getCompanyLanguage } from '@/lib/mail';
import type { EmailLanguage } from '@/lib/mail/types';
import {
    getAutoTimetable,
} from '@/lib/auto-schedule';
import { isValidDayTimetable } from 'shared/src/lib/timetable-validation';
import type { WorkSessionType } from 'shared/src/schemas/database';
import type { TimeKey } from 'shared/src/lib/time-key';
import type { DaySessionLike } from 'shared/src/lib/work-hours';
import type { DaySessionsRow, UserRow } from '@/lib/rows';
import {
    CHECK_IN,
    CHECK_OUT,
    SOURCE_USER_AUTOMATIC,
    SESSION_ACTIVE,
    SESSION_REPLACED,
} from 'shared/src/lib/constants';

type AutoScheduleUser = Pick<UserRow, 'autoTimetable'>;
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

        const user = await User.findById(
            req.user?.userId
        ).lean<AutoScheduleUser | null>();
        if (!user) {
            return responseErrorEntryNotFound(res, 'User');
        }

        const timetable = getAutoTimetable(user);
        // The stored timetable may be legacy/garbled: never write a set that
        // would not form a coherent ascending check-in/check-out sequence.
        if (!isValidDayTimetable(timetable)) {
            return responseErrorIllegalAction(res, 'InvalidTimetable');
        }

        const result = await withUserLock(req.user!.userId, async () => {
            // Versioning / audit trail: the day's current version is flagged
            // 'replaced' (never deleted) and the timetable set is stored as
            // the next version of that (user, day) document.
            const active = await findActiveDay(
                req.user!.userId,
                requestedDate
            ).lean<Pick<DaySessionsRow, '_id' | 'version'> | null>();
            const now = new Date();
            const nextVersion = (active?.version ?? 0) + 1;
            if (active) {
                await WorkDaySessions.updateOne(
                    { _id: active._id },
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

            const sessions: DaySessionLike[] = timetable.flatMap((entry) => [
                {
                    type: CHECK_IN as WorkSessionType,
                    time: entry.checkIn as TimeKey,
                    notes: autoTimetableNote(),
                    overtime: false,
                },
                {
                    type: CHECK_OUT as WorkSessionType,
                    time: entry.checkOut as TimeKey,
                    notes: autoTimetableNote(),
                    overtime: false,
                },
            ]);

            const dayDoc = await WorkDaySessions.create({
                userId: req.user!.userId,
                date: requestedDate,
                sessions,
                source: SOURCE_USER_AUTOMATIC,
                version: nextVersion,
                status: SESSION_ACTIVE,
                // Self-declaration: the worker applied their timetable.
                editedBy: req.user!.userId,
                createdAt: now,
            });

            return {
                workDaySessions: dayDoc,
                totalHours: computeDayHours(sessions).totalHours,
                anomalies: computeDayHours(sessions).anomalies,
            };
        });

        await recomputeWorkDayRecords(req.user!.userId, [requestedDate]);

        res.status(200).json({
            success: true,
            data: {
                workDaySessions: result.workDaySessions,
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