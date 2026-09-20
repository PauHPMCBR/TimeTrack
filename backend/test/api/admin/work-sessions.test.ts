import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes, createMockAppSettings } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
    requireRole: (
        roles: string[],
        handler: (req: unknown, res: unknown) => unknown
    ) => {
        return async (req: any, res: any) => {
            req.user = {
                userId: 'admin-123',
                email: 'admin@example.com',
                role: 'admin',
            };
            return handler(req, res);
        };
    },
    AuthRequest: class {},
}));

vi.mock('@/lib/validation', () => ({
    runValidation: async (middleware: any, req: any, res: any) => {
        await new Promise((resolve) =>
            middleware(req, res, () => resolve(true))
        );
        return !res.headersSent;
    },

    validateQueryParams:
        () => (req: any, res: any, next: (err?: unknown) => void) =>
            next(),
    validateRequestBody:
        () => (req: any, res: any, next: (err?: unknown) => void) =>
            next(),
}));

vi.mock('@/lib/settings', () => ({
    DEFAULT_TIMEZONE: 'Europe/Madrid',
    getConfiguredTimezone: vi.fn().mockReturnValue('Europe/Madrid'),
    getAppSettings: vi.fn().mockResolvedValue(createMockAppSettings({ endOfDayHour: 17 })),
}));

const queryChain = (result: unknown) => ({
    select: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
});

const simpleChain = (result: unknown) => ({
    lean: vi.fn().mockResolvedValue(result),
});

const makeRecord = (userId: string, date: string, overrides: Record<string, unknown> = {}) => ({
    _id: `rec-${userId}-${date}`,
    userId,
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
});

const mockRecords = (records: unknown[]) => {
    vi.mocked(findWorkDayRecords).mockResolvedValue(records as any);
};

vi.mock('@/models', () => ({
    User: { find: vi.fn(), findById: vi.fn() },
    WorkDaySessions: {
        find: vi.fn(),
        findOne: vi.fn().mockResolvedValue(null),
        updateOne: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue([]),
    },
    ElectiveVacation: { find: vi.fn() },
    YearlyVacationDays: { find: vi.fn() },
    MonthlyApproval: {
        findOne: vi.fn().mockResolvedValue(null),
        find: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    },
}));

vi.mock('@/repositories/authorized-leave-repository', () => ({
    findLeavesOverlapping: vi.fn(() => ({
        lean: vi.fn().mockResolvedValue([]),
    })),
}));

vi.mock('@/repositories/work-day-record-repository', () => ({
    findWorkDayRecords: vi.fn(() => Promise.resolve([])),
    findOneWorkDayRecord: vi.fn(),
    findUserWorkDayRecords: vi.fn(),
    upsertWorkDayRecord: vi.fn(),
}));

vi.mock('@/lib/work-day-records', () => ({
    recomputeWorkDayRecords: vi.fn().mockResolvedValue(undefined),
    recomputeWorkDayRecordsForRange: vi.fn().mockResolvedValue(undefined),
    lastClosedDayKey: vi.fn().mockResolvedValue('2025-06-09'),
    backfillUserWorkDayRecordsFromTrackingStart: vi
        .fn()
        .mockResolvedValue(0),
    ensureWorkDayRecordsForDay: vi.fn().mockResolvedValue(0),
    backfillAllWorkDayRecords: vi.fn().mockResolvedValue(0),
}));

import {
    User,
    WorkDaySessions,
    ElectiveVacation,
    YearlyVacationDays,
    MonthlyApproval,
} from '@/models';
import { findWorkDayRecords } from '@/repositories/work-day-record-repository';
import adminWorkSessionsHandler from '@/pages/api/admin/work-sessions';
import { AdminReplaceDayWorkSessionsRequestSchema } from 'shared/src/schemas/api';

const makeDayDoc = (
    userId: string,
    date: string,
    sessions: { type: string; time: string }[],
    source = 'userClick'
) => ({
    _id: `day-${userId}-${date}`,
    userId,
    date,
    source,
    sessions: sessions.map((s) => ({ ...s, overtime: false })),
});

