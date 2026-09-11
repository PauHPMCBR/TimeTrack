import { dateKeyInTz } from './day-key';

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

/**
 * Whether a calendar day (truncated to local midnight) falls within an
 * inclusive [start, end] vacation interval.
 */
export function dayIsWithinInterval(
    date: Date,
    start: Date | string,
    end: Date | string
): boolean {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(0, 0, 0, 0);
    return day.getTime() >= s.getTime() && day.getTime() <= e.getTime();
}

/**
 * Elective vacation days a closed interval costs: calendar days in
 * [startDate, endDate] (inclusive) minus non-working week days and company
 * obligatory days. Day bounds are resolved in the company time-zone and the
 * iteration walks day keys, so it is DST-safe.
 */
export function countSpentVacationDays(
    startDate: Date,
    endDate: Date,
    nonWorkingDays: number[],
    obligatoryDays: (Date | string)[],
    timeZone?: string
): number {
    const obligatoryKeys = new Set(
        obligatoryDays.map((day) => dateKeyInTz(new Date(day), timeZone))
    );

    const startKey = dateKeyInTz(startDate, timeZone);
    const endKey = dateKeyInTz(endDate, timeZone);
    if (startKey > endKey) return 0;

    const [y, m, d] = startKey.split('-').map(Number);
    const cursor = new Date(Date.UTC(y, m - 1, d));
    const pad = (n: number) => String(n).padStart(2, '0');

    let spent = 0;
    // Defensive cap: requests are validated to stay within one year.
    while (spent <= 366) {
        const key = `${cursor.getUTCFullYear()}-${pad(
            cursor.getUTCMonth() + 1
        )}-${pad(cursor.getUTCDate())}`;
        if (key > endKey) break;
        if (
            !nonWorkingDays.includes(cursor.getUTCDay()) &&
            !obligatoryKeys.has(key)
        ) {
            spent++;
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return spent;
}
