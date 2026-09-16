import type { ReactNode } from 'react';
import { CHECK_IN } from 'shared/src/lib/constants';
import { formatClockHM } from '@/lib/timezone';
import type { TimetableEntry } from '@/lib/timetable';
import { Clock, AlertTriangle } from 'lucide-react';

export const MISSING_TIME = '—';

export interface WorkedInterval extends TimetableEntry {
    overtime: boolean;
    // One of the ends is missing (forgotten check-out/in, or a session
    // still in progress).
    unclosed: boolean;
    problem: boolean;
}

type WorkedSessionLike = {
    type: 'check_in' | 'check_out';
    timestamp: Date | string;
    overtime?: boolean;
};

// Pairs a day's punches into worked intervals, mirroring the pairing rules
// of `computeDayHours` (shared/src/lib/work-hours.ts): an unmatched check-out
// opens with a missing check-in, and a trailing open check-in stays unclosed.
export function workedIntervals(
    sessions: WorkedSessionLike[],
    locale: string
): WorkedInterval[] {
    const fmtTime = (ts: Date | string) => formatClockHM(ts, locale);
    const sorted = [...sessions].sort(
        (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const raw: Array<{
        checkIn: string;
        checkOut: string;
        overtime: boolean;
        unclosed: boolean;
    }> = [];
    let open: { checkIn: string; overtime: boolean } | null = null;

    for (const s of sorted) {
        const time = fmtTime(s.timestamp);
        if (s.type === CHECK_IN) {
            if (open) {
                raw.push({
                    checkIn: open.checkIn,
                    checkOut: MISSING_TIME,
                    overtime: open.overtime,
                    unclosed: true,
                });
            }
            open = { checkIn: time, overtime: s.overtime === true };
        } else if (open) {
            raw.push({
                checkIn: open.checkIn,
                checkOut: time,
                overtime: open.overtime || s.overtime === true,
                unclosed: false,
            });
            open = null;
        } else {
            raw.push({
                checkIn: MISSING_TIME,
                checkOut: time,
                overtime: s.overtime === true,
                unclosed: true,
            });
        }
    }
    if (open) {
        raw.push({
            checkIn: open.checkIn,
            checkOut: MISSING_TIME,
            overtime: open.overtime,
            unclosed: true,
        });
    }

    return raw.map((interval) => ({ ...interval, problem: interval.unclosed }));
}

export type WorkedIntervalTone = 'ok' | 'overtime' | 'problem';

export function workedIntervalTone(
    interval: WorkedInterval
): WorkedIntervalTone {
    if (interval.problem) return 'problem';
    return interval.overtime ? 'overtime' : 'ok';
}

export const workedIntervalVisuals: Record<
    WorkedIntervalTone,
    { className: string; icon: ReactNode }
> = {
    ok: { className: 'bg-green-500 text-white', icon: null },
    overtime: {
        className: 'bg-purple-500 text-white',
        icon: <Clock size={12} />,
    },
    problem: {
        className: 'bg-red-500 text-white',
        icon: <AlertTriangle size={12} />,
    },
};
