import { getConfiguredTimezone } from './settings';
import * as tz from './timezone';
import type { DateKey } from 'shared/src/lib/day-key';

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
