/**
 * Per-user overrides of the company-wide settings: a user may define their own
 * non-working week days and expected work hours. These helpers encode the
 * fallback rule (user override if set, else the company value) so every
 * consumer resolves them identically.
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
