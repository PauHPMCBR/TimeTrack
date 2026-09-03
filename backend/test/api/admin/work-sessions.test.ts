import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

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
    getAppSettings: vi.fn().mockResolvedValue({
        defaultExpectedHours: 8,
        benevolenceHours: 1,
        toleranceHours: 1,
        endOfDayHour: 17,
        nonWorkingDays: [6, 0],
    }),
}));

const queryChain = (result: unknown) => ({
    select: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
});

const simpleChain = (result: unknown) => ({
    lean: vi.fn().mockResolvedValue(result),
});

vi.mock('@/models', () => ({
    User: { find: vi.fn(), findById: vi.fn() },
    WorkSession: { find: vi.fn(), updateMany: vi.fn(), insertMany: vi.fn() },
    ElectiveVacation: { find: vi.fn() },
    YearlyVacationDays: { find: vi.fn() },
    MonthlyApproval: {
        findOne: vi.fn().mockResolvedValue(null),
        find: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    },
}));

import {
    User,
    WorkSession,
    ElectiveVacation,
    YearlyVacationDays,
    MonthlyApproval,
} from '@/models';
import adminWorkSessionsHandler from '@/pages/api/admin/work-sessions';

const at = (h: number, m = 0, day = '2025-06-09') =>
    new Date(
        `${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
    );

const users = [
    {
        _id: 'u1',
        name: 'Anna',
        email: 'anna@example.com',
        dni: '1',
        expectedWorkHours: 8,
    },
    {
        _id: 'u2',
        name: 'Berta',
        email: 'berta@example.com',
        dni: '2',
        expectedWorkHours: 8,
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
        vi.mocked(WorkSession.find).mockReturnValue(
            queryChain([
                {
                    _id: 's1',
                    userId: 'u1',
                    type: 'check_in',
                    timestamp: at(9),
                    source: 'user',
                },
                {
                    _id: 's2',
                    userId: 'u1',
                    type: 'check_out',
                    timestamp: at(17),
                    source: 'user',
                },
                {
                    _id: 's3',
                    userId: 'u2',
                    type: 'check_in',
                    timestamp: at(9),
                    source: 'admin',
                },
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
        });
        expect(rows[1]).toMatchObject({
            userName: 'Berta',
            status: 'anomaly',
            totalHours: 0,
            anomalies: ['forgot_check_out'],
        });
        expect(rows[0].sessions.map((s: any) => s.source)).toEqual([
            'user',
            'user',
        ]);
        expect(rows[1].sessions[0].source).toBe('admin');
        expect(payload.data.approvedMonths).toBeDefined();
        expect(MonthlyApproval.find).toHaveBeenCalledWith({
            status: 'approved',
            year: { $in: [2025] },
        });
    });

    it('should return approved months when monthly approvals exist', async () => {
        vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
        vi.mocked(WorkSession.find).mockReturnValue(
            queryChain([
                {
                    _id: 's1',
                    userId: 'u1',
                    type: 'check_in',
                    timestamp: at(9),
                    source: 'user',
                },
                {
                    _id: 's2',
                    userId: 'u1',
                    type: 'check_out',
                    timestamp: at(17),
                    source: 'user',
                },
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

    it('should flag hours_over when worked more than expected + benevolence', async () => {
        vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
        vi.mocked(WorkSession.find).mockReturnValue(
            queryChain([
                { _id: 's1', userId: 'u1', type: 'check_in', timestamp: at(9) },
                {
                    _id: 's2',
                    userId: 'u1',
                    type: 'check_out',
                    timestamp: at(20),
                },
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

    it('should mark a user as vacation when they have an approved vacation', async () => {
        vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
        vi.mocked(WorkSession.find).mockReturnValue(queryChain([]) as any);
        vi.mocked(ElectiveVacation.find).mockReturnValue(
            simpleChain([
                {
                    _id: 'v1',
                    userId: 'u2',
                    date: new Date('2025-06-09T00:00:00'),
                    status: 'approved',
                },
            ]) as any
        );
        vi.mocked(YearlyVacationDays.find).mockReturnValue(
            simpleChain([]) as any
        );

        const req = mockReq({
            method: 'GET',
            query: { period: 'day', date: '2025-06-09' },
        });
        const res = mockRes();

        await adminWorkSessionsHandler(req, res);

        const rows = res.json.mock.calls[0][0].data.rows;
        const berta = rows.find((r: any) => r.userId === 'u2');
        expect(berta).toMatchObject({ status: 'vacation', anomalies: [] });
    });

    it('should mark hours_short when a weekday has no sessions', async () => {
        vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
        vi.mocked(WorkSession.find).mockReturnValue(queryChain([]) as any);
        vi.mocked(ElectiveVacation.find).mockReturnValue(
            simpleChain([]) as any
        );
        vi.mocked(YearlyVacationDays.find).mockReturnValue(
            simpleChain([]) as any
        );

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
        vi.mocked(WorkSession.find).mockReturnValue(queryChain([]) as any);
        vi.mocked(ElectiveVacation.find).mockReturnValue(
            simpleChain([]) as any
        );
        vi.mocked(YearlyVacationDays.find).mockReturnValue(
            simpleChain([]) as any
        );

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

    it('should mark a user-specific non-working day', async () => {
        vi.mocked(User.find).mockReturnValue(
            queryChain([
                {
                    _id: 'u1',
                    name: 'Anna',
                    email: 'anna@example.com',
                    dni: '1',
                    expectedWorkHours: 8,
                    workDays: [5, 6],
                },
            ]) as any
        );
        vi.mocked(WorkSession.find).mockReturnValue(queryChain([]) as any);
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
        vi.mocked(WorkSession.find).mockReturnValue(
            queryChain([
                {
                    _id: 's1',
                    userId: 'u1',
                    type: 'check_in',
                    timestamp: at(9, 0, '2025-06-09'),
                },
                {
                    _id: 's2',
                    userId: 'u1',
                    type: 'check_out',
                    timestamp: at(17, 0, '2025-06-09'),
                },
                {
                    _id: 's3',
                    userId: 'u2',
                    type: 'check_in',
                    timestamp: at(9, 0, '2025-06-09'),
                },
                {
                    _id: 's4',
                    userId: 'u2',
                    type: 'check_out',
                    timestamp: at(17, 0, '2025-06-09'),
                },
                {
                    _id: 's5',
                    userId: 'u1',
                    type: 'check_in',
                    timestamp: at(9, 0, '2025-06-10'),
                },
                {
                    _id: 's6',
                    userId: 'u1',
                    type: 'check_out',
                    timestamp: at(17, 0, '2025-06-10'),
                },
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
                        { type: 'check_in', timestamp: at(9).toISOString() },
                        { type: 'check_in', timestamp: at(10).toISOString() },
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

        it('should reject a timestamp outside the day', async () => {
            vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' });

            const req = mockReq({
                method: 'PUT',
                body: {
                    userId: 'u1',
                    date: '2025-06-09',
                    sessions: [
                        {
                            type: 'check_in',
                            timestamp: new Date(
                                '2025-06-10T09:00:00'
                            ).toISOString(),
                        },
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
                    incorrectParameter: 'timestamp',
                    reasons: ['OutOfDay'],
                },
            });
        });

        it('should reject equal timestamps', async () => {
            vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' });

            const req = mockReq({
                method: 'PUT',
                body: {
                    userId: 'u1',
                    date: '2025-06-09',
                    sessions: [
                        { type: 'check_in', timestamp: at(9).toISOString() },
                        { type: 'check_out', timestamp: at(9).toISOString() },
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
                    incorrectParameter: 'timestamp',
                    reasons: ['NotInOrder'],
                },
            });
        });

        it('should replace the day sessions on success', async () => {
            vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' });
            // No previous sessions for that day (fresh day).
            vi.mocked(WorkSession.find).mockResolvedValue([] as any);
            vi.mocked(WorkSession.updateMany).mockResolvedValue({} as any);
            vi.mocked(WorkSession.insertMany).mockResolvedValue([
                { _id: 'x1', userId: 'u1', type: 'check_in', timestamp: at(9) },
                {
                    _id: 'x2',
                    userId: 'u1',
                    type: 'check_out',
                    timestamp: at(17),
                },
            ] as any);

            const req = mockReq({
                method: 'PUT',
                body: {
                    userId: 'u1',
                    date: '2025-06-09',
                    sessions: [
                        { type: 'check_in', timestamp: at(9).toISOString() },
                        { type: 'check_out', timestamp: at(17).toISOString() },
                    ],
                },
            });
            const res = mockRes();

            await adminWorkSessionsHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            // Nothing is ever deleted: on a fresh day there is nothing to
            // supersede and no updateMany happens.
            expect(WorkSession.updateMany).not.toHaveBeenCalled();
            expect(WorkSession.insertMany).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        userId: 'u1',
                        type: 'check_in',
                        source: 'admin',
                        version: 1,
                        status: 'active',
                    }),
                    expect.objectContaining({
                        userId: 'u1',
                        type: 'check_out',
                        source: 'admin',
                        version: 1,
                        status: 'active',
                    }),
                ])
            );
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        workSessions: expect.any(Array),
                    }),
                })
            );
        });

        it('should flag previous versions as replaced instead of deleting them', async () => {
            vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' });
            // The day already has an active version 3 (e.g. an auto-timetable
            // applied earlier over the original punches).
            vi.mocked(WorkSession.find).mockResolvedValue([
                {
                    _id: 's1',
                    userId: 'u1',
                    type: 'check_in',
                    timestamp: at(9),
                    version: 3,
                    status: 'active',
                },
                {
                    _id: 's2',
                    userId: 'u1',
                    type: 'check_out',
                    timestamp: at(17),
                    version: 3,
                    status: 'active',
                },
            ] as any);
            vi.mocked(WorkSession.updateMany).mockResolvedValue({} as any);
            vi.mocked(WorkSession.insertMany).mockResolvedValue([] as any);

            const req = mockReq({
                method: 'PUT',
                body: {
                    userId: 'u1',
                    date: '2025-06-09',
                    reason: 'Worker requested correction',
                    sessions: [
                        { type: 'check_in', timestamp: at(8).toISOString() },
                        { type: 'check_out', timestamp: at(16).toISOString() },
                    ],
                },
            });
            const res = mockRes();

            await adminWorkSessionsHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            // The old set is flagged replaced, pointing at the new version.
            expect(WorkSession.updateMany).toHaveBeenCalledWith(
                { _id: { $in: ['s1', 's2'] } },
                expect.objectContaining({
                    $set: expect.objectContaining({
                        status: 'replaced',
                        replacedByVersion: 4,
                    }),
                }),
                undefined
            );
            // The new set becomes version 4, with the source marking the
            // admin authorship and the reason stored in notes.
            expect(WorkSession.insertMany).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        userId: 'u1',
                        type: 'check_in',
                        source: 'admin',
                        version: 4,
                        status: 'active',
                        notes: 'Worker requested correction',
                    }),
                    expect.objectContaining({
                        type: 'check_out',
                        version: 4,
                        notes: 'Worker requested correction',
                    }),
                ])
            );
        });

        it('should default the audit reason when the admin does not provide one', async () => {
            vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' });
            vi.mocked(WorkSession.find).mockResolvedValue([] as any);
            vi.mocked(WorkSession.updateMany).mockResolvedValue({} as any);
            vi.mocked(WorkSession.insertMany).mockResolvedValue([] as any);

            const req = mockReq({
                method: 'PUT',
                body: {
                    userId: 'u1',
                    date: '2025-06-09',
                    sessions: [
                        { type: 'check_in', timestamp: at(9).toISOString() },
                        { type: 'check_out', timestamp: at(17).toISOString() },
                    ],
                },
            });
            const res = mockRes();

            await adminWorkSessionsHandler(req, res);

            expect(WorkSession.insertMany).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        notes: 'Admin day correction',
                    }),
                ])
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
            vi.mocked(WorkSession.find).mockReturnValue(queryChain([]) as any);
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
