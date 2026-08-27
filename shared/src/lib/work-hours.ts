import { WorkSessionAnomaly } from '../schemas/api';

export interface DaySessionLike {
    type: 'check_in' | 'check_out';
    timestamp: Date | string;
}

export interface DayHoursOptions {
    /** Count an unmatched trailing check-in up to this instant (e.g. now / end of day). */
    countOpenUntil?: Date;
    /** Round totalHours to 2 decimals. Defaults to true. */
    round?: boolean;
}

export interface DayHoursResult {
    totalHours: number;
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
    const anomalies: WorkSessionAnomaly[] = [];
    let pendingCheckIn: Date | null = null;

    for (const session of sessions) {
        const timestamp = new Date(session.timestamp);
        if (session.type === 'check_in') {
            if (pendingCheckIn) {
                anomalies.push('forgot_check_out');
            }
            pendingCheckIn = timestamp;
        } else if (session.type === 'check_out') {
            if (pendingCheckIn) {
                totalMs += timestamp.getTime() - pendingCheckIn.getTime();
                pendingCheckIn = null;
            } else {
                anomalies.push('forgot_check_in');
            }
        }
    }

    if (pendingCheckIn) {
        anomalies.push('forgot_check_out');
        if (options.countOpenUntil) {
            totalMs += Math.max(
                0,
                options.countOpenUntil.getTime() - pendingCheckIn.getTime()
            );
        }
    }

    const rawHours = Math.max(0, totalMs / 3_600_000);
    const totalHours =
        options.round === false ? rawHours : Math.round(rawHours * 100) / 100;

    return { totalHours, anomalies };
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
    let expected: 'check_in' | 'check_out' = 'check_in';
    for (const session of sessions) {
        if (session.type !== expected) return false;
        expected = session.type === 'check_in' ? 'check_out' : 'check_in';
    }
    return true;
}
