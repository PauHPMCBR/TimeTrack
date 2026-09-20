// Configured company time-zone used to resolve "today" and the current wall
// clock time. set via initConfiguredTimezone() when
// AppSettings are loaded (e.g. on the admin settings page).

import {
    dateKeyInTz,
    timeKeyInTz,
    type DateKey,
} from 'shared/src/lib/day-key';
import type { TimeKey } from 'shared/src/lib/time-key';
import { DEFAULT_TIMEZONE } from 'shared/src/lib/defaults';

let configured: string = DEFAULT_TIMEZONE;

export function initConfiguredTimezone(tz: string): void {
    if (tz) configured = tz;
}

export function configuredTimezone(): string {
    return configured;
}

export function todayKey(): DateKey {
    return dateKeyInTz(Date.now(), configuredTimezone());
}

export function nowWallTime(): TimeKey {
    return timeKeyInTz(Date.now(), configuredTimezone());
}
