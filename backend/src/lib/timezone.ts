import { TZDate } from '@date-fns/tz';
import {
    addDaysToKey,
    dateKeyInTz as sharedDateKeyInTz,
    timeKeyInTz as sharedTimeKeyInTz,
    DateKey,
} from 'shared/src/lib/day-key';
import type { TimeKey } from 'shared/src/lib/time-key';
import { getConfiguredTimezone } from './settings';


function resolveTz(tz?: string): string {
    return tz ?? getConfiguredTimezone();
}

/** DateKey of a stored UTC instant in the given time-zone (defaults to the configured company zone). */
export function dateKeyInTz(utcMs: number | Date, tz?: string): DateKey {
    return sharedDateKeyInTz(utcMs, resolveTz(tz));
}

/** Wall clock ("HH:MM") of a UTC instant in the given time-zone. */
export function timeKeyInTz(utcMs: number | Date, tz?: string): TimeKey {
    return sharedTimeKeyInTz(utcMs, resolveTz(tz));
}

/** Company-zone wall clock right now: the (date, HH:MM) pair a live punch stores. */
export function nowWallClock(tz?: string): { date: DateKey; time: TimeKey } {
    const t = resolveTz(tz);
    const ms = Date.now();
    return {
        date: sharedDateKeyInTz(ms, t),
        time: sharedTimeKeyInTz(ms, t),
    };
}

/**
 * Start (inclusive) / end (exclusive) of a calendar day as UTC instants.
 * Only needed to window fields that remain instants (audit-event stamps);
 * work sessions are stored as (date, time) strings and never need this.
 */
export function dayRange(dateKeyStr: DateKey, tz?: string): { start: Date; end: Date } {
    const t = resolveTz(tz);
    const [y, m, d] = parseKeyParts(dateKeyStr);
    const startMs = new TZDate(y, m, d, 0, 0, t).getTime();
    const nextKey = addDaysToKey(dateKeyStr, 1);
    const [ny, nm, nd] = parseKeyParts(nextKey);
    const endMs = new TZDate(ny, nm, nd, 0, 0, t).getTime();
    return { start: new Date(startMs), end: new Date(endMs) };
}

function parseKeyParts(dateKeyStr: DateKey): [number, number, number] {
    const [y, m, d] = dateKeyStr.split('-').map(Number);
    return [y, m - 1, d];
}
