import { describe, it, expect } from 'vitest';
import {
    computeTimetableAnomalies,
    dayTimetable,
    impliedHours,
    timetableWorkingDays,
} from '@/lib/expected-timetable';
import { DEFAULT_TIMETABLE } from '@/schemas/database';

const entry = (checkIn: string, checkOut: string) => ({ checkIn, checkOut });

const s = (type: 'check_in' | 'check_out', hour: number, minute = 0) => ({
    type,
    timestamp: new Date(2024, 0, 15, hour, minute, 0),
});

describe('dayTimetable', () => {
    it('returns the intervals of a weekday and empty for missing days', () => {
        expect(dayTimetable(DEFAULT_TIMETABLE, 1)).toEqual([entry('09:00', '17:00')]);
        expect(dayTimetable(DEFAULT_TIMETABLE, 6)).toEqual([]);
    });
});

describe('timetableWorkingDays', () => {
    it('infers working days from weekdays with intervals', () => {
        expect(timetableWorkingDays(DEFAULT_TIMETABLE)).toEqual([1, 2, 3, 4, 5]);
    });
});

describe('impliedHours', () => {
    it('sums split-shift durations', () => {
        expect(impliedHours([entry('09:00', '13:00'), entry('14:00', '18:00')])).toBe(8);
    });

    it('ignores invalid spans', () => {
        expect(impliedHours([entry('17:00', '09:00')])).toBe(0);
    });
});

describe('computeTimetableAnomalies', () => {
    it('accepts punches within tolerance', () => {
        const anomalies = computeTimetableAnomalies(
            [s('check_in', 9, 10), s('check_out', 17, 10)],
            [entry('09:00', '17:00')],
            10
        );
        expect(anomalies).toEqual([]);
    });

    it('flags a late check-in beyond tolerance', () => {
        const anomalies = computeTimetableAnomalies(
            [s('check_in', 9, 11), s('check_out', 17, 0)],
            [entry('09:00', '17:00')],
            10
        );
        expect(anomalies).toEqual(['timetable_check_in_late']);
    });

    it('flags an early check-in beyond tolerance', () => {
        const anomalies = computeTimetableAnomalies(
            [s('check_in', 8, 49), s('check_out', 17, 0)],
            [entry('09:00', '17:00')],
            10
        );
        expect(anomalies).toEqual(['timetable_check_in_early']);
    });

    it('flags late and early check-outs beyond tolerance', () => {
        expect(
            computeTimetableAnomalies(
                [s('check_in', 9, 0), s('check_out', 17, 31)],
                [entry('09:00', '17:00')],
                30
            )
        ).toEqual(['timetable_check_out_late']);
        expect(
            computeTimetableAnomalies(
                [s('check_in', 9, 0), s('check_out', 16, 29)],
                [entry('09:00', '17:00')],
                30
            )
        ).toEqual(['timetable_check_out_early']);
    });

    it('pairs split shifts in order', () => {
        const anomalies = computeTimetableAnomalies(
            [
                s('check_in', 9, 0),
                s('check_out', 13, 0),
                s('check_in', 14, 16),
                s('check_out', 18, 0),
            ],
            [entry('09:00', '13:00'), entry('14:00', '18:00')],
            10
        );
        expect(anomalies).toEqual(['timetable_check_in_late']);
    });

    it('flags a shift-count mismatch when a shift is missing', () => {
        const anomalies = computeTimetableAnomalies(
            [s('check_in', 9, 0), s('check_out', 13, 0)],
            [entry('09:00', '13:00'), entry('14:00', '18:00')],
            10
        );
        expect(anomalies).toEqual(['timetable_shift_count']);
    });

    it('flags a shift-count mismatch for extra shifts', () => {
        const anomalies = computeTimetableAnomalies(
            [
                s('check_in', 9, 0),
                s('check_out', 17, 0),
                s('check_in', 18, 0),
                s('check_out', 20, 0),
            ],
            [entry('09:00', '17:00')],
            10
        );
        expect(anomalies).toEqual(['timetable_shift_count']);
    });

    it('flags a fully missed day', () => {
        expect(
            computeTimetableAnomalies([], [entry('09:00', '17:00')], 10)
        ).toEqual(['timetable_shift_count']);
    });

    it('reports nothing on empty intervals', () => {
        expect(computeTimetableAnomalies([s('check_in', 9)], [], 10)).toEqual([]);
    });
});
