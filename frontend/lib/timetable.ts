import type { WeekTimetable } from '@/schemas/database';

export type TimetableEntry = { checkIn: string; checkOut: string };

export function timetableText(timetable: TimetableEntry[]): string {
    return timetable.map((e) => `${e.checkIn ?? ''} – ${e.checkOut ?? ''}`).join(', ');
}

export function normalizeWeekTimetable(timetable: unknown): WeekTimetable {
    if (!Array.isArray(timetable) || timetable.length !== 7) {
        throw new Error('normalizeWeekTimetable: timetable must be a 7-day array');
    }
    return Array.from({ length: 7 }, (_, jsDay) => {
        const day = timetable[jsDay];
        if (!Array.isArray(day)) {
            throw new Error(
                `normalizeWeekTimetable: weekday ${jsDay} is not an array`
            );
        }
        return day.map((entry) => {
            if (
                !entry ||
                typeof entry.checkIn !== 'string' ||
                !entry.checkIn ||
                typeof entry.checkOut !== 'string' ||
                !entry.checkOut
            ) {
                throw new Error(
                    `normalizeWeekTimetable: invalid interval on weekday ${jsDay}`
                );
            }
            return { checkIn: entry.checkIn, checkOut: entry.checkOut };
        });
    });
}
