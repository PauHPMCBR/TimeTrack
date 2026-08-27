// Local-time date helpers. The app buckets data by the server's local
// timezone; these build day ranges and day timestamps from a "YYYY-MM-DD" key.

/** Inclusive start / exclusive end for a whole local day ("YYYY-MM-DD"). */
export function dayRange(dateKeyStr: string): { start: Date; end: Date } {
    const [y, m, d] = dateKeyStr.split('-').map(Number);
    return {
        start: new Date(y, m - 1, d, 0, 0, 0, 0),
        end: new Date(y, m - 1, d + 1, 0, 0, 0, 0),
    };
}

/** A Date at the given clock time ("HH:MM") within a local day ("YYYY-MM-DD"). */
export function dayTimestamp(dateKeyStr: string, hhmm: string): Date {
    const [h, min] = hhmm.split(':').map(Number);
    const [y, m, d] = dateKeyStr.split('-').map(Number);
    return new Date(y, m - 1, d, h, min, 0, 0);
}

/** A new Date at 00:00:00 of the same local day. */
export function startOfDay(d: Date): Date {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

/** Inclusive start / exclusive end of the current local day. */
export function todayRange(): { start: Date; end: Date } {
    const start = startOfDay(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
}