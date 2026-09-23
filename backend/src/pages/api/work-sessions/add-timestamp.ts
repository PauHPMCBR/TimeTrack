import { WorkDaySessions } from '@/models';
import { responseErrorIncorrectParameter, responseErrorPost } from '@/lib/response-error-generator';
import { WorkSessionRequestSchema } from 'shared/src/schemas/api';
import { withApi } from '@/lib/api-handler';
import { computeDayHours, openCheckIn } from 'shared/src/lib/work-hours';
import { CheckInIncorrectParameterReason } from 'shared/src/types/response-errors';
import { withUserLock } from '@/lib/user-lock';
import { nowWallClock } from '@/lib/timezone';
import { findActiveDay } from '@/repositories/work-day-sessions-repository';
import { encrypt } from '@/lib/crypto';
import {
    CHECK_IN,
    CHECK_OUT,
    SOURCE_USER_AUTOMATIC,
    SOURCE_USER_CLICK,
    SESSION_ACTIVE,
    SESSION_REPLACED,
} from 'shared/src/lib/constants';
import type { WorkSessionType } from 'shared/src/schemas/database';
import type { TimeKey } from 'shared/src/lib/time-key';
import type { DateKey } from 'shared/src/lib/day-key';
import type { DaySessionLike } from 'shared/src/lib/work-hours';
import type { DaySessionsRow } from '@/lib/rows';

// The day document holding the current version of today's sessions (ordered),
// or null when the day has no data yet.
async function getTodayDay(
    userId: string,
    todayKey: DateKey
): Promise<
    Pick<DaySessionsRow, '_id' | 'version' | 'source' | 'sessions'> | null
> {
    return findActiveDay(userId, todayKey);
}

function verifyInOut(
    lastSession: DaySessionLike | undefined,
    type: string
): CheckInIncorrectParameterReason | null {
    if (type === CHECK_IN) {
        if (lastSession && lastSession.type === CHECK_IN) {
            return 'AlreadyCheckedIn';
        }
    } else if (type === CHECK_OUT) {
        if (!lastSession) {
            return 'NoEntryToday';
        }
        if (lastSession.type === CHECK_OUT) {
            return 'AlreadyCheckedOut';
        }
    }

    return null;
}

// A future-dated session is "programmed", not real yet — the self-applied
// auto timetable, or a day correction that planned ahead. Manual punches must
// be able to override them: otherwise a programmed future check-out always
// sorts last and the in/out guard would allow unlimited consecutive check-ins.
function isProgrammed(time: TimeKey, nowTime: TimeKey): boolean {
    return time > nowTime;
}

type CheckInOutResult =
    | { error: CheckInIncorrectParameterReason }
    | {
          session: DaySessionLike;
          hoursWorked: number | null;
      };

export default withApi(
    { method: 'POST', body: WorkSessionRequestSchema },
    async (req, res, { body }) => {
    const { type, notes, overtime } = body;

    try {
        if (![CHECK_IN, CHECK_OUT].includes(type)) {
            return responseErrorIncorrectParameter(res, 'type');
        }

        const result = await withUserLock<CheckInOutResult>(
            req.user!.userId,
            async () => {
                const now = nowWallClock();
                const todayKey = now.date;
                const stamp = new Date();
                const day = await getTodayDay(req.user!.userId, todayKey);
                const daySourceIsAutomatic =
                    day?.source === SOURCE_USER_AUTOMATIC;

                // Manual punch vs programmed sessions: any future-dated
                // session (auto timetable or a planned-ahead correction) is
                // superseded by a real punch. A manual check-in also
                // supersedes the open automatic check-in (the start of the
                // interval being lived through), since the punch redefines
                // when work actually started.
                const effective = (day?.sessions ?? []).filter(
                    (s) => !isProgrammed(s.time, now.time)
                );
                const hasProgrammed =
                    (day?.sessions ?? []).length > effective.length;
                let dropOpenAutoCheckIn = false;
                if (type === CHECK_IN) {
                    const last = effective[effective.length - 1];
                    if (last && last.type === CHECK_IN && daySourceIsAutomatic) {
                        dropOpenAutoCheckIn = true;
                        effective.pop();
                    }
                }

                const inOutCheckError = verifyInOut(
                    effective[effective.length - 1],
                    type
                );
                if (inOutCheckError !== null) {
                    return { error: inOutCheckError };
                }

                const punch: DaySessionLike = {
                    type: type as WorkSessionType,
                    time: now.time,
                    ...(notes ? { notes } : {}),
                    overtime: overtime === true,
                };

                if (!day) {
                    await WorkDaySessions.create({
                        userId: req.user!.userId,
                        date: todayKey,
                        sessions: [punch],
                        source: SOURCE_USER_CLICK,
                        version: 1,
                        status: SESSION_ACTIVE,
                        editedBy: req.user!.userId,
                        createdAt: stamp,
                    });
                    return { session: punch, hoursWorked: null };
                }

                const openPunch =
                    type === CHECK_OUT ? openCheckIn(effective) : null;
                const openPunchOvertimeChanged =
                    !!openPunch && openPunch.overtime !== punch.overtime;
                if (openPunchOvertimeChanged) {
                    openPunch.overtime = punch.overtime === true;
                }

                // Programmed sessions are superseded (whole-day versioning):
                // the day is replaced by a new version with only the
                // still-effective sessions plus the punch.
                if (hasProgrammed || dropOpenAutoCheckIn) {
                    const nextVersion = (day.version ?? 1) + 1;
                    await WorkDaySessions.updateOne(
                        { _id: day._id },
                        {
                            $set: {
                                status: SESSION_REPLACED,
                                replacedByVersion: nextVersion,
                                replacedAt: stamp,
                                updatedAt: stamp,
                            },
                        }
                    );
                    await WorkDaySessions.create({
                        userId: req.user!.userId,
                        date: todayKey,
                        sessions: [...effective, punch],
                        source: SOURCE_USER_CLICK,
                        version: nextVersion,
                        status: SESSION_ACTIVE,
                        editedBy: req.user!.userId,
                        createdAt: stamp,
                    });
                } else {
                    await WorkDaySessions.updateOne(
                        { _id: day._id },
                        {
                            $set: { source: SOURCE_USER_CLICK, updatedAt: stamp },
                            $push: {
                                sessions: {
                                    type: punch.type,
                                    time: punch.time,
                                    notesEncrypted: punch.notes
                                        ? encrypt(punch.notes)
                                        : '',
                                    overtime: punch.overtime,
                                },
                            },
                        }
                    );
                    if (openPunchOvertimeChanged) {
                        await WorkDaySessions.updateOne(
                            {
                                _id: day._id,
                                'sessions.time': openPunch!.time,
                                'sessions.type': openPunch!.type,
                            },
                            { $set: { 'sessions.$.overtime': punch.overtime } }
                        );
                    }
                }

                let hoursWorked: number | null = null;
                if (type === CHECK_OUT) {
                    hoursWorked = computeDayHours([
                        ...effective,
                        punch,
                    ]).totalHours;
                }

                return { session: punch, hoursWorked };
            }
        );

        if ('error' in result) {
            return responseErrorIncorrectParameter(res, 'type', [result.error]);
        }

        res.status(201).json({
            success: true,
            data: {
                message:
                    type === CHECK_IN
                        ? 'CheckInRegistered'
                        : 'CheckOutRegistered',
                session: result.session,
                hoursWorked: result.hoursWorked,
            },
        });
    } catch (error) {
        console.error('Work session error:', error);
        return responseErrorPost(res);
    }
    }
);
