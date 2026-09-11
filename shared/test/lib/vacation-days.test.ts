import { describe, it, expect } from 'vitest';
import {
    countSpentVacationDays,
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

    it('falls back to the company-wide non-working days', () => {
        expect(resolveNonWorkingDays(undefined, [0, 6])).toEqual([0, 6]);
        expect(resolveNonWorkingDays({}, [6, 0])).toEqual([6, 0]);
        expect(resolveNonWorkingDays({ weeklyExpectedHours: [] }, [0, 6])).toEqual([0, 6]);
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
});

describe('countSpentVacationDays', () => {
    const d = (s: string) => new Date(s);

    it('counts every calendar day in the interval', () => {
        // Wed → Thu.
        expect(
            countSpentVacationDays(d('2024-06-12T00:00'), d('2024-06-13T00:00'), [], [])
        ).toBe(2);
        expect(countSpentVacationDays(d('2024-06-12T00:00'), d('2024-06-12T00:00'), [], [])).toBe(1);
    });

    it('excludes non-working week days', () => {
        // Fri → Mon spans a weekend.
        expect(
            countSpentVacationDays(
                d('2024-06-14T00:00'),
                d('2024-06-17T00:00'),
                [0, 6],
                []
            )
        ).toBe(2);
    });

    it('excludes obligatory days', () => {
        expect(
            countSpentVacationDays(
                d('2024-06-12T00:00'),
                d('2024-06-13T00:00'),
                [],
                [d('2024-06-13T00:00')]
            )
        ).toBe(1);
    });

    it('returns 0 for an inverted interval', () => {
        expect(
            countSpentVacationDays(d('2024-06-14T00:00'), d('2024-06-13T00:00'), [], [])
        ).toBe(0);
    });

    it('resolves day bounds in the given time-zone', () => {
        // In Madrid these instants fall on Fri 2024-06-14 and Mon 2024-06-17.
        expect(
            countSpentVacationDays(
                d('2024-06-13T22:00:00Z'),
                d('2024-06-17T21:00:00Z'),
                [0, 6],
                [],
                'Europe/Madrid'
            )
        ).toBe(2); // Fri + Mon; the weekend in between is not discounted.
    });
});
