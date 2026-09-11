import { WorkSessionAnomaly } from '../schemas/api';
import type { AutoScheduleEntry, WeekTimetable } from '../schemas/database';
import { CHECK_IN, CHECK_OUT } from './constants';
import type { DaySessionLike } from './work-hours';

export function dayTimetable(
    timetable: WeekTimetable,
    jsDay: number
): AutoScheduleEntry[] {
    return timetable[jsDay] ?? [];
}
export function timetableWorkingDays(timetable: WeekTimetable): number[] {
    const days: number[] = [];
    for (let day = 0; day < 7; day++) {
        if (dayTimetable(timetable, day).length > 0) days.push(day);
    }
    return days;
}

export function impliedHours(intervals: AutoScheduleEntry[]): number {
    let minutes = 0;
    for (const entry of intervals) {
        const span = timeToMinutes(entry.checkOut) - timeToMinutes(entry.checkIn);
        if (span > 0) minutes += span;
    }
    return Math.round((minutes / 60) * 100) / 100;
}

export function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

function clockMinutes(timestamp: Date | string): number {
    const date = new Date(timestamp);
    return date.getHours() * 60 + date.getMinutes();
}
export function computeTimetableAnomalies(
    sessions: DaySessionLike[],
    intervals: AutoScheduleEntry[],
    toleranceMinutes: number
): WorkSessionAnomaly[] {
    const anomalies: WorkSessionAnomaly[] = [];
    const sorted = [...sessions].sort(
        (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const pairs: Array<{ checkIn: number; checkOut: number }> = [];
    let pendingCheckIn: number | null = null;
    for (const session of sorted) {
        if (session.type === CHECK_IN) {
            pendingCheckIn = clockMinutes(session.timestamp);
        } else if (session.type === CHECK_OUT && pendingCheckIn !== null) {
            pairs.push({
                checkIn: pendingCheckIn,
                checkOut: clockMinutes(session.timestamp),
            });
            pendingCheckIn = null;
        }
    }

    const tolerance = Math.max(0, toleranceMinutes);
    const paired = Math.min(pairs.length, intervals.length);
    for (let i = 0; i < paired; i++) {
        const interval = intervals[i];
        const pair = pairs[i];
        const checkInDelta =
            pair.checkIn - timeToMinutes(interval.checkIn);
        if (checkInDelta > tolerance) {
            anomalies.push('timetable_check_in_late');
        } else if (-checkInDelta > tolerance) {
            anomalies.push('timetable_check_in_early');
        }
        const checkOutDelta =
            pair.checkOut - timeToMinutes(interval.checkOut);
        if (checkOutDelta > tolerance) {
            anomalies.push('timetable_check_out_late');
        } else if (-checkOutDelta > tolerance) {
            anomalies.push('timetable_check_out_early');
        }
    }
    if (pairs.length !== intervals.length) {
        anomalies.push('timetable_shift_count');
    }
    return anomalies;
}
