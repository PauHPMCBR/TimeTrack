import { DateKey, dowFromDateKey, addDaysToKey } from './day-key';

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

export function countSpentVacationDays(
    startDate: DateKey,
    endDate: DateKey,
    nonWorkingDays: number[],
    obligatoryDays: DateKey[]
): number {
    if (startDate > endDate) return 0;
    const obligatoryKeys = new Set(obligatoryDays);

    let spent = 0;
    for (
        let key = startDate;
        spent <= 366;
        key = addDaysToKey(key, 1)
    ) {
        if (key > endDate) break;
        if (!nonWorkingDays.includes(dowFromDateKey(key)) && !obligatoryKeys.has(key)) {
            spent++;
        }
    }
    return spent;
}
