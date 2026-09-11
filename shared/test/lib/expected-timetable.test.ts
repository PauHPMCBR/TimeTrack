import { describe, it, expect } from 'vitest';
import {
    computeTimetableAnomalies,
    computePairDeviations,
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

describe('computePairDeviations', () => {
    it('reports no deviation within tolerance', () => {
        expect(
            computePairDeviations(
                [{ checkIn: 9 * 60 + 10, checkOut: 17 * 60 - 10 }],
                [entry('09:00', '17:00')],
                10
            )
        ).toEqual([
            { checkInLate: false, checkInEarly: false, checkOutLate: false, checkOutEarly: false },
        ]);
    });

    it('reports the exact sides that deviate', () => {
        const deviations = computePairDeviations(
            [
                { checkIn: 9 * 60 + 20, checkOut: 16 * 60 },
                { checkIn: 14 * 60 - 20, checkOut: 18 * 60 + 20 },
            ],
            [entry('09:00', '13:00'), entry('14:00', '18:00')],
            10
        );
        expect(deviations[0]).toEqual({
            checkInLate: true,
            checkInEarly: false,
            checkOutLate: true,
            checkOutEarly: false,
        });
        expect(deviations[1]).toEqual({
            checkInEarly: true,
            checkInLate: false,
            checkOutLate: true,
            checkOutEarly: false,
        });
    });

    it('reports no deviation for pairs beyond the expected intervals', () => {
        expect(
            computePairDeviations(
                [{ checkIn: 9 * 60, checkOut: 17 * 60 }, { checkIn: 18 * 60, checkOut: 20 * 60 }],
                [entry('09:00', '17:00')],
                10
            )[1]
        ).toEqual({
            checkInLate: false,
            checkInEarly: false,
            checkOutLate: false,
            checkOutEarly: false,
        });
    });
});
