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
    DaySessionsRow,
    WorkDayRecordRow,
} from '@/lib/rows';
import type { DateKey } from 'shared/src/lib/day-key';
import { defaultTimetable } from 'shared/src/schemas/database';

const MONDAY_KEY = '2024-01-15' as DateKey;
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

const makeSession = (type: 'check_in' | 'check_out', hour: number, minute = 0) =>
    ({
        type,
        time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        overtime: false,
    }) as const;

const makeDayDoc = (
    day: DateKey,
    sessions: ReturnType<typeof makeSession>[],
    overrides: Record<string, unknown> = {}
) =>
    ({
        _id: `day-${day}`,
        userId: 'u1',
        date: day,
        source: 'userClick',
        sessions,
        ...overrides,
    }) as unknown as DaySessionsRow;

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
    daySessions: [] as DaySessionsRow[],
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
                daySessions: [
                    makeDayDoc(MONDAY_KEY, [
                        makeSession('check_in', 9),
                        makeSession('check_out', 17),
                    ]),
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
                daySessions: [
                    makeDayDoc(MONDAY_KEY, [
                        makeSession('check_in', 9),
                        makeSession('check_out', 17),
                    ]),
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
                daySessions: [
                    makeDayDoc(MONDAY_KEY, [makeSession('check_in', 9)]),
                ],
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
                daySessions: [
                    makeDayDoc(MONDAY_KEY, [
                        makeSession('check_in', 9),
                        makeSession('check_out', 15),
                    ]),
                ],
            })
        );
        expect(rows[0].status).toBe('planned');
        expect(rows[0].dayClassification).toBe('workday');
        expect(rows[0].anomalies).toEqual([]);
        expect(rows[0].expectedHours).toBe(8);
        expect(rows[0].totalHours).toBe(6);
        expect(rows[0].sessions).toEqual([
            { type: 'check_in', time: '09:00', overtime: false },
            { type: 'check_out', time: '15:00', overtime: false },
        ]);
    });

    it('derives a non-working weekday classification live', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                days: [SUNDAY_KEY],
                daySessions: [
                    makeDayDoc(SUNDAY_KEY, [
                        makeSession('check_in', 10),
                        makeSession('check_out', 12),
                    ]),
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

    it('buckets sessions by their own date key', () => {
        const rows = buildWorkSessionRows(
            buildCtx({
                users: [makeUser({ scheduleMode: 'timetable' })],
                days: [MONDAY_KEY, SUNDAY_KEY],
                daySessions: [
                    makeDayDoc(MONDAY_KEY, [
                        makeSession('check_in', 9),
                        makeSession('check_out', 17),
                    ]),
                ],
            })
        );
        expect(rows[0].date).toBe('2024-01-15');
        expect(rows[0].totalHours).toBe(8);
        expect(rows[1].date).toBe('2024-01-21');
        expect(rows[1].totalHours).toBe(0);
        expect(rows[1].status).toBe('nonWorkingDay');
    });
});
