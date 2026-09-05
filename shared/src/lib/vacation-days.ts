/**
 * Elective vacation day accounting, shared by the backend (request
 * validation / storage) and the frontend (request-form preview) so both
 * compute the cost of a period identically.
 */

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

/** Calendar day of an instant ("YYYY-MM-DD") in the given IANA time-zone (or the runtime's local zone when omitted). */
function dayKeyInTz(date: Date, timeZone?: string): string {
    if (!timeZone) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
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
        obligatoryDays.map((day) => dayKeyInTz(new Date(day), timeZone))
    );

    const startKey = dayKeyInTz(startDate, timeZone);
    const endKey = dayKeyInTz(endDate, timeZone);
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
