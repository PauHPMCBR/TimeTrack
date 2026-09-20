import { dowFromDateKey, addDaysToKey } from './day-key';
import type { DateKey, DateKeyInterval } from './day-key';

// Override resolution moved to user-overrides.ts; re-exported here so
// existing imports keep working.
export {
    nonWorkingDaysOfWeek,
    resolveNonWorkingDays,
} from './user-overrides';

/**
 * Elective vacation day accounting, shared by the backend (request
 * validation / storage) and the frontend (request-form preview) so both
 * compute the cost of a period identically.
 */

export function keyIsWithinInterval(
    key: DateKey,
    start: DateKey,
    end: DateKey
): boolean {
    return key >= start && key <= end;
}

export function keyIsWithinAnyInterval(
    key: DateKey,
    intervals: DateKeyInterval[] | undefined
): boolean {
    return (intervals ?? []).some((interval) =>
        keyIsWithinInterval(key, interval.startDate, interval.endDate)
    );
}

export function expandIntervalsToDayKeys(
    intervals: DateKeyInterval[] | undefined
): DateKey[] {
    const keys: DateKey[] = [];
    for (const interval of intervals ?? []) {
        for (
            let key = interval.startDate;
            key <= interval.endDate;
            key = addDaysToKey(key, 1)
        ) {
            keys.push(key);
        }
    }
    return keys;
}

export function countSpentVacationDays(
    startDate: DateKey,
    endDate: DateKey,
    nonWorkingDays: number[],
    obligatoryIntervals: DateKeyInterval[]
): number {
    if (startDate > endDate) return 0;

    let spent = 0;
    for (
        let key = startDate;
        spent <= 366;
        key = addDaysToKey(key, 1)
    ) {
        if (key > endDate) break;
        if (
            !nonWorkingDays.includes(dowFromDateKey(key)) &&
            !keyIsWithinAnyInterval(key, obligatoryIntervals)
        ) {
            spent++;
        }
    }
    return spent;
}
