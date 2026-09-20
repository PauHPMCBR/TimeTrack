import { WorkDaySessions } from '@/models';
import { findActiveDay } from '@/repositories/work-day-sessions-repository';
import { runInTransaction } from '@/lib/transaction';
import { withUserLock } from '@/lib/user-lock';
import { isMonthApproved } from '@/lib/monthly-approvals';
import { recomputeWorkDayRecords } from '@/lib/work-day-records';
import { isCoherentSequence, timeToMinutes, type DaySessionLike } from 'shared/src/lib/work-hours';
import { isValidDateKey, DateKey } from 'shared/src/lib/day-key';
import {
    SOURCE_ADMIN_MANUAL,
    SOURCE_USER_MANUAL,
    SESSION_ACTIVE,
    SESSION_REPLACED,
    SESSION_REASON_ADMIN_CORRECTION,
    SESSION_REASON_MANUAL_CORRECTION,
} from 'shared/src/lib/constants';
import type { WorkSessionType } from 'shared/src/schemas/database';
import type { TimeKey } from 'shared/src/lib/time-key';
import type { DaySessionsRow } from '@/lib/rows';

export type ReplaceDayErrorCode =
    | 'MonthApprovedLocked'
    | 'InvalidDate'
    | 'OutOfDay'
    | 'NotInOrder';

export interface ReplaceDayInput {
    userId: string;
    /** Calendar day (company time-zone) being replaced. */
    date: DateKey;
    sessions: {
        type: WorkSessionType;
        time: TimeKey;
        notes?: string;
        overtime?: boolean;
    }[];
    /** Audit note persisted on the new version. */
    reason?: string;
    /** 'adminManual' for admin corrections, 'userManual' for worker self-edits. */
    source: typeof SOURCE_ADMIN_MANUAL | typeof SOURCE_USER_MANUAL;
    /** Actor attribution: id of the acting user. */
    editedBy: string;
}

export type ReplaceDayResult =
    | { ok: true; workDaySessions: DaySessionsRow }
    | { ok: false; code: ReplaceDayErrorCode; field: 'date' | 'time' | 'type' };

/**
 * Replaces a whole day with an edited session set, versioned and never
 * deleting: the current day version is flagged 'replaced' and the edited set
 * is stored as the next version of that (user, day) document.
 */
export async function replaceDaySessions(
    input: ReplaceDayInput
): Promise<ReplaceDayResult> {
    const { userId, date, sessions, reason, source, editedBy } = input;

    if (!isValidDateKey(date)) {
        return { ok: false, code: 'InvalidDate', field: 'date' };
    }

    // Hard lock: an approved month is the worker's confirmed record —
    // it must be revoked before any edit (new approval cycle).
    if (
        await isMonthApproved(
            userId,
            Number(date.slice(0, 4)),
            Number(date.slice(5, 7))
        )
    ) {
        return { ok: false, code: 'MonthApprovedLocked', field: 'date' };
    }

    const parsed: (DaySessionLike & { notes?: string })[] = sessions.map(
        (s) => ({
            type: s.type,
            time: s.time,
            ...(s.notes !== undefined ? { notes: s.notes } : {}),
            overtime: s.overtime === true,
        })
    );

    parsed.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

    for (let i = 1; i < parsed.length; i++) {
        if (timeToMinutes(parsed[i].time) <= timeToMinutes(parsed[i - 1].time)) {
            return { ok: false, code: 'NotInOrder', field: 'time' };
        }
    }

    if (!isCoherentSequence(parsed)) {
        return { ok: false, code: 'NotInOrder', field: 'type' };
    }

    const now = new Date();
    const defaultReason =
        source === SOURCE_ADMIN_MANUAL
            ? SESSION_REASON_ADMIN_CORRECTION
            : SESSION_REASON_MANUAL_CORRECTION;

    // Serialized per user (same lock as the user-facing flows) so two
    // concurrent replacements can't compute the same next version.
    const workDaySessions = await withUserLock(userId, () =>
        runInTransaction(async (session) => {
            const txOptions = session ? { session } : undefined;
            const active: Pick<
                DaySessionsRow,
                '_id' | 'version'
            > | null = await findActiveDay(userId, date, {
                session: session ?? undefined,
            });
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
                    },
                    txOptions
                );
            }
            const [created] = await WorkDaySessions.create(
                [
                    {
                        userId,
                        date,
                        sessions: parsed,
                        source,
                        version: nextVersion,
                        status: SESSION_ACTIVE,
                        editReason: reason ?? defaultReason,
                        // Actor attribution: who produced this version (F1).
                        editedBy,
                        createdAt: now,
                    },
                ],
                txOptions
            );
            return created;
        })
    );

    await recomputeWorkDayRecords(userId, [date]);

    return { ok: true, workDaySessions };
}
