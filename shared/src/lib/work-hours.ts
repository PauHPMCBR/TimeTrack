import { WorkSessionAnomaly } from '../schemas/api';
import { CHECK_IN, CHECK_OUT, MS_PER_HOUR } from './constants';

export interface DaySessionLike {
    type: 'check_in' | 'check_out';
    timestamp: Date | string;
    overtime?: boolean;
}

export interface DayHoursOptions {
    /** Count an unmatched trailing check-in up to this instant (e.g. now / end of day). */
    countOpenUntil?: Date;
    /** Round totalHours to 2 decimals. Defaults to true. */
    round?: boolean;
}

export interface DayHoursResult {
    totalHours: number;
    overtimeHours: number;
    anomalies: WorkSessionAnomaly[];
}

/**
 * Pairs check-in/check-out timestamps of a single day into worked hours and
 * flags structural anomalies:
 *  - forgot_check_out: a trailing check-in with no matching check-out
 *  - forgot_check_in:  a check-out with no preceding check-in
 * Sessions must be sorted by timestamp before calling.
 */
export function computeDayHours(
    sessions: DaySessionLike[],
    options: DayHoursOptions = {}
): DayHoursResult {
    let totalMs = 0;
    let overtimeMs = 0;
    const anomalies: WorkSessionAnomaly[] = [];
    let pendingCheckIn: Date | null = null;
    let pendingOvertime = false;

    for (const session of sessions) {
        const timestamp = new Date(session.timestamp);
        if (session.type === CHECK_IN) {
            if (pendingCheckIn) {
                anomalies.push('forgot_check_out');
            }
            pendingCheckIn = timestamp;
            pendingOvertime = session.overtime === true;
        } else if (session.type === CHECK_OUT) {
            if (pendingCheckIn) {
                const ms = timestamp.getTime() - pendingCheckIn.getTime();
                totalMs += ms;
                // Either end flagged marks the whole interval as overtime.
                if (pendingOvertime || session.overtime === true) {
                    overtimeMs += ms;
                }
                pendingCheckIn = null;
                pendingOvertime = false;
            } else {
                anomalies.push('forgot_check_in');
            }
        }
    }

    if (pendingCheckIn) {
        anomalies.push('forgot_check_out');
        if (options.countOpenUntil) {
            const ms = Math.max(
                0,
                options.countOpenUntil.getTime() - pendingCheckIn.getTime()
            );
            totalMs += ms;
            if (pendingOvertime) {
                overtimeMs += ms;
            }
        }
    }

    const roundHours = (raw: number) =>
        options.round === false ? raw : Math.round(raw * 100) / 100;
    const totalHours = roundHours(Math.max(0, totalMs / MS_PER_HOUR));
    const overtimeHours = roundHours(Math.max(0, overtimeMs / MS_PER_HOUR));

    return { totalHours, overtimeHours, anomalies };
}

/**
 * Number of completed sessions for a day: a check-in paired with a following
 * check-out. Unmatched check-ins/check-outs (forgotten check-in/out) do not
 * count. Sessions must be sorted by timestamp before calling. Pairing follows
 * the same rules as `computeDayHours`.
 */
export function countCompletedSessions(sessions: DaySessionLike[]): number {
    let completed = 0;
    let pendingCheckIn = false;
    for (const session of sessions) {
        if (session.type === CHECK_IN) {
            pendingCheckIn = true;
        } else if (session.type === CHECK_OUT && pendingCheckIn) {
            completed++;
            pendingCheckIn = false;
        }
    }
    return completed;
}

/** Returns true when workedHours is within expectedHours ± benevolenceHours. */
export function isWithinBenevolence(
    workedHours: number,
    expectedHours: number,
    benevolenceHours: number
): boolean {
    const min = expectedHours - benevolenceHours;
    const max = expectedHours + benevolenceHours;
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
