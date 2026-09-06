import { TZDate } from '@date-fns/tz';

/**
 * "YYYY-MM-DD" of an instant in the given IANA time-zone (runtime-local zone
 * when omitted). Single source of truth for day-key resolution — backend
 * (stored-UTC-instant → company-local day) and frontend (local runtime) both
 * delegate here.
 */
export function dateKeyInTz(
    utcMs: number | Date,
    timeZone?: string
): string {
    const ms = typeof utcMs === 'number' ? utcMs : utcMs.getTime();
    const td = new TZDate(ms, timeZone);
    const y = td.getFullYear();
    const m = String(td.getMonth() + 1).padStart(2, '0');
    const d = String(td.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
