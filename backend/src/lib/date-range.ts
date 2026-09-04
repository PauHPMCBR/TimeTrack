// All date-bucketing uses the configured company time-zone (AppSettings.timezone,
// default Europe/Madrid). Stored timestamps are UTC instants; this module converts
// them to the local calendar day so records are correct regardless of the server TZ.

import { getConfiguredTimezone } from './settings';
import * as tz from './timezone';

const configured = () => getConfiguredTimezone();

/** Inclusive start / exclusive end for a whole local day ("YYYY-MM-DD"). */
export function dayRange(dateKeyStr: string): { start: Date; end: Date } {
    return tz.dayRange(dateKeyStr, configured());
}

/** A Date at the given clock time ("HH:MM") within a local day ("YYYY-MM-DD"). */
export function dayTimestamp(dateKeyStr: string, hhmm: string): Date {
    return tz.dayTimestamp(dateKeyStr, hhmm, configured());
}

/** A new Date at 00:00:00 of the same local day as a stored UTC instant. */
export function startOfDay(d: number | Date): Date {
    return tz.startOfDay(d, configured());
}

/** Inclusive start / exclusive end of the current local day (configured zone). */
export function todayRange(): { start: Date; end: Date } {
    return tz.todayRange(configured());
}
