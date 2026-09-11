import {
    DEFAULT_CHECK_IN_TIME,
    DEFAULT_CHECK_OUT_TIME,
} from 'shared/src/lib/defaults';
import { defaultTimetable } from 'shared/src/schemas/database';
import type { WeekTimetable } from '@/schemas/database';

export type TimetableEntry = { checkIn: string; checkOut: string };

export function timetableText(timetable: TimetableEntry[]): string {
    return timetable.map((e) => `${e.checkIn ?? ''} – ${e.checkOut ?? ''}`).join(', ');
}

type UnknownEntry = { checkIn?: unknown; checkOut?: unknown } | null | undefined;

function normalizeEntry(entry: UnknownEntry): TimetableEntry {
    return {
        checkIn:
            typeof entry?.checkIn === 'string' && entry.checkIn
                ? entry.checkIn
                : DEFAULT_CHECK_IN_TIME,
        checkOut:
            typeof entry?.checkOut === 'string' && entry.checkOut
                ? entry.checkOut
                : DEFAULT_CHECK_OUT_TIME,
    };
}
export function normalizeWeekTimetable(timetable: unknown): WeekTimetable {
    if (!Array.isArray(timetable)) return defaultTimetable();
    return Array.from({ length: 7 }, (_, jsDay) => {
        const day = timetable[jsDay];
        if (!Array.isArray(day)) return [];
        return day
            .filter(
                (entry) =>
                    !!entry &&
                    ((typeof entry.checkIn === 'string' && entry.checkIn) ||
                        (typeof entry.checkOut === 'string' && entry.checkOut))
            )
            .map(normalizeEntry);
    });
}
