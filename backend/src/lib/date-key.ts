import { getConfiguredTimezone } from './settings';
import * as tz from './timezone';
import type { DateKey } from 'shared/src/lib/day-key';
import type { TimeKey } from 'shared/src/lib/time-key';

const configured = () => getConfiguredTimezone();

/** DateKey of a stored UTC instant (or naive local-midnight Date) in the configured company time-zone. */
export function dateKey(d: number | Date | string): DateKey {
    const ms =
        typeof d === 'string'
            ? new Date(d).getTime()
            : typeof d === 'number'
              ? d
              : d.getTime();
    return tz.dateKeyInTz(ms, configured());
}

/** Wall clock ("HH:MM") of a stored UTC instant in the configured company time-zone. */
export function timeKeyInTz(d: number | Date): TimeKey {
    const ms = typeof d === 'number' ? d : d.getTime();
    return tz.timeKeyInTz(ms, configured());
}
