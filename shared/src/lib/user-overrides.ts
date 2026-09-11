import type { ScheduleMode, WeekTimetable } from '../schemas/database';

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

export function resolveNonWorkingDays(
    user: UserNonWorkingDaysOwner | null | undefined,
    fallbackNonWorkingDays: number[]
): number[] {
    if (
        user?.scheduleMode === 'timetable' &&
        Array.isArray(user.timetable) &&
        user.timetable.length === 7
    ) {
        return Array.from({ length: 7 }, (_, jsDay) =>
            (user.timetable?.[jsDay]?.length ?? 0) === 0 ? jsDay : -1
        ).filter((d) => d >= 0);
    }
    const weekly = user?.weeklyExpectedHours;
    if (Array.isArray(weekly) && weekly.length === 7) {
        return nonWorkingDaysOfWeek(weekly);
    }
    return fallbackNonWorkingDays;
}

export function resolveWeeklyExpectedHours(
    user: UserWeeklyExpectedHoursOwner | null | undefined,
    fallbackWeekly: number[]
): number[] {
    const weekly = user?.weeklyExpectedHours;
    if (Array.isArray(weekly) && weekly.length === 7) {
        return weekly.map((h) => (typeof h === 'number' && h > 0 ? h : 0));
    }
    return [...fallbackWeekly];
}

export function resolveDayExpectedHours(
    user: UserWeeklyExpectedHoursOwner | null | undefined,
    jsDay: number,
    fallbackWeekly: number[]
): number {
    return resolveWeeklyExpectedHours(user, fallbackWeekly)[jsDay];
}
