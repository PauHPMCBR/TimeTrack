import type { DaySessionRow, WorkSessionAnomaly } from '../schemas/api';
import { CHECK_IN, CHECK_OUT } from './constants';
import type { TimeKey } from './time-key';

// Structural superset of a persisted session entry: the canonical fields from
// the row schema plus an optional overtime flag, so the aggregation helpers
// accept both stored rows and editor drafts.
export type DaySessionLike = Pick<
    DaySessionRow,
    'type' | 'time' | 'notes'
> & { overtime?: boolean };

/** The end of a day expressed as a wall clock ("HH:MM" keys, or "24:00"). */
export type DayEndTime = TimeKey | '24:00';

export interface DayHoursOptions {
    countOpenUntil?: DayEndTime;
    round?: boolean;
}

export interface DayHoursResult {
    totalHours: number;
    overtimeHours: number;
    anomalies: WorkSessionAnomaly[];
}

export function timeToMinutes(time: DayEndTime): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Pairs check-in/check-out clock times ("HH:MM") of a single day into worked
 * hours and flags structural anomalies:
 *  - forgot_check_out: a trailing check-in with no matching check-out
 *  - forgot_check_in:  a check-out with no preceding check-in
 * Sessions must be sorted by `time` before calling.
 */
export function computeDayHours(
    sessions: DaySessionLike[],
    options: DayHoursOptions = {}
): DayHoursResult {
    let totalMinutes = 0;
    let overtimeMinutes = 0;
    const anomalies: WorkSessionAnomaly[] = [];
    const pairs = pairSessions(sessions);

    pairs.forEach((pair, index) => {
        if (!pair.entry) {
            anomalies.push('forgot_check_in');
            return;
        }
        if (!pair.leave) {
            anomalies.push('forgot_check_out');
            // Only the trailing open check-in is counted up to `countOpenUntil`.
            if (options.countOpenUntil && index === pairs.length - 1) {
                const minutes = Math.max(
                    0,
                    timeToMinutes(options.countOpenUntil) -
                        timeToMinutes(pair.entry.time)
                );
                totalMinutes += minutes;
                if (pair.entry.overtime === true) {
                    overtimeMinutes += minutes;
                }
            }
            return;
        }
        const minutes =
            timeToMinutes(pair.leave.time) - timeToMinutes(pair.entry.time);
        totalMinutes += minutes;
        // Either end flagged marks the whole interval as overtime.
        if (pair.overtime) {
            overtimeMinutes += minutes;
        }
    });

    const roundHours = (raw: number) =>
        options.round === false ? raw : Math.round(raw * 100) / 100;
    const totalHours = roundHours(Math.max(0, totalMinutes / 60));
    const overtimeHours = roundHours(Math.max(0, overtimeMinutes / 60));

    return { totalHours, overtimeHours, anomalies };
}

/**
 * Number of completed sessions for a day: a check-in paired with a following
 * check-out. Unmatched check-ins/check-outs (forgotten check-in/out) do not
 * count. Sessions must be sorted by timestamp before calling. Pairing follows
 * the same rules as `computeDayHours`.
 */
export function countCompletedSessions(sessions: DaySessionLike[]): number {
    return pairSessions(sessions).filter((pair) => pair.entry && pair.leave)
        .length;
}

export function isWithinTolerance(
    workedHours: number,
    expectedHours: number,
    toleranceMinutes: number
): boolean {
    const tolerance = Math.max(0, toleranceMinutes) / 60;
    const min = expectedHours - tolerance;
    const max = expectedHours + tolerance;
    return workedHours >= min && workedHours <= max;
}

/** True when sessions alternate starting with a check_in (empty is coherent). */
export function isCoherentSequence(sessions: DaySessionLike[]): boolean {
    let expected: 'check_in' | 'check_out' = CHECK_IN;
    for (const session of sessions) {
        if (session.type !== expected) return false;
        expected = session.type === CHECK_IN ? CHECK_OUT : CHECK_IN;
    }
    return true;
}

export interface SessionPair<T extends DaySessionLike = DaySessionLike> {
    entry: T | null;
    leave: T | null;
    overtime: boolean;
}

/**
 * Groups a day's sessions into check-in/check-out pairs. Unmatched entries
 * keep the missing side null; overtime is true when either side is flagged.
 * Sessions must be sorted by `time` before calling.
 */
export function pairSessions<T extends DaySessionLike>(
    sessions: T[]
): SessionPair<T>[] {
    const pairs: SessionPair<T>[] = [];
    let pending: T | null = null;

    for (const session of sessions) {
        if (session.type === CHECK_IN) {
            if (pending) {
                pairs.push({
                    entry: pending,
                    leave: null,
                    overtime: pending.overtime === true,
                });
            }
            pending = session;
        } else if (pending) {
            pairs.push({
                entry: pending,
                leave: session,
                overtime: pending.overtime === true || session.overtime === true,
            });
            pending = null;
        } else {
            pairs.push({
                entry: null,
                leave: session,
                overtime: session.overtime === true,
            });
        }
    }

    if (pending) {
        pairs.push({
            entry: pending,
            leave: null,
            overtime: pending.overtime === true,
        });
    }

    return pairs;
}

/** Worked minutes of a pair, or null when the pair is incomplete. */
export function pairWorkedMinutes(pair: SessionPair): number | null {
    if (!pair.entry || !pair.leave) return null;
    const minutes =
        timeToMinutes(pair.leave.time) - timeToMinutes(pair.entry.time);
    return minutes >= 0 ? minutes : null;
}

/**
 * The trailing check-in without a matching check-out (the worker is currently
 * checked in), or null. Sessions must be sorted by `time` before calling.
 */
export function openCheckIn<T extends DaySessionLike>(sessions: T[]): T | null {
    const pairs = pairSessions(sessions);
    const last = pairs[pairs.length - 1];
    return last && last.entry && !last.leave ? last.entry : null;
}

/** True when the worker has an unmatched trailing check-in. */
export function isCurrentlyWorking(sessions: DaySessionLike[]): boolean {
    return openCheckIn(sessions) !== null;
}

/** The type the next session should have to keep the sequence coherent. */
export function nextSessionType(
    sessions: DaySessionLike[]
): 'check_in' | 'check_out' {
    const last = sessions[sessions.length - 1];
    return !last || last.type === CHECK_OUT ? CHECK_IN : CHECK_OUT;
}

/** Formats a minute count as "HH:MM". */
export function formatHoursMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
