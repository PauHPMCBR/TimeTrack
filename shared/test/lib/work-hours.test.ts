import { describe, it, expect } from 'vitest';
import {
    countCompletedSessions,
    computeDayHours,
    isCoherentSequence,
} from '@/lib/work-hours';

const s = (
    type: 'check_in' | 'check_out',
    hour: number
): { type: 'check_in' | 'check_out'; timestamp: Date } => ({
    type,
    timestamp: new Date(2024, 0, 15, hour, 0, 0),
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