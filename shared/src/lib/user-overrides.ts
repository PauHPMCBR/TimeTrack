import type { ScheduleMode, WeekTimetable } from '../schemas/database';
import { isValidWeekTimetable } from './timetable-validation';

export interface UserNonWorkingDaysOwner {
    weeklyExpectedHours?: number[];
    scheduleMode?: ScheduleMode;
    timetable?: WeekTimetable;
}

/**
 * Non-working week days for a user. Timetable mode infers them from the
 * weekdays without intervals; hours mode from the 0h weekdays; a user without
 * either gets the company-wide non-working days.
 */
export interface UserWeeklyExpectedHoursOwner {
    weeklyExpectedHours?: number[];
}

export function nonWorkingDaysOfWeek(weekly: number[]): number[] {
    return Array.from({ length: 7 }, (_, jsDay) =>
        (weekly[jsDay] ?? 0) > 0 ? -1 : jsDay
    ).filter((d) => d >= 0);
}

export function isValidWeeklyExpectedHours(weekly: unknown): boolean {
    return (
        Array.isArray(weekly) &&
        weekly.length === 7 &&
        weekly.every(
            (h) => typeof h === 'number' && Number.isFinite(h) && h >= 0
        )
    );
}

export function isValidStoredWeekTimetable(timetable: unknown): boolean {
    return (
        Array.isArray(timetable) &&
        timetable.length === 7 &&
        isValidWeekTimetable(timetable as WeekTimetable)
    );
}

export function isScheduleSourceComplete(
    user: UserNonWorkingDaysOwner | null | undefined
): boolean {
    if (!user) return false;
    if (user.scheduleMode !== 'hours' && user.scheduleMode !== 'timetable') {
        return false;
    }
    if (!isValidWeeklyExpectedHours(user.weeklyExpectedHours)) return false;
    if (
        user.scheduleMode === 'timetable' &&
        !isValidStoredWeekTimetable(user.timetable)
    ) {
        return false;
    }
    return true;
}

export function resolveNonWorkingDays(
    user: UserNonWorkingDaysOwner | null | undefined,
    fallbackNonWorkingDays: number[]
): number[] {
    if (!user) return fallbackNonWorkingDays;
    if (user.scheduleMode === 'timetable') {
        if (!isValidStoredWeekTimetable(user.timetable)) {
            throw new Error(
                'Timetable-mode user has no valid stored timetable; refusing to compute with fallback data'
            );
        }
        return Array.from({ length: 7 }, (_, jsDay) =>
            user.timetable?.[jsDay].length === 0 ? jsDay : -1
        ).filter((d) => d >= 0);
    }
    if (!isValidWeeklyExpectedHours(user.weeklyExpectedHours)) {
        throw new Error(
            'User has missing or invalid weeklyExpectedHours; refusing to compute with fallback data'
        );
    }
    return nonWorkingDaysOfWeek(user.weeklyExpectedHours as number[]);
}

export function resolveWeeklyExpectedHours(
    user: UserWeeklyExpectedHoursOwner | null | undefined,
    fallbackWeekly: number[]
): number[] {
    if (!user) return [...fallbackWeekly];
    if (!isValidWeeklyExpectedHours(user.weeklyExpectedHours)) {
        throw new Error(
            'User has missing or invalid weeklyExpectedHours; refusing to compute with fallback data'
        );
    }
    return [...(user.weeklyExpectedHours as number[])];
}

export function resolveWeekTimetable(
    user: UserNonWorkingDaysOwner | null | undefined,
    fallbackTimetable: WeekTimetable
): WeekTimetable {
    if (user?.scheduleMode === 'timetable') {
        if (!isValidStoredWeekTimetable(user.timetable)) {
            throw new Error(
                'Timetable-mode user has no valid stored timetable; refusing to compute with fallback data'
            );
        }
        return user.timetable as WeekTimetable;
    }
    return fallbackTimetable;
}

export function resolveDayExpectedHours(
    user: UserWeeklyExpectedHoursOwner | null | undefined,
    jsDay: number,
    fallbackWeekly: number[]
): number {
    return resolveWeeklyExpectedHours(user, fallbackWeekly)[jsDay];
}
