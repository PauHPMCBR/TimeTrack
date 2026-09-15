import { describe, it, expect } from 'vitest';
import {
    nonWorkingDaysOfWeek,
    resolveDayExpectedHours,
    resolveWeeklyExpectedHours,
    resolveWeekTimetable,
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

    it('falls back to the company values without any user override', () => {
        expect(
            resolveWeeklyExpectedHours(null, [0, 8, 8, 8, 8, 8, 0])
        ).toEqual([0, 8, 8, 8, 8, 8, 0]);
    });

    it('throws on a user with missing or invalid weeklyExpectedHours instead of falling back', () => {
        expect(() => resolveWeeklyExpectedHours({}, [0, 8, 8, 8, 8, 8, 0])).toThrow();
        expect(() =>
            resolveWeeklyExpectedHours(
                { weeklyExpectedHours: [0, -2, 8, undefined, 8, 8, 0] } as {
                    weeklyExpectedHours?: number[];
                },
                [0, 8, 8, 8, 8, 8, 0]
            )
        ).toThrow();
        expect(() =>
            resolveWeeklyExpectedHours(
                { weeklyExpectedHours: [0, 8, 8, 8, 8, 8] },
                [0, 8, 8, 8, 8, 8, 0]
            )
        ).toThrow();
    });
});

describe('resolveDayExpectedHours', () => {
    it('returns the day value (0h = non-working day)', () => {
        const user = { weeklyExpectedHours: [0, 8, 8, 8, 8, 6, 0] };
        expect(resolveDayExpectedHours(user, 5, [0, 8, 8, 8, 8, 8, 0])).toBe(6);
        expect(resolveDayExpectedHours(user, 0, [0, 8, 8, 8, 8, 8, 0])).toBe(0);
    });
});

describe('resolveWeekTimetable', () => {
    const fallback = [
        [],
        [{ checkIn: '09:00', checkOut: '17:00' }],
        [{ checkIn: '09:00', checkOut: '17:00' }],
        [{ checkIn: '09:00', checkOut: '17:00' }],
        [{ checkIn: '09:00', checkOut: '17:00' }],
        [{ checkIn: '09:00', checkOut: '17:00' }],
        [],
    ];

    it('returns the stored timetable when complete', () => {
        const user = {
            scheduleMode: 'timetable' as const,
            timetable: [
                [],
                [{ checkIn: '08:00', checkOut: '15:00' }],
                [{ checkIn: '08:00', checkOut: '15:00' }],
                [{ checkIn: '08:00', checkOut: '15:00' }],
                [{ checkIn: '08:00', checkOut: '15:00' }],
                [{ checkIn: '08:00', checkOut: '15:00' }],
                [],
            ],
        };
        expect(resolveWeekTimetable(user, fallback)).toBe(user.timetable);
    });

    it('returns the fallback for hours-mode users with no timetable (no throw)', () => {
        const user = { scheduleMode: 'hours' as const };
        expect(resolveWeekTimetable(user, fallback)).toBe(fallback);
    });

    it('throws when a timetable-mode user has no valid stored timetable', () => {
        const user = { scheduleMode: 'timetable' as const };
        expect(() => resolveWeekTimetable(user, fallback)).toThrow();
    });

    it('accepts an all-empty timetable (a valid never-working configuration)', () => {
        const user = {
            scheduleMode: 'timetable' as const,
            timetable: [[], [], [], [], [], [], []],
        };
        expect(resolveWeekTimetable(user, fallback)).toBe(user.timetable);
    });
});
