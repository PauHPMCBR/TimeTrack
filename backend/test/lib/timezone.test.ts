import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { dateKeyInTz, timeKeyInTz, nowWallClock, dayRange } from '@/lib/timezone';
import type { DateKey } from 'shared/src/lib/day-key';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

const PREVIOUS_TZ = process.env.TZ;

describe('timezone helpers (system-TZ independence)', () => {
    beforeAll(() => {
        process.env.TZ = 'UTC';
    });

    afterAll(() => {
        process.env.TZ = PREVIOUS_TZ;
    });

    describe('dayRange (audit-event stamp windows only)', () => {
        it('spans the Madrid local day, not the UTC day', () => {
            const { start, end } = dayRange('2026-09-19' as DateKey);
            expect(start.toISOString()).toBe('2026-09-18T22:00:00.000Z');
            expect(end.toISOString()).toBe('2026-09-19T22:00:00.000Z');
        });

        it('handles a DST transition day without clipping', () => {
            const { start, end } = dayRange('2026-03-29' as DateKey);
            expect(start.toISOString()).toBe('2026-03-28T23:00:00.000Z');
            expect(end.toISOString()).toBe('2026-03-29T22:00:00.000Z');
        });
    });

    describe('dateKeyInTz', () => {
        it('resolves a UTC instant to the company-zone calendar day', () => {
            expect(dateKeyInTz(new Date('2026-09-19T20:20:00Z'), 'Europe/Madrid')).toBe(
                '2026-09-19'
            );
        });

        it('rolls to the next key past the zone midnight', () => {
            expect(dateKeyInTz(new Date('2026-09-19T22:30:00Z'), 'Europe/Madrid')).toBe(
                '2026-09-20'
            );
        });
    });

    describe('timeKeyInTz', () => {
        it('resolves a UTC instant to the zone wall clock', () => {
            expect(timeKeyInTz(new Date('2026-09-19T20:20:00Z'), 'Europe/Madrid')).toBe(
                '22:20'
            );
        });

        it('resolves a clock time in winter (CET, +1)', () => {
            expect(timeKeyInTz(new Date('2026-01-15T07:00:00Z'), 'Europe/Madrid')).toBe(
                '08:00'
            );
        });
    });

    describe('nowWallClock', () => {
        let dateNowSpy: ReturnType<typeof vi.spyOn>;

        afterEach(() => {
            dateNowSpy.mockRestore();
        });

        it('returns the zone wall clock pair for the current instant', () => {
            dateNowSpy = vi
                .spyOn(Date, 'now')
                .mockReturnValue(new Date('2024-06-10T10:00:00Z').getTime());
            expect(nowWallClock('Europe/Madrid')).toEqual({
                date: '2024-06-10',
                time: '12:00',
            });
        });
    });
});
