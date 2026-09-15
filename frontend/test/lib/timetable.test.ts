import { describe, it, expect } from 'vitest';
import {
    normalizeWeekTimetable,
    timetableText,
} from '@/lib/timetable';

describe('normalizeWeekTimetable', () => {
    it('normalizes valid weeks and strips extra entry fields', () => {
        const week = [
            [],
            [{ checkIn: '08:00', checkOut: '16:00', _id: 'x' } as never],
            [],
            [],
            [],
            [],
            [],
        ];
        const normalized = normalizeWeekTimetable(week);
        expect(normalized).toHaveLength(7);
        expect(normalized[0]).toEqual([]);
        expect(normalized[1]).toEqual([{ checkIn: '08:00', checkOut: '16:00' }]);
        expect(normalized[3]).toEqual([]);
    });

    it('throws on a non-array or wrong-length timetable', () => {
        expect(() => normalizeWeekTimetable(undefined)).toThrow();
        expect(() => normalizeWeekTimetable([[], []])).toThrow();
    });

    it('throws on entries missing either time field instead of fabricating values', () => {
        expect(() =>
            normalizeWeekTimetable([[{ checkIn: '08:30' } as never]])
        ).toThrow();
        expect(() =>
            normalizeWeekTimetable([[{ checkOut: '15:00' } as never]])
        ).toThrow();
    });
});

describe('timetableText', () => {
    it('joins entries and tolerates missing fields', () => {
        expect(timetableText([{ checkIn: '09:00', checkOut: '17:00' }])).toBe(
            '09:00 – 17:00'
        );
        expect(timetableText([{} as { checkIn: string; checkOut: string }])).toBe(
            ' – '
        );
    });
});
