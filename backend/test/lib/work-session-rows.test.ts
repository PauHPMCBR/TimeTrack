import { describe, it, expect, vi } from 'vitest';
import { buildWorkSessionRows } from '@/lib/work-session-rows';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/models', () => ({
    AppSettings: {},
}));
import type { UserRow, WorkSessionRow } from '@/lib/rows';
import { defaultTimetable } from 'shared/src/schemas/database';

const MONDAY = new Date(2024, 0, 15, 0, 0, 0);
const SUNDAY = new Date(2024, 0, 21, 0, 0, 0);

const makeUser = (overrides: Record<string, unknown> = {}) =>
    ({
        _id: 'u1',
        name: 'User',
        email: 'user@example.com',
        dni: '12345678A',
        scheduleMode: 'hours',
        timetable: defaultTimetable(),
        checkInRequired: true,
        ...overrides,
    }) as unknown as UserRow;

const makeSession = (
    type: 'check_in' | 'check_out',
    day: Date,
    hour: number,
    minute = 0
) =>
    ({
        _id: `${type}-${hour}-${minute}`,
        userId: 'u1',
        type,
        timestamp: new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            hour,
            minute
        ),
        status: 'active',
    }) as unknown as WorkSessionRow;

const buildCtx = (overrides: Record<string, unknown> = {}) => ({
    days: [MONDAY],
    users: [makeUser()],
    sessions: [] as WorkSessionRow[],
    approvedVacations: [],
    yearlyTemplates: [],
    defaultWeeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0],
    toleranceMinutes: 60,
    timetableToleranceMinutes: 10,
    ...overrides,
});

describe('buildWorkSessionRows — hours mode', () => {
    it('is ok when regular hours are within the minutes tolerance', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                sessions: [
                    makeSession('check_in', MONDAY, 9),
                    makeSession('check_out', MONDAY, 17),
                ],
            })
        );
        expect(rows[0].status).toBe('ok');
        expect(rows[0].anomalies).toEqual([]);
    });

    it('flags hours_short beyond the minutes tolerance', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                sessions: [
                    makeSession('check_in', MONDAY, 9),
                    makeSession('check_out', MONDAY, 15),
                ],
            })
        );
        expect(rows[0].status).toBe('anomaly');
        expect(rows[0].anomalies).toEqual(['hours_short']);
    });

    it('treats a 0h weekday as a non-working day', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                users: [
                    makeUser({
                        weeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0],
                    }),
                ],
                days: [SUNDAY],
                sessions: [
                    makeSession('check_in', SUNDAY, 10),
                    makeSession('check_out', SUNDAY, 12),
                ],
            })
        );
        expect(rows[0].status).toBe('nonWorkingDay');
        expect(rows[0].anomalies).toEqual([]);
        expect(rows[0].expectedHours).toBe(0);
    });

    it('checks the band against the weekday value when per-weekday hours are set', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                users: [
                    makeUser({
                        weeklyExpectedHours: [0, 4, 8, 8, 8, 8, 0],
                    }),
                ],
                sessions: [
                    makeSession('check_in', MONDAY, 9),
                    makeSession('check_out', MONDAY, 13),
                ],
            })
        );
        expect(rows[0].status).toBe('ok');
        expect(rows[0].expectedHours).toBe(4);
    });

});

describe('buildWorkSessionRows — timetable mode', () => {
    it('is ok when punches match the timetable and exposes the expected intervals', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                users: [makeUser({ scheduleMode: 'timetable' })],
                sessions: [
                    makeSession('check_in', MONDAY, 9),
                    makeSession('check_out', MONDAY, 17),
                ],
            })
        );
        expect(rows[0].status).toBe('ok');
        expect(rows[0].expectedHours).toBe(8);
        expect(rows[0].timetable).toEqual([{ checkIn: '09:00', checkOut: '17:00' }]);
    });

    it('flags late check-ins beyond the timetable tolerance instead of hours', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                users: [makeUser({ scheduleMode: 'timetable' })],
                sessions: [
                    makeSession('check_in', MONDAY, 9, 30),
                    makeSession('check_out', MONDAY, 17, 30),
                ],
            })
        );
        expect(rows[0].status).toBe('anomaly');
        expect(rows[0].anomalies).toEqual([
            'timetable_check_in_late',
            'timetable_check_out_late',
        ]);
    });

    it('flags a missing day via the shift-count anomaly', () => {
        const rows = buildWorkSessionRows(
            buildCtx({ users: [makeUser({ scheduleMode: 'timetable' })] })
        );
        expect(rows[0].status).toBe('anomaly');
        expect(rows[0].anomalies).toEqual(['timetable_shift_count']);
    });

    it('infers non-working days from empty timetable weekdays', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                users: [makeUser({ scheduleMode: 'timetable' })],
                days: [SUNDAY],
            })
        );
        expect(rows[0].status).toBe('nonWorkingDay');
        expect(rows[0].anomalies).toEqual([]);
    });

    it('checks weekdays the user added to their timetable even if the company marks them non-working', () => {
        const sundayTimetable = defaultTimetable();
        sundayTimetable[0] = [{ checkIn: '09:00', checkOut: '17:00' }];
        const rows = buildWorkSessionRows(
            buildCtx({
                users: [
                    makeUser({
                        scheduleMode: 'timetable',
                        timetable: sundayTimetable,
                    }),
                ],
                days: [SUNDAY],
            })
        );
        expect(rows[0].status).toBe('anomaly');
        expect(rows[0].anomalies).toEqual(['timetable_shift_count']);
    });
});
