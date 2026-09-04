// Configured company time-zone used for displaying stored UTC instants as local
// clock times. set via initConfiguredTimezone() when
// AppSettings are loaded (e.g. on the admin settings page). Display uses native
// Intl.DateTimeFormat with timeZone so it respects DST automatically.

const DEFAULT_TIMEZONE = 'Europe/Madrid';

let configured: string = DEFAULT_TIMEZONE;

export function initConfiguredTimezone(tz: string): void {
    if (tz) configured = tz;
}

export function configuredTimezone(): string {
    return configured;
}

/** Format a stored UTC instant as "HH:MM" in the configured company zone. */
export function formatHM(utcMs: number | Date, locale?: string): string {
    const t = configuredTimezone();
    const loc = locale || 'ca';
    return new Intl.DateTimeFormat(loc, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: t,
    }).format(new Date(utcMs));
}
