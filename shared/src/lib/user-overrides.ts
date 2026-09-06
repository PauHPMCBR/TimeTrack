/**
 * Per-user overrides of the company-wide settings: a user may define their own
 * working week days and expected work hours. These helpers encode the fallback
 * rule (user override if set, else the company value) so every consumer
 * resolves them identically.
 */

export interface UserWorkDaysOverride {
    workDays?: number[];
}

export interface UserExpectedWorkHoursOverride {
    expectedWorkHours?: number;
}

export function resolveWorkDays(
    user: UserWorkDaysOverride | null | undefined,
    fallback: number[]
): number[] {
    return Array.isArray(user?.workDays) && user.workDays.length > 0
        ? (user.workDays as number[])
        : fallback;
}

export function resolveExpectedWorkHours(
    user: UserExpectedWorkHoursOverride | null | undefined,
    fallback: number
): number {
    return user?.expectedWorkHours ?? fallback;
}

export interface UserWorkDaysOwner {
    workDays?: number[];
}

/**
 * Non-working week days for a user. `user.workDays` stores the user's
 * *working* days (see the user editor), so a custom override means the
 * complement; without an override the company-wide non-working days apply.
 */
export function resolveNonWorkingDays(
    user: UserWorkDaysOwner | null | undefined,
    fallbackNonWorkingDays: number[]
): number[] {
    const workDays = user?.workDays;
    if (Array.isArray(workDays) && workDays.length > 0) {
        const allDays = [0, 1, 2, 3, 4, 5, 6];
        return allDays.filter((d) => !workDays.includes(d));
    }
    return fallbackNonWorkingDays;
}
