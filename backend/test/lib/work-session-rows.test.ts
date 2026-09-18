import { describe, it, expect, vi } from 'vitest';
import { buildWorkSessionRows, workDayRecordMap } from '@/lib/work-session-rows';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/models', () => ({
    AppSettings: {},
}));
import type {
    UserRow,
    WorkSessionRow,
    WorkDayRecordRow,
} from '@/lib/rows';
import type { DateKey } from 'shared/src/lib/day-key';
import { defaultTimetable } from 'shared/src/schemas/database';

const MONDAY = new Date(2024, 0, 15, 0, 0, 0);
const MONDAY_KEY = '2024-01-15' as DateKey;
const SUNDAY = new Date(2024, 0, 21, 0, 0, 0);
const SUNDAY_KEY = '2024-01-21' as DateKey;

const makeUser = (overrides: Record<string, unknown> = {}) =>
    ({
        _id: 'u1',
        name: 'User',
        email: 'user@example.com',
        dni: '12345678A',
        scheduleMode: 'hours',
        timetable: defaultTimetable(),
        weeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0],
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

const makeRecord = (
    date: DateKey,
    overrides: Record<string, unknown> = {}
) =>
    ({
        _id: `rec-${date}`,
        userId: 'u1',
        date,
        classification: 'workday',
        checkMode: 'hours',
        timetableIntervals: [],
        expectedHours: 8,
        toleranceMinutes: 60,
        timetableToleranceMinutes: 10,
        anomalies: [],
        source: 'system',
        computedAt: new Date(),
        ...overrides,
    }) as unknown as WorkDayRecordRow;

const buildCtx = (overrides: Record<string, unknown> = {}) => ({
    days: [MONDAY_KEY],
    users: [makeUser()],
    sessions: [] as WorkSessionRow[],
    approvedVacations: [],
    yearlyTemplates: [],
    authorizedLeaves: [],
    records: new Map<string, WorkDayRecordRow>(),
    defaultWeeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0],
    toleranceMinutes: 60,
    timetableToleranceMinutes: 10,
    ...overrides,
});

describe('buildWorkSessionRows — closed days (from the WorkDayRecord)', () => {
    it('is ok when the record has no anomalies', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                records: workDayRecordMap([
                    makeRecord(MONDAY_KEY, {
                        checkMode: 'timetable',
                        timetableIntervals: [
                            { checkIn: '09:00', checkOut: '17:00' },
                        ],
                    }),
                ]),
                sessions: [
                    makeSession('check_in', MONDAY, 9),
                    makeSession('check_out', MONDAY, 17),
                ],
            })
        );
        expect(rows[0].status).toBe('ok');
        expect(rows[0].dayClassification).toBe('workday');
        expect(rows[0].anomalies).toEqual([]);
        expect(rows[0].expectedHours).toBe(8);
    });

    it('replays the cached anomalies from the record without recomputing', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                records: workDayRecordMap([
                    makeRecord(MONDAY_KEY, {
                        anomalies: ['hours_short'],
                        expectedHours: 8,
                    }),
                ]),
                sessions: [
                    makeSession('check_in', MONDAY, 9),
                    makeSession('check_out', MONDAY, 17),
                ],
            })
        );
        expect(rows[0].status).toBe('anomaly');
        expect(rows[0].anomalies).toEqual(['hours_short']);
    });

    it('maps the elective-vacation classification to its row status', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                records: workDayRecordMap([
                    makeRecord(MONDAY_KEY, {
                        classification: 'electiveVacation',
                        expectedHours: 0,
                    }),
                ]),
            })
        );
        expect(rows[0].status).toBe('electiveVacation');
        expect(rows[0].anomalies).toEqual([]);
    });

    it('flags a punch on an authorized-leave day via the cached anomaly', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                records: workDayRecordMap([
                    makeRecord(MONDAY_KEY, {
                        classification: 'authorizedLeave',
                        expectedHours: 0,
                        anomalies: ['work_on_non_working_day'],
                    }),
                ]),
                sessions: [makeSession('check_in', MONDAY, 9)],
            })
        );
        expect(rows[0].status).toBe('anomaly');
        expect(rows[0].anomalies).toEqual(['work_on_non_working_day']);
    });

    it('exposes the frozen timetable intervals of the record', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                records: workDayRecordMap([
                    makeRecord(MONDAY_KEY, {
                        checkMode: 'timetable',
                        timetableIntervals: [
                            { checkIn: '08:00', checkOut: '12:00' },
                            { checkIn: '13:00', checkOut: '17:00' },
                        ],
                    }),
                ]),
            })
        );
        expect(rows[0].timetable).toEqual([
            { checkIn: '08:00', checkOut: '12:00' },
            { checkIn: '13:00', checkOut: '17:00' },
        ]);
        expect(rows[0].expectedHours).toBe(8);
    });
});

describe('buildWorkSessionRows — planned days (no record yet)', () => {
    it('shows a would-be workday as planned with no anomaly judgment', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                sessions: [
                    makeSession('check_in', MONDAY, 9),
                    makeSession('check_out', MONDAY, 15),
                ],
            })
        );
        expect(rows[0].status).toBe('planned');
        expect(rows[0].dayClassification).toBe('workday');
        expect(rows[0].anomalies).toEqual([]);
        expect(rows[0].expectedHours).toBe(8);
        expect(rows[0].totalHours).toBe(6);
    });

    it('derives a non-working weekday classification live', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                days: [SUNDAY_KEY],
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

    it('derives elective vacations and authorized leaves live for future days', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                approvedVacations: [
                    {
                        _id: 'v1',
                        userId: 'u1',
                        startDate: MONDAY_KEY,
                        endDate: MONDAY_KEY,
                        status: 'approved',
                    },
                ] as never,
                authorizedLeaves: [
                    {
                        _id: 'l1',
                        userId: 'u1',
                        startDate: SUNDAY_KEY,
                        endDate: SUNDAY_KEY,
                    },
                ] as never,
                days: [MONDAY_KEY, SUNDAY_KEY],
            })
        );
        expect(rows[0].status).toBe('electiveVacation');
        expect(rows[1].status).toBe('authorizedLeave');
    });

    it('planned timetable days expose the expected intervals without judging', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                users: [makeUser({ scheduleMode: 'timetable' })],
            })
        );
        expect(rows[0].status).toBe('planned');
        expect(rows[0].timetable).toEqual([
            { checkIn: '09:00', checkOut: '17:00' },
        ]);
    });

    it('checks punch clock times in the company zone, not the runtime zone', () => {
        const sessions = [
            {
                _id: 'in',
                userId: 'u1',
                type: 'check_in',
                timestamp: new Date('2024-01-15T08:00:00Z'),
                status: 'active',
            },
            {
                _id: 'out',
                userId: 'u1',
                type: 'check_out',
                timestamp: new Date('2024-01-15T16:00:00Z'),
                status: 'active',
            },
        ] as unknown as WorkSessionRow[];
        const rows = buildWorkSessionRows(
            buildCtx({
                users: [makeUser({ scheduleMode: 'timetable' })],
                sessions,
                timezone: 'Europe/Madrid',
            })
        );
        expect(rows[0].date).toBe('2024-01-15');
        expect(rows[0].status).toBe('planned');
        expect(rows[0].dayClassification).toBe('workday');
    });
});
