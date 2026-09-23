import { z } from 'zod';
import { TZDate } from '@date-fns/tz';
import type { TimeKey } from './time-key';

export const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateKey(value: string): boolean {
    if (!DATE_KEY_REGEX.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    return m >= 1 && m <= 12 && d >= 1 && d <= new Date(y, m, 0).getDate();
}

export const DateKeySchema = z
    .string()
    .regex(DATE_KEY_REGEX, 'Invalid date key, expected YYYY-MM-DD')
    .refine(isValidDateKey, 'Invalid date')
    .brand<'DateKey'>();
export type DateKey = z.infer<typeof DateKeySchema>;

/** A calendar month, 1-indexed. */
export type YearMonth = { year: number; month: number };

// Inclusive day-key interval with optional free text; the shared base of
// elective vacations, authorized leaves and obligatory vacation intervals.
export type DateKeyInterval = {
    startDate: DateKey;
    endDate: DateKey;
    notes?: string;
};

// @zodyac/zod-mongoose cannot map branded types: database schemas use this
// unbranded equivalent and the row types re-brand the fields to `DateKey`.
export function dateKeyField() {
    return z
        .string()
        .regex(DATE_KEY_REGEX, 'Invalid date key, expected YYYY-MM-DD')
        .refine(isValidDateKey, 'Invalid date');
}

export function dateKeyOfTodayRuntime(timeZone = 'Europe/Madrid'): DateKey {
    return dateKeyInTz(Date.now(), timeZone);
}

/** Wall clock ("HH:MM") of a UTC instant in the given time-zone. */
export function timeKeyInTz(utcMs: number | Date, timeZone?: string): TimeKey {
    const ms = typeof utcMs === 'number' ? utcMs : utcMs.getTime();
    const td = new TZDate(ms, timeZone);
    const h = String(td.getHours()).padStart(2, '0');
    const m = String(td.getMinutes()).padStart(2, '0');
    return `${h}:${m}` as TimeKey;
}

export function dateKeyFromParts(y: number, m: number, d: number): DateKey {
    const key = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!isValidDateKey(key)) throw new Error(`Invalid date: ${key}`);
    return key as DateKey;
}

export function dateKeyInTz(utcMs: number | Date, timeZone?: string): DateKey {
    const ms = typeof utcMs === 'number' ? utcMs : utcMs.getTime();
    const td = new TZDate(ms, timeZone);
    const y = td.getFullYear();
    const m = String(td.getMonth() + 1).padStart(2, '0');
    const d = String(td.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}` as DateKey;
}

/** Number of days in a month (1-indexed month). */
export function daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

export function dowFromDateKey(key: DateKey): number {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDaysToKey(key: DateKey, days: number): DateKey {
    const [y, m, d] = key.split('-').map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d));
    utc.setUTCDate(utc.getUTCDate() + days);
    const yy = String(utc.getUTCFullYear()).padStart(4, '0');
    const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(utc.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}` as DateKey;
}
