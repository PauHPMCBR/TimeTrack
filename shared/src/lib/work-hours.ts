import { WorkSessionAnomaly } from '../schemas/api';
import { CHECK_IN, CHECK_OUT } from './constants';
import type { TimeKey } from './time-key';

export interface DaySessionLike {
    type: 'check_in' | 'check_out';
    time: TimeKey;
    notes?: string;
    overtime?: boolean;
}

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
    let pendingCheckIn: TimeKey | null = null;
    let pendingOvertime = false;

    for (const session of sessions) {
        if (session.type === CHECK_IN) {
            if (pendingCheckIn) {
                anomalies.push('forgot_check_out');
            }
            pendingCheckIn = session.time;
            pendingOvertime = session.overtime === true;
        } else if (session.type === CHECK_OUT) {
            if (pendingCheckIn) {
                const minutes = timeToMinutes(session.time) - timeToMinutes(pendingCheckIn);
                totalMinutes += minutes;
                // Either end flagged marks the whole interval as overtime.
                if (pendingOvertime || session.overtime === true) {
                    overtimeMinutes += minutes;
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
            const minutes = Math.max(
                0,
                timeToMinutes(options.countOpenUntil) - timeToMinutes(pendingCheckIn)
            );
            totalMinutes += minutes;
            if (pendingOvertime) {
                overtimeMinutes += minutes;
            }
        }
    }

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
