import { TZDate } from '@date-fns/tz';
import { getConfiguredTimezone } from './settings';


function resolveTz(tz?: string): string {
    return tz ?? getConfiguredTimezone();
}

function toMs(utcMs: number | Date): number {
    return typeof utcMs === 'number' ? utcMs : utcMs.getTime();
}

/** "YYYY-MM-DD" of a stored UTC instant in the given time-zone. */
export function dateKeyInTz(utcMs: number | Date, tz?: string): string {
    const td = new TZDate(toMs(utcMs), resolveTz(tz));
    const y = td.getFullYear();
    const m = String(td.getMonth() + 1).padStart(2, '0');
    const d = String(td.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Start (inclusive) / end (exclusive) of a local day ("YYYY-MM-DD") as UTC instants. */
export function dayRange(dateKeyStr: string, tz?: string): { start: Date; end: Date } {
    const t = resolveTz(tz);
    const [y, m, d] = dateKeyStr.split('-').map(Number);
    const startMs = new TZDate(`${dateKeyStr}T00:00`, t).getTime();
    const next = d + 1;
    const endMs = new TZDate(
        `${y}-${String(m).padStart(2, '0')}-${String(next).padStart(2, '0')}T00:00`
    ).getTime();
    return { start: new Date(startMs), end: new Date(endMs) };
}

/** A UTC instant at the given clock time ("HH:MM") on a local day ("YYYY-MM-DD"). */
export function dayTimestamp(dateKeyStr: string, hhmm: string, tz?: string): Date {
    const t = resolveTz(tz);
    return new Date(new TZDate(`${dateKeyStr}T${hhmm}`, t).getTime());
}

/** Start of the local day containing a stored UTC instant. */
export function startOfDay(utcMs: number | Date, tz?: string): Date {
    const key = dateKeyInTz(utcMs, tz);
    return dayRange(key, tz).start;
}

/** Start / end (UTC instants) of the current day in the configured time-zone. */
export function todayRange(tz?: string): { start: Date; end: Date } {
    const now = new Date().getTime(); // absolute "now" in UTC ms, independent of server TZ
    const key = dateKeyInTz(now, tz);
    return dayRange(key, tz);
}

/** Format a stored UTC instant as local clock time ("HH:MM") for the given zone. */
export function formatTime(utcMs: number | Date, tz?: string, locale?: string): string {
    const t = resolveTz(tz);
    const loc = locale || 'ca';
    return new Intl.DateTimeFormat(loc, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: t,
    }).format(new Date(toMs(utcMs)));
}
