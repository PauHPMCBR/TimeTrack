import { describe, it, expect } from 'vitest';
import {
    normalizeWeekTimetable,
    timetableText,
} from '@/lib/timetable';

describe('normalizeWeekTimetable', () => {
    it('returns a fresh 7-day default for missing data', () => {
        const normalized = normalizeWeekTimetable(undefined);
        expect(normalized).toHaveLength(7);
        expect(normalized[0]).toEqual([]);
        expect(normalized[1]).toEqual([{ checkIn: '09:00', checkOut: '17:00' }]);
    });

    it('pads missing weekdays with empty arrays', () => {
        const normalized = normalizeWeekTimetable([
            [{ checkIn: '08:00', checkOut: '16:00' }],
        ]);
        expect(normalized).toHaveLength(7);
        expect(normalized[0]).toEqual([{ checkIn: '08:00', checkOut: '16:00' }]);
        expect(normalized[3]).toEqual([]);
    });

    it('fills missing entry fields with defaults', () => {
        const normalized = normalizeWeekTimetable([
            [{ checkIn: '08:30' }, { checkOut: '15:00' }],
        ]);
        expect(normalized[0]).toEqual([
            { checkIn: '08:30', checkOut: '17:00' },
            { checkIn: '09:00', checkOut: '15:00' },
        ]);
    });

    it('drops entries without any time field', () => {
        const normalized = normalizeWeekTimetable([
            [{}, { checkIn: '09:00', checkOut: '17:00' }],
        ]);
        expect(normalized[0]).toEqual([{ checkIn: '09:00', checkOut: '17:00' }]);
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
