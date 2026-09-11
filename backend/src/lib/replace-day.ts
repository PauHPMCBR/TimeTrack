import { WorkSession } from '@/models';
import { findActiveInRange } from '@/repositories/work-session-repository';
import { upsertWorkDaySource } from '@/repositories/work-day-source-repository';
import { runInTransaction } from '@/lib/transaction';
import { withUserLock } from '@/lib/user-lock';
import { isMonthApproved } from '@/lib/monthly-approvals';
import { isCoherentSequence } from 'shared/src/lib/work-hours';
import {
    SOURCE_ADMIN_MANUAL,
    SOURCE_USER_MANUAL,
    SESSION_ACTIVE,
    SESSION_REPLACED,
    SESSION_REASON_ADMIN_CORRECTION,
    SESSION_REASON_MANUAL_CORRECTION,
} from 'shared/src/lib/constants';
import type { WorkSessionType } from 'shared/src/schemas/database';

export type ReplaceDayErrorCode =
    | 'MonthApprovedLocked'
    | 'InvalidDate'
    | 'OutOfDay'
    | 'NotInOrder';

export interface ReplaceDayInput {
    userId: string;
    /** Local "YYYY-MM-DD" day the edited sessions belong to. */
    date: string;
    sessions: {
        _id?: string;
        type: WorkSessionType;
        timestamp: string;
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
    | { ok: true; workSessions: unknown[] }
    | { ok: false; code: ReplaceDayErrorCode; field: 'date' | 'timestamp' | 'type' };

/**
 * Replaces a day's sessions with an edited set, versioned and never deleting:
 * the current sessions are flagged 'replaced' and the edited set is stored as
 * the next version of that (user, day) sequence. Shared by the admin day
 * correction and the worker self-edit — identical validation, lock and
 * transaction semantics for both (CT 101/2019 traceability).
 */
export async function replaceDaySessions(
    input: ReplaceDayInput
): Promise<ReplaceDayResult> {
    const { userId, date, sessions, reason, source, editedBy } = input;

    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59.999`);
    if (isNaN(dayStart.getTime()) || isNaN(dayEnd.getTime())) {
        return { ok: false, code: 'InvalidDate', field: 'date' };
    }

    // Hard lock: an approved month is the worker's confirmed record —
    // it must be revoked before any edit (new approval cycle).
    if (
        await isMonthApproved(userId, dayStart.getFullYear(), dayStart.getMonth() + 1)
    ) {
        return { ok: false, code: 'MonthApprovedLocked', field: 'date' };
    }

    const parsed = sessions.map((s) => ({
        _id: s._id,
        type: s.type,
        timestamp: new Date(s.timestamp),
        overtime: s.overtime === true,
    }));

    for (const p of parsed) {
        if (
            isNaN(p.timestamp.getTime()) ||
            p.timestamp < dayStart ||
            p.timestamp > dayEnd
        ) {
            return { ok: false, code: 'OutOfDay', field: 'timestamp' };
        }
    }

    parsed.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    for (let i = 1; i < parsed.length; i++) {
        if (parsed[i].timestamp.getTime() <= parsed[i - 1].timestamp.getTime()) {
            return { ok: false, code: 'NotInOrder', field: 'timestamp' };
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
    const workSessions = await withUserLock(userId, () =>
        runInTransaction(async (session) => {
            const txOptions = session ? { session } : undefined;
            const active = (await findActiveInRange(dayStart, dayEnd, {
                userId,
                endInclusive: true,
                session: session ?? undefined,
            })) as unknown as {
                _id: unknown;
                version?: number;
                notes?: string;
                notesEncrypted?: string;
            }[];
            const notesByOriginalId = new Map(
                active.map((s) => [
                    String(s._id),
                    { notes: s.notes, notesEncrypted: s.notesEncrypted },
                ])
            );
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
                    },
                    txOptions
                );
            }
            const docs = parsed.map((p) => {
                const carried =
                    p._id !== undefined
                        ? notesByOriginalId.get(p._id)
                        : undefined;
                return {
                    userId,
                    type: p.type,
                    timestamp: p.timestamp,
                    source,
                    overtime: p.overtime,
                    version: nextVersion,
                    status: SESSION_ACTIVE,
                    notes: carried?.notes,
                    notesEncrypted: carried?.notesEncrypted,
                    editReason: reason ?? defaultReason,
                    // Actor attribution: who produced this version (F1).
                    editedBy,
                    createdAt: now,
                };
            });
            return session
                ? WorkSession.insertMany(docs, { session })
                : WorkSession.insertMany(docs);
        })
    );

    await upsertWorkDaySource(userId, date, source);

    return { ok: true, workSessions };
}
