import { describe, it, expect } from 'vitest';
import {
    nonWorkingDaysOfWeek,
    resolveDayExpectedHours,
    resolveWeeklyExpectedHours,
} from '@/lib/user-overrides';

describe('nonWorkingDaysOfWeek', () => {
    it('returns the 0h weekdays', () => {
        expect(nonWorkingDaysOfWeek([0, 8, 8, 8, 8, 8, 0])).toEqual([0, 6]);
        expect(nonWorkingDaysOfWeek([8, 8, 8, 8, 8, 8, 8])).toEqual([]);
    });
});

describe('resolveWeeklyExpectedHours', () => {
    it('uses the per-weekday array when present', () => {
        const user = {
            weeklyExpectedHours: [0, 9, 9, 9, 9, 5, 0],
        };
        expect(
            resolveWeeklyExpectedHours(user, [0, 8, 8, 8, 8, 8, 0])
        ).toEqual([0, 9, 9, 9, 9, 5, 0]);
    });

    it('ignores negative or missing values in the array', () => {
        const user = {
            weeklyExpectedHours: [0, -2, 8, undefined, 8, 8, 0],
        } as { weeklyExpectedHours?: number[] };
        expect(
            resolveWeeklyExpectedHours(user, [0, 8, 8, 8, 8, 8, 0])[1]
        ).toBe(0);
        expect(
            resolveWeeklyExpectedHours(user, [0, 8, 8, 8, 8, 8, 0])[3]
        ).toBe(0);
    });


    it('falls back to the company values without any user override', () => {
        expect(
            resolveWeeklyExpectedHours(null, [0, 8, 8, 8, 8, 8, 0])
        ).toEqual([0, 8, 8, 8, 8, 8, 0]);
    });
});

describe('resolveDayExpectedHours', () => {
    it('returns the day value (0h = non-working day)', () => {
        const user = { weeklyExpectedHours: [0, 8, 8, 8, 8, 6, 0] };
        expect(resolveDayExpectedHours(user, 5, [0, 8, 8, 8, 8, 8, 0])).toBe(6);
        expect(resolveDayExpectedHours(user, 0, [0, 8, 8, 8, 8, 8, 0])).toBe(0);
    });
});
