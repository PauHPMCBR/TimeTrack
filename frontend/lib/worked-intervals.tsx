import type { ReactNode } from 'react';
import {
    pairSessions,
    type DaySessionLike,
} from 'shared/src/lib/work-hours';
import type { TimeKey } from 'shared/src/lib/time-key';
import { Clock, AlertTriangle } from 'lucide-react';

export const MISSING_TIME = '—';

/** One end of a worked interval: a wall clock, or the missing-time marker. */
export type WorkedIntervalEnd = TimeKey | typeof MISSING_TIME;

export interface WorkedInterval {
    checkIn: WorkedIntervalEnd;
    checkOut: WorkedIntervalEnd;
    overtime: boolean;
    // One of the ends is missing (forgotten check-out/in, or a session
    // still in progress).
    unclosed: boolean;
    problem: boolean;
}

export function workedIntervals(
    sessions: DaySessionLike[]
): WorkedInterval[] {
    const sorted = [...sessions].sort((a, b) => a.time.localeCompare(b.time));

    return pairSessions(sorted).map((pair) => {
        const unclosed = !pair.entry || !pair.leave;
        return {
            checkIn: pair.entry?.time ?? MISSING_TIME,
            checkOut: pair.leave?.time ?? MISSING_TIME,
            overtime: pair.overtime,
            unclosed,
            problem: unclosed,
        };
    });
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
