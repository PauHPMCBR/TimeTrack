import { describe, it, expect } from 'vitest';
import {
    countCompletedSessions,
    computeDayHours,
    formatHoursMinutes,
    isCoherentSequence,
    isCurrentlyWorking,
    nextSessionType,
    openCheckIn,
    pairSessions,
    pairWorkedMinutes,
} from '@/lib/work-hours';

const hhmm = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

const s = (
    type: 'check_in' | 'check_out',
    hour: number
): { type: 'check_in' | 'check_out'; time: string } => ({
    type,
    time: hhmm(hour),
});

describe('countCompletedSessions', () => {
    it('counts a check-in/check-out pair as one completed session', () => {
        expect(
            countCompletedSessions([s('check_in', 9), s('check_out', 17)])
        ).toBe(1);
    });

    it('counts multiple completed sessions across a day', () => {
        expect(
            countCompletedSessions([
                s('check_in', 9),
                s('check_out', 13),
                s('check_in', 14),
                s('check_out', 18),
            ])
        ).toBe(2);
    });

    it('ignores isolated check-ins (forgot check-out)', () => {
        expect(countCompletedSessions([s('check_in', 9)])).toBe(0);
    });

    it('ignores isolated check-outs (forgot check-in)', () => {
        expect(countCompletedSessions([s('check_out', 17)])).toBe(0);
    });

    it('counts nothing for an empty day', () => {
        expect(countCompletedSessions([])).toBe(0);
    });

    it('still pairs when extra unmatched events precede a pair', () => {
        expect(
            countCompletedSessions([
                s('check_out', 8),
                s('check_in', 9),
                s('check_out', 17),
            ])
        ).toBe(1);
    });
});

describe('computeDayHours', () => {
    it('computes hours across a paired session', () => {
        const { totalHours, anomalies } = computeDayHours([
            s('check_in', 9),
            s('check_out', 17),
        ]);
        expect(totalHours).toBe(8);
        expect(anomalies).toEqual([]);
    });
});

describe('isCoherentSequence', () => {
    it('accepts a well-formed alternating sequence', () => {
        expect(
            isCoherentSequence([
                s('check_in', 9),
                s('check_out', 17),
            ])
        ).toBe(true);
    });

    it('rejects a sequence starting with a check-out', () => {
        expect(isCoherentSequence([s('check_out', 17)])).toBe(false);
    });
});

describe('pairSessions', () => {
    it('groups entries with their following leaves', () => {
        const pairs = pairSessions([
            { ...s('check_in', 9), overtime: false },
            { ...s('check_out', 13), overtime: false },
            { ...s('check_in', 14), overtime: false },
            { ...s('check_out', 18), overtime: false },
        ]);
        expect(pairs).toHaveLength(2);
        expect(pairs[0].entry?.time).toBe(hhmm(9));
        expect(pairs[0].leave?.time).toBe(hhmm(13));
        expect(pairs[1].entry?.time).toBe(hhmm(14));
        expect(pairs[1].leave?.time).toBe(hhmm(18));
    });

    it('marks a pair as overtime when either side is flagged', () => {
        const [pair] = pairSessions([
            { ...s('check_in', 18), overtime: true },
            { ...s('check_out', 20), overtime: false },
        ]);
        expect(pair.overtime).toBe(true);
    });

    it('keeps missing sides null for unmatched sessions', () => {
        const pairs = pairSessions([
            { ...s('check_out', 8), overtime: false },
            { ...s('check_in', 9), overtime: false },
        ]);
        expect(pairs[0].entry).toBeNull();
        expect(pairs[0].leave?.time).toBe(hhmm(8));
        expect(pairs[1].entry?.time).toBe(hhmm(9));
        expect(pairs[1].leave).toBeNull();
    });
});

describe('pairWorkedMinutes / formatHoursMinutes', () => {
    it('computes the worked time of a complete pair', () => {
        const [pair] = pairSessions([
            { ...s('check_in', 9), overtime: false },
            { ...s('check_out', 17), overtime: false },
        ]);
        expect(pairWorkedMinutes(pair)).toBe(480);
        expect(formatHoursMinutes(480)).toBe('08:00');
    });

    it('returns null for an incomplete pair', () => {
        const [pair] = pairSessions([{ ...s('check_in', 9), overtime: false }]);
        expect(pairWorkedMinutes(pair)).toBeNull();
    });
});

describe('openCheckIn / isCurrentlyWorking / nextSessionType', () => {
    it('returns the trailing open check-in', () => {
        expect(
            openCheckIn([
                s('check_in', 9),
                s('check_out', 13),
                s('check_in', 14),
            ])?.time
        ).toBe(hhmm(14));
    });

    it('returns null when the last session is closed or there are none', () => {
        expect(openCheckIn([s('check_in', 9), s('check_out', 17)])).toBeNull();
        expect(openCheckIn([])).toBeNull();
    });

    it('reports whether the worker is currently checked in', () => {
        expect(isCurrentlyWorking([s('check_in', 9)])).toBe(true);
        expect(
            isCurrentlyWorking([s('check_in', 9), s('check_out', 17)])
        ).toBe(false);
    });

    it('infers the next session type from the last one', () => {
        expect(nextSessionType([])).toBe('check_in');
        expect(nextSessionType([s('check_in', 9)])).toBe('check_out');
        expect(
            nextSessionType([s('check_in', 9), s('check_out', 17)])
        ).toBe('check_in');
    });
});