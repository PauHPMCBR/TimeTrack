// Configured company time-zone used for displaying stored UTC instants as local
// clock times. set via initConfiguredTimezone() when
// AppSettings are loaded (e.g. on the admin settings page). Display uses native
// Intl.DateTimeFormat with timeZone so it respects DST automatically.

import { DEFAULT_TIMEZONE } from 'shared/src/lib/defaults';

let configured: string = DEFAULT_TIMEZONE;

export function initConfiguredTimezone(tz: string): void {
    if (tz) configured = tz;
}

export function configuredTimezone(): string {
    return configured;
}

/** Format a stored UTC instant as "HH:MM" in the configured company zone. */
export function formatClockHM(
    utcMs: number | string | Date,
    locale?: string
): string {
    const t = configuredTimezone();
    const loc = locale || 'ca';
    return new Intl.DateTimeFormat(loc, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: t,
    }).format(new Date(utcMs));
}

/** Format a stored UTC instant as "YYYY-MM-DDTHH:mm" wall time in the
 * configured company zone (the format the day editor exchanges with the
 * backend, which interprets naive timestamps in the company zone). */
export function toZonedWallString(utcMs: number | Date): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: configuredTimezone(),
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).formatToParts(new Date(utcMs));
    const get = (type: string) =>
        parts.find((p) => p.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
