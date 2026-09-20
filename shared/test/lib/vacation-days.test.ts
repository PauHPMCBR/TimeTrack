import { describe, it, expect } from 'vitest';
import {
    countSpentVacationDays,
    expandIntervalsToDayKeys,
    keyIsWithinAnyInterval,
    keyIsWithinInterval,
    resolveNonWorkingDays,
} from '../../src/lib/vacation-days';

describe('resolveNonWorkingDays', () => {
    it('derives the 0h weekdays when the user has weekly expected hours', () => {
        expect(
            resolveNonWorkingDays(
                { weeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0] },
                [0, 6]
            )
        ).toEqual([0, 6]);
        expect(
            resolveNonWorkingDays(
                { weeklyExpectedHours: [8, 0, 0, 8, 8, 8, 8] },
                [0, 6]
            )
        ).toEqual([1, 2]);
    });

    it('falls back to the company-wide non-working days only without a user', () => {
        expect(resolveNonWorkingDays(undefined, [0, 6])).toEqual([0, 6]);
        expect(resolveNonWorkingDays(null, [6, 0])).toEqual([6, 0]);
    });

    it('throws on a user with missing or invalid weeklyExpectedHours instead of falling back', () => {
        expect(() => resolveNonWorkingDays({}, [0, 6])).toThrow();
        expect(() =>
            resolveNonWorkingDays({ weeklyExpectedHours: [] }, [0, 6])
        ).toThrow();
        expect(() =>
            resolveNonWorkingDays(
                { weeklyExpectedHours: [0, -2, 8, 8, 8, 8, 0] },
                [0, 6]
            )
        ).toThrow();
    });

    it('derives the weekdays without intervals in timetable mode', () => {
        expect(
            resolveNonWorkingDays(
                {
                    scheduleMode: 'timetable',
                    timetable: [[], [{ checkIn: '09:00', checkOut: '17:00' }], [{ checkIn: '09:00', checkOut: '17:00' }], [{ checkIn: '09:00', checkOut: '17:00' }], [{ checkIn: '09:00', checkOut: '17:00' }], [{ checkIn: '09:00', checkOut: '17:00' }], []],
                },
                [0, 6]
            )
        ).toEqual([0, 6]);
    });

    it('throws when a timetable-mode user has no valid stored timetable', () => {
        expect(() =>
            resolveNonWorkingDays({ scheduleMode: 'timetable' }, [0, 6])
        ).toThrow();
    });
});

describe('countSpentVacationDays', () => {
    it('counts every calendar day in the interval', () => {
        // Wed → Thu.
        expect(countSpentVacationDays('2024-06-12', '2024-06-13', [], [])).toBe(2);
        expect(countSpentVacationDays('2024-06-12', '2024-06-12', [], [])).toBe(1);
    });

    it('excludes non-working week days', () => {
        // Fri → Mon spans a weekend.
        expect(
            countSpentVacationDays('2024-06-14', '2024-06-17', [0, 6], [])
        ).toBe(2);
    });

    it('excludes days covered by obligatory intervals', () => {
        expect(
            countSpentVacationDays('2024-06-12', '2024-06-13', [], [
                { startDate: '2024-06-13', endDate: '2024-06-13' },
            ])
        ).toBe(1);
    });

    it('returns 0 for an inverted interval', () => {
        expect(countSpentVacationDays('2024-06-14', '2024-06-13', [], [])).toBe(0);
    });

    it('is zone-independent: the same keys count identically anywhere', () => {
        expect(countSpentVacationDays('2024-06-14', '2024-06-17', [0, 6], [])).toBe(2);
    });
});

describe('keyIsWithinInterval', () => {
    it('compares day keys lexicographically', () => {
        expect(keyIsWithinInterval('2024-06-13', '2024-06-12', '2024-06-14')).toBe(true);
        expect(keyIsWithinInterval('2024-06-12', '2024-06-13', '2024-06-14')).toBe(false);
        expect(keyIsWithinInterval('2024-06-12', '2024-06-12', '2024-06-12')).toBe(true);
        expect(keyIsWithinInterval('2024-06-15', '2024-06-12', '2024-06-14')).toBe(false);
    });
});

describe('keyIsWithinAnyInterval', () => {
    const intervals = [
        { startDate: '2024-06-12', endDate: '2024-06-13' },
        { startDate: '2024-12-25', endDate: '2024-12-25' },
    ];

    it('matches a key covered by any interval', () => {
        expect(keyIsWithinAnyInterval('2024-06-13', intervals)).toBe(true);
        expect(keyIsWithinAnyInterval('2024-12-25', intervals)).toBe(true);
        expect(keyIsWithinAnyInterval('2024-06-14', intervals)).toBe(false);
        expect(keyIsWithinAnyInterval('2024-06-12', [])).toBe(false);
    });
});

describe('expandIntervalsToDayKeys', () => {
    it('expands every interval to its inclusive day keys', () => {
        expect(
            expandIntervalsToDayKeys([
                { startDate: '2024-06-12', endDate: '2024-06-14' },
                { startDate: '2024-12-25', endDate: '2024-12-25' },
            ])
        ).toEqual([
            '2024-06-12',
            '2024-06-13',
            '2024-06-14',
            '2024-12-25',
        ]);
        expect(expandIntervalsToDayKeys([])).toEqual([]);
    });
});
