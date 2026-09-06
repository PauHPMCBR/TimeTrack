/**
 * Year/month date-range helpers. All bounds are **server-local** calendar
 * dates (same convention as the stored date columns they are compared
 * against). Year ranges are inclusive on both ends; month ranges are
 * inclusive start / exclusive end (the next month's first day).
 */

export interface DateRange {
    start: Date;
    end: Date;
}

/** Inclusive [Jan 1 00:00, Dec 31 23:59:59.999] of a year. */
export function yearRange(year: number): DateRange {
    return {
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31, 23, 59, 59, 999),
    };
}

/** Inclusive first day / exclusive first-day-of-next-month of a month (1-indexed). */
export function monthRange(year: number, month: number): DateRange {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end =
        month === 12
            ? new Date(year + 1, 0, 1)
            : new Date(year, month, 1);
    return { start, end };
}

/** Number of days in a month (1-indexed month). */
export function daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}
