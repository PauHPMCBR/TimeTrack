import type { AutoScheduleEntry } from '../schemas/database';

/**
 * A day's intervals are valid when each one starts before it ends within the
 * day and they progress through the day without overlapping: every interval
 * starts at or after the previous interval's check-out.
 */
export function isValidDayTimetable(day: AutoScheduleEntry[]): boolean {
    let previousCheckOut = '';
    for (const entry of day) {
        if (entry.checkIn >= entry.checkOut) return false;
        if (previousCheckOut && entry.checkIn < previousCheckOut) return false;
        previousCheckOut = entry.checkOut;
    }
    return true;
}

export function isValidWeekTimetable(week: AutoScheduleEntry[][]): boolean {
    return week.every(isValidDayTimetable);
}