const users = [
    {
        _id: 'u1',
        name: 'Anna',
        email: 'anna@example.com',
        dni: '1',
        weeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0],
    },
    {
        _id: 'u2',
        name: 'Berta',
        email: 'berta@example.com',
        dni: '2',
        weeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0],
    },
];

describe('GET /api/admin/work-sessions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({ method: 'POST' });
        const res = mockRes();

        await adminWorkSessionsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return ok and anomaly rows for a day', async () => {
        vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
        vi.mocked(WorkDaySessions.find).mockReturnValue(
            queryChain([
                makeDayDoc('u1', '2025-06-09', [
                    { type: 'check_in', time: '09:00' },
                    { type: 'check_out', time: '17:00' },
                ]),
                makeDayDoc(
                    'u2',
                    '2025-06-09',
                    [{ type: 'check_in', time: '09:00' }],
                    'adminManual'
                ),
            ]) as any
        );
        vi.mocked(ElectiveVacation.find).mockReturnValue(
            simpleChain([]) as any
        );
        vi.mocked(YearlyVacationDays.find).mockReturnValue(
            simpleChain([]) as any
        );
        mockRecords([
            makeRecord('u1', '2025-06-09'),
            makeRecord('u2', '2025-06-09', {
                anomalies: ['forgot_check_out'],
            }),
        ]);

        const req = mockReq({
            method: 'GET',
            query: { period: 'day', date: '2025-06-09' },
        });
        const res = mockRes();

        await adminWorkSessionsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const payload = res.json.mock.calls[0][0];
        const rows = payload.data.rows;

        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
            userName: 'Anna',
            status: 'ok',
            totalHours: 8,
            anomalies: [],
            source: 'userClick',
        });
        expect(rows[1]).toMatchObject({
            userName: 'Berta',
            status: 'anomaly',
            totalHours: 0,
            anomalies: ['forgot_check_out'],
            source: 'adminManual',
        });
        expect(payload.data.approvedMonths).toBeDefined();
        expect(MonthlyApproval.find).toHaveBeenCalledWith({
            status: 'approved',
            year: { $in: [2025] },
        });
    });

    it('should return approved months when monthly approvals exist', async () => {
        vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
        vi.mocked(WorkDaySessions.find).mockReturnValue(
            queryChain([
                makeDayDoc('u1', '2025-06-09', [
                    { type: 'check_in', time: '09:00' },
                    { type: 'check_out', time: '17:00' },
                ]),
            ]) as any
        );
        vi.mocked(ElectiveVacation.find).mockReturnValue(
            simpleChain([]) as any
        );
        vi.mocked(YearlyVacationDays.find).mockReturnValue(
            simpleChain([]) as any
        );
        vi.mocked(MonthlyApproval.find).mockReturnValue({
            lean: vi.fn().mockResolvedValue([
                {
                    _id: 'ma1',
                    userId: 'u1',
                    year: 2025,
                    month: 6,
                    status: 'approved',
                },
            ]),
        } as any);
        mockRecords([]);

        const req = mockReq({
            method: 'GET',
            query: { period: 'month', year: 2025, month: 6 },
        });
        const res = mockRes();

        await adminWorkSessionsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const payload = res.json.mock.calls[0][0];
        expect(payload.data.approvedMonths).toEqual(['u1:2025-06']);
    });

    it('should flag hours_over from the record when worked more than expected + benevolence', async () => {
        vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
        vi.mocked(WorkDaySessions.find).mockReturnValue(
            queryChain([
                makeDayDoc('u1', '2025-06-09', [
                    { type: 'check_in', time: '09:00' },
                    { type: 'check_out', time: '20:00' },
                ]),
            ]) as any
        );
        vi.mocked(ElectiveVacation.find).mockReturnValue(
            simpleChain([]) as any
        );
        vi.mocked(YearlyVacationDays.find).mockReturnValue(
            simpleChain([]) as any
        );
        mockRecords([
            makeRecord('u1', '2025-06-09', {
                anomalies: ['hours_over'],
            }),
        ]);

        const req = mockReq({
            method: 'GET',
            query: { period: 'day', date: '2025-06-09' },
        });
        const res = mockRes();

        await adminWorkSessionsHandler(req, res);

        const rows = res.json.mock.calls[0][0].data.rows;
        const anna = rows.find((r: any) => r.userId === 'u1');
        expect(anna).toMatchObject({
            status: 'anomaly',
            totalHours: 11,
            anomalies: ['hours_over'],
        });
    });

    it('should mark a user as elective vacation when their record says so', async () => {
        vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
        vi.mocked(WorkDaySessions.find).mockReturnValue(queryChain([]) as any);
        vi.mocked(ElectiveVacation.find).mockReturnValue(
            simpleChain([
                {
                    _id: 'v1',
                    userId: 'u2',
                    startDate: '2025-06-09',
                    endDate: '2025-06-09',
                    spentDays: 1,
                    status: 'approved',
                },
            ]) as any
        );
        vi.mocked(YearlyVacationDays.find).mockReturnValue(
            simpleChain([]) as any
        );
        mockRecords([
            makeRecord('u2', '2025-06-09', {
                classification: 'electiveVacation',
                expectedHours: 0,
            }),
        ]);

        const req = mockReq({
            method: 'GET',
            query: { period: 'day', date: '2025-06-09' },
        });
        const res = mockRes();

        await adminWorkSessionsHandler(req, res);

        const rows = res.json.mock.calls[0][0].data.rows;
        const berta = rows.find((r: any) => r.userId === 'u2');
        expect(berta).toMatchObject({
            status: 'electiveVacation',
            anomalies: [],
        });
    });

    it('should mark hours_short from the record when a weekday has no sessions', async () => {
        vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
        vi.mocked(WorkDaySessions.find).mockReturnValue(queryChain([]) as any);
        vi.mocked(ElectiveVacation.find).mockReturnValue(
            simpleChain([]) as any
        );
        vi.mocked(YearlyVacationDays.find).mockReturnValue(
            simpleChain([]) as any
        );
        mockRecords([
            makeRecord('u1', '2025-06-09', {
                anomalies: ['hours_short'],
            }),
        ]);

        const req = mockReq({
            method: 'GET',
            query: { period: 'day', date: '2025-06-09' },
        });
        const res = mockRes();

        await adminWorkSessionsHandler(req, res);

        const rows = res.json.mock.calls[0][0].data.rows;
        const anna = rows.find((r: any) => r.userId === 'u1');
        expect(anna).toMatchObject({
            status: 'anomaly',
            totalHours: 0,
            anomalies: ['hours_short'],
        });
    });

    it('should show quiet non-working days as nonWorkingDay', async () => {
        vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
        vi.mocked(WorkDaySessions.find).mockReturnValue(queryChain([]) as any);
        vi.mocked(ElectiveVacation.find).mockReturnValue(
            simpleChain([]) as any
        );
        vi.mocked(YearlyVacationDays.find).mockReturnValue(
            simpleChain([]) as any
        );
        mockRecords([]);

        const req = mockReq({
            method: 'GET',
            query: { period: 'day', date: '2025-06-14' },
        }); // Saturday (non-working)
        const res = mockRes();

        await adminWorkSessionsHandler(req, res);

        const rows = res.json.mock.calls[0][0].data.rows;
        expect(rows).toHaveLength(2);
        expect(rows.every((r: any) => r.status === 'nonWorkingDay')).toBe(true);
    });

    it('should show not-yet-closed record-less days as planned (no anomaly judgment)', async () => {
        vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
        vi.mocked(WorkDaySessions.find).mockReturnValue(queryChain([]) as any);
        vi.mocked(ElectiveVacation.find).mockReturnValue(
            simpleChain([]) as any
        );
        vi.mocked(YearlyVacationDays.find).mockReturnValue(
            simpleChain([]) as any
        );
        mockRecords([]);

        // Closed-through is mocked to 2025-06-09; 2025-06-10 is still open.
        const req = mockReq({
            method: 'GET',
            query: { period: 'day', date: '2025-06-10' },
        });
        const res = mockRes();

        await adminWorkSessionsHandler(req, res);

        const rows = res.json.mock.calls[0][0].data.rows;
        expect(rows).toHaveLength(2);
        expect(rows.every((r: any) => r.status === 'planned')).toBe(true);
        expect(
            rows.every((r: any) => r.dayClassification === 'workday')
        ).toBe(true);
        expect(rows.every((r: any) => r.anomalies.length === 0)).toBe(true);
    });

    it('judges a closed day live when its cached record is missing', async () => {
        vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
        vi.mocked(WorkDaySessions.find).mockReturnValue(
            queryChain([
                makeDayDoc('u1', '2025-06-09', [
                    { type: 'check_in', time: '09:00' },
                ]),
            ]) as any
        );
        vi.mocked(ElectiveVacation.find).mockReturnValue(
            simpleChain([]) as any
        );
        vi.mocked(YearlyVacationDays.find).mockReturnValue(
            simpleChain([]) as any
        );
        mockRecords([]);

        const req = mockReq({
            method: 'GET',
            query: { period: 'day', date: '2025-06-09' },
        });
        const res = mockRes();

        await adminWorkSessionsHandler(req, res);

        const rows = res.json.mock.calls[0][0].data.rows;
        const anna = rows.find((r: any) => r.userId === 'u1');
        expect(anna).toMatchObject({
            status: 'anomaly',
            anomalies: ['forgot_check_out'],
        });
    });

    it('should mark a user-specific non-working day', async () => {
        vi.mocked(User.find).mockReturnValue(
            queryChain([
                {
                    _id: 'u1',
                    name: 'Anna',
                    email: 'anna@example.com',
                    dni: '1',
                    weeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0],
                },
            ]) as any
        );
        vi.mocked(WorkDaySessions.find).mockReturnValue(queryChain([]) as any);
        vi.mocked(ElectiveVacation.find).mockReturnValue(
            simpleChain([]) as any
        );
        vi.mocked(YearlyVacationDays.find).mockReturnValue(
            simpleChain([]) as any
        );

        const req = mockReq({
            method: 'GET',
            query: { period: 'day', date: '2025-06-14' },
        }); // Saturday
        const res = mockRes();

        await adminWorkSessionsHandler(req, res);

        const rows = res.json.mock.calls[0][0].data.rows;
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            userName: 'Anna',
            status: 'nonWorkingDay',
            anomalies: [],
        });
    });

    it('should sort rows by date then name', async () => {
        vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
        vi.mocked(WorkDaySessions.find).mockReturnValue(
            queryChain([
                makeDayDoc('u1', '2025-06-09', [
                    { type: 'check_in', time: '09:00' },
                    { type: 'check_out', time: '17:00' },
                ]),
                makeDayDoc('u2', '2025-06-09', [
                    { type: 'check_in', time: '09:00' },
                    { type: 'check_out', time: '17:00' },
                ]),
                makeDayDoc('u1', '2025-06-10', [
                    { type: 'check_in', time: '09:00' },
                    { type: 'check_out', time: '17:00' },
                ]),
            ]) as any
        );
        vi.mocked(ElectiveVacation.find).mockReturnValue(
            simpleChain([]) as any
        );
        vi.mocked(YearlyVacationDays.find).mockReturnValue(
            simpleChain([]) as any
        );

        const req = mockReq({
            method: 'GET',
            query: { period: 'week', date: '2025-06-09' },
        });
        const res = mockRes();

        await adminWorkSessionsHandler(req, res);

        const rows = res.json.mock.calls[0][0].data.rows;
        const keys = rows.map((r: any) => `${r.date}:${r.userName}`);
        expect(keys).toEqual([
            '2025-06-09:Anna',
            '2025-06-09:Berta',
            '2025-06-10:Anna',
            '2025-06-10:Berta',
            '2025-06-11:Anna',
            '2025-06-11:Berta',
            '2025-06-12:Anna',
            '2025-06-12:Berta',
            '2025-06-13:Anna',
            '2025-06-13:Berta',
            '2025-06-14:Anna',
            '2025-06-14:Berta',
            '2025-06-15:Anna',
            '2025-06-15:Berta',
        ]);
    });

    it('should return 500 on database error', async () => {
        vi.mocked(User.find).mockImplementation(() => {
            throw new Error('DB Error');
        });

        const req = mockReq({
            method: 'GET',
            query: { period: 'day', date: '2025-06-09' },
        });
        const res = mockRes();

        await adminWorkSessionsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });

    describe('PUT (replace day)', () => {
        it('should reject an incoherent sequence', async () => {
            vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' });

            const req = mockReq({
                method: 'PUT',
                body: {
                    userId: 'u1',
                    date: '2025-06-09',
                    sessions: [
                        { type: 'check_in', time: '09:00' },
                        { type: 'check_in', time: '10:00' },
                    ],
                },
            });
            const res = mockRes();

            await adminWorkSessionsHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'IncorrectParameter',
                details: {
                    incorrectParameter: 'type',
                    reasons: ['NotInOrder'],
                },
            });
        });

        it('should reject a malformed time at validation', async () => {
            const result = AdminReplaceDayWorkSessionsRequestSchema.safeParse({
                userId: 'u1',
                date: '2025-06-09',
                sessions: [
                    {
                        type: 'check_in',
                        time: '25:99',
                    },
                    {
                        type: 'check_out',
                        time: '17:00',
                    },
                ],
            });
            expect(result.success).toBe(false);
        });

        it('should reject equal timestamps', async () => {
            vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' });

            const req = mockReq({
                method: 'PUT',
                body: {
                    userId: 'u1',
                    date: '2025-06-09',
                    sessions: [
                        { type: 'check_in', time: '09:00' },
                        { type: 'check_out', time: '09:00' },
                    ],
                },
            });
            const res = mockRes();

            await adminWorkSessionsHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'IncorrectParameter',
                details: {
                    incorrectParameter: 'time',
                    reasons: ['NotInOrder'],
                },
            });
        });

        it('should replace the day sessions on success', async () => {
            vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' });
            // No previous sessions for that day (fresh day).
            vi.mocked(WorkDaySessions.findOne).mockResolvedValue(null as any);
            vi.mocked(WorkDaySessions.create).mockResolvedValue([
                {
                    _id: 'x1',
                    userId: 'u1',
                    date: '2025-06-09',
                    type: 'check_in',
                },
            ] as any);

            const req = mockReq({
                method: 'PUT',
                body: {
                    userId: 'u1',
                    date: '2025-06-09',
                    sessions: [
                        { type: 'check_in', time: '09:00' },
                        { type: 'check_out', time: '17:00' },
                    ],
                },
            });
            const res = mockRes();

            await adminWorkSessionsHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            // Nothing is ever deleted: on a fresh day there is nothing to
            // supersede and no updateOne happens.
            expect(WorkDaySessions.updateOne).not.toHaveBeenCalled();
            expect(WorkDaySessions.create).toHaveBeenCalledWith(
                [
                    expect.objectContaining({
                        userId: 'u1',
                        date: '2025-06-09',
                        source: 'adminManual',
                        version: 1,
                        status: 'active',
                        editedBy: 'admin-123',
                        sessions: [
                            {
                                type: 'check_in',
                                time: '09:00',
                                overtime: false,
                            },
                            {
                                type: 'check_out',
                                time: '17:00',
                                overtime: false,
                            },
                        ],
                    }),
                ],
                undefined
            );
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        workDaySessions: expect.anything(),
                    }),
                })
            );
        });

        it('should flag previous versions as replaced instead of deleting them', async () => {
            vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' });
            // The day already has an active version 3 (e.g. an auto-timetable
            // applied earlier over the original punches).
            vi.mocked(WorkDaySessions.findOne).mockResolvedValue({
                _id: 's1',
                userId: 'u1',
                date: '2025-06-09',
                version: 3,
                status: 'active',
            } as any);

            const req = mockReq({
                method: 'PUT',
                body: {
                    userId: 'u1',
                    date: '2025-06-09',
                    reason: 'Worker requested correction',
                    sessions: [
                        { type: 'check_in', time: '08:00' },
                        { type: 'check_out', time: '16:00' },
                    ],
                },
            });
            const res = mockRes();

            await adminWorkSessionsHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            // The old version is flagged replaced, pointing at the new one.
            expect(WorkDaySessions.updateOne).toHaveBeenCalledWith(
                { _id: 's1' },
                expect.objectContaining({
                    $set: expect.objectContaining({
                        status: 'replaced',
                        replacedByVersion: 4,
                    }),
                }),
                undefined
            );
            // The new set becomes version 4, with the reason stored as
            // editReason and the day source marking the admin authorship.
            expect(WorkDaySessions.create).toHaveBeenCalledWith(
                [
                    expect.objectContaining({
                        userId: 'u1',
                        version: 4,
                        status: 'active',
                        source: 'adminManual',
                        editReason: 'Worker requested correction',
                        sessions: [
                            expect.objectContaining({
                                type: 'check_in',
                                time: '08:00',
                            }),
                            expect.objectContaining({
                                type: 'check_out',
                                time: '16:00',
                            }),
                        ],
                    }),
                ],
                undefined
            );
        });

        it('should default the audit reason when the admin does not provide one', async () => {
            vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' });
            vi.mocked(WorkDaySessions.findOne).mockResolvedValue(null as any);

            const req = mockReq({
                method: 'PUT',
                body: {
                    userId: 'u1',
                    date: '2025-06-09',
                    sessions: [
                        { type: 'check_in', time: '09:00' },
                        { type: 'check_out', time: '17:00' },
                    ],
                },
            });
            const res = mockRes();

            await adminWorkSessionsHandler(req, res);

            expect(WorkDaySessions.create).toHaveBeenCalledWith(
                [
                    expect.objectContaining({
                        editReason: 'Admin day correction',
                    }),
                ],
                undefined
            );
        });

        it('should pass the session notes through to the new version', async () => {
            vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' });
            vi.mocked(WorkDaySessions.findOne).mockResolvedValue(null as any);

            const req = mockReq({
                method: 'PUT',
                body: {
                    userId: 'u1',
                    date: '2025-06-09',
                    reason: 'Shifted schedule',
                    sessions: [
                        {
                            type: 'check_in',
                            time: '08:00',
                            notes: 'Morning note',
                        },
                        { type: 'check_out', time: '16:00' },
                    ],
                },
            });
            const res = mockRes();

            await adminWorkSessionsHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(WorkDaySessions.create).toHaveBeenCalledWith(
                [
                    expect.objectContaining({
                        editReason: 'Shifted schedule',
                        sessions: [
                            expect.objectContaining({
                                type: 'check_in',
                                notes: 'Morning note',
                            }),
                            expect.objectContaining({
                                type: 'check_out',
                            }),
                        ],
                    }),
                ],
                undefined
            );
        });

        it('should return 404 when the user does not exist', async () => {
            vi.mocked(User.findById).mockResolvedValue(null);

            const req = mockReq({
                method: 'PUT',
                body: { userId: 'missing', date: '2025-06-09', sessions: [] },
            });
            const res = mockRes();

            await adminWorkSessionsHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'EntryNotFound',
                details: { entry: 'User' },
            });
        });

        it('should paginate rows when limit/offset are provided', async () => {
            vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
            vi.mocked(WorkDaySessions.find).mockReturnValue(queryChain([]) as any);
            vi.mocked(ElectiveVacation.find).mockReturnValue(
                simpleChain([]) as any
            );
            vi.mocked(YearlyVacationDays.find).mockReturnValue(
                simpleChain([]) as any
            );

            const req = mockReq({
                method: 'GET',
                query: {
                    period: 'week',
                    date: '2025-06-09',
                    limit: '3',
                    offset: '2',
                },
            });
            const res = mockRes();

            await adminWorkSessionsHandler(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.data.total).toBe(14); // 2 users × 7 days
            expect(body.data.limit).toBe(3);
            expect(body.data.offset).toBe(2);
            expect(body.data.rows).toHaveLength(3);
            const keys = body.data.rows.map(
                (r: any) => `${r.date}:${r.userName}`
            );
            expect(keys).toEqual([
                '2025-06-10:Anna',
                '2025-06-10:Berta',
                '2025-06-11:Anna',
            ]);
        });

        it('should return 500 on database error', async () => {
            vi.mocked(User.findById).mockRejectedValue(new Error('DB Error'));

            const req = mockReq({
                method: 'PUT',
                body: { userId: 'u1', date: '2025-06-09', sessions: [] },
            });
            const res = mockRes();

            await adminWorkSessionsHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'PutError',
                details: {},
            });
        });
    });
});
