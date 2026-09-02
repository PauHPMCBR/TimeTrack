import { getConfiguredTimezone } from './settings';
import * as tz from './timezone';

const configured = () => getConfiguredTimezone();

/** Local calendar day ("YYYY-MM-DD") of a stored UTC instant (or naive local-midnight Date) in the configured company time-zone. */
export function dateKey(d: number | Date | string): string {
    const ms =
        typeof d === 'string'
            ? new Date(d).getTime()
            : typeof d === 'number'
              ? d
              : d.getTime();
    return tz.dateKeyInTz(ms, configured());
}
