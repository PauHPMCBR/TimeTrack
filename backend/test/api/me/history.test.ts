import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
    authenticateToken: (handler: (req: unknown, res: unknown) => unknown) => {
        return async (req: any, res: any) => {
            req.user = {
                userId: 'user-123',
                email: 'test@example.com',
                role: 'employee',
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
        () => (req: any, res: any, next: (err?: unknown) => void) => next(),
    validateRequestBody:
        () => (req: any, res: any, next: (err?: unknown) => void) => next(),
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

const user = {
    _id: 'user-123',
    name: 'Anna',
    email: 'anna@example.com',
    dni: '1',
    expectedWorkHours: 8,
};

vi.mock('@/models', () => ({
    User: { findById: vi.fn() },
    WorkSession: { find: vi.fn() },
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
import historyHandler from '@/pages/api/me/history';

const at = (h: number, m = 0, day = '2025-06-09') =>
    new Date(
        `${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
    );

describe('GET /api/me/history', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({ method: 'POST' });
        const res = mockRes();

        await historyHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return only the caller rows with ok/anomaly status', async () => {
        vi.mocked(User.findById).mockReturnValue({
            lean: vi.fn().mockResolvedValue(user),
        } as any);
        vi.mocked(WorkSession.find).mockReturnValue(
            queryChain([
                {
                    _id: 's1',
                    userId: 'user-123',
                    type: 'check_in',
                    timestamp: at(9),
                    source: 'user',
                },
                {
                    _id: 's2',
                    userId: 'user-123',
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

        const req = mockReq({
            method: 'GET',
            query: { period: 'day', date: '2025-06-09' },
        });
        const res = mockRes();

        await historyHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const payload = res.json.mock.calls[0][0];
        const rows = payload.data.rows;

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            userId: 'user-123',
            userName: 'Anna',
            status: 'ok',
            totalHours: 8,
            anomalies: [],
            expectedHours: 8,
        });
        expect(payload.data.approvedMonths).toBeDefined();
        expect(MonthlyApproval.find).toHaveBeenCalledWith({
            userId: 'user-123',
            status: 'approved',
            year: { $in: [2025] },
        });
    });

    it('should paginate rows when limit/offset are provided', async () => {
        vi.mocked(User.findById).mockReturnValue({
            lean: vi.fn().mockResolvedValue(user),
        } as any);
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
                offset: '1',
            },
        });
        const res = mockRes();

        await historyHandler(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.data.total).toBe(7); // 1 user × 7 days
        expect(body.data.limit).toBe(3);
        expect(body.data.offset).toBe(1);
        expect(body.data.rows).toHaveLength(3);
        expect(body.data.rows[0].date).toBe('2025-06-10');
        expect(body.data.approvedMonths).toBeDefined();
    });

    it('should return approved months when the user has confirmed a month', async () => {
        vi.mocked(User.findById).mockReturnValue({
            lean: vi.fn().mockResolvedValue(user),
        } as any);
        vi.mocked(WorkSession.find).mockReturnValue(queryChain([]) as any);
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
                    userId: 'user-123',
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

        await historyHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const payload = res.json.mock.calls[0][0];
        expect(payload.data.approvedMonths).toEqual(['user-123:2025-06']);
    });

    it('should return 500 when the user does not exist', async () => {
        vi.mocked(User.findById).mockReturnValue({
            lean: vi.fn().mockResolvedValue(null),
        } as any);
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

        await historyHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });

    it('should return 500 on database error', async () => {
        vi.mocked(User.findById).mockImplementation(() => {
            throw new Error('DB Error');
        });

        const req = mockReq({
            method: 'GET',
            query: { period: 'day', date: '2025-06-09' },
        });
        const res = mockRes();

        await historyHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });
});
