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
    validateRequestBody:
        () => (req: any, res: any, next: (err?: unknown) => void) =>
            next(),
}));

vi.mock('@/lib/mail', () => ({
    sendAdminMonthlyReview: vi.fn().mockResolvedValue(undefined),
    sendMonthlyApprovalRequest: vi.fn().mockResolvedValue(undefined),
    sendMonthlyApprovalReminder: vi.fn().mockResolvedValue(undefined),
}));

const { computeMonthAnomalies, openMonthForUser } = vi.hoisted(() => ({
    computeMonthAnomalies: vi.fn(),
    openMonthForUser: vi.fn(),
}));

vi.mock('@/lib/monthly-approvals', async (importOriginal) => {
    const actual = await importOriginal<
        typeof import('@/lib/monthly-approvals')
    >();
    return {
        ...actual,
        computeMonthAnomalies,
        openMonthForUser,
    };
});

vi.mock('@/models', () => ({
    MonthlyApproval: {
        find: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
        }),
        deleteOne: vi.fn(),
        findOne: vi.fn().mockResolvedValue(null),
    },
    User: { find: vi.fn(), findById: vi.fn() },
    WorkSession: { find: vi.fn() },
    ElectiveVacation: { find: vi.fn() },
    YearlyVacationDays: { find: vi.fn() },
    AppSettings: { findOne: vi.fn(), updateOne: vi.fn() },
}));

import { User, MonthlyApproval } from '@/models';
import adminMonthlyApprovalsHandler from '@/pages/api/admin/monthly-approvals';
import openMonthlyApprovalsHandler from '@/pages/api/admin/monthly-approvals/open';
import revokeMonthlyApprovalHandler from '@/pages/api/admin/monthly-approvals/revoke';

const employees = [
    { _id: 'u1', name: 'Anna' },
    { _id: 'u2', name: 'Berta' },
];

describe('POST /api/admin/monthly-approvals/open', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should refuse to open the current month', async () => {
        const now = new Date();
        const req = mockReq({
            method: 'POST',
            body: { year: now.getFullYear(), month: now.getMonth() + 1 },
        });
        const res = mockRes();

        await openMonthlyApprovalsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'IllegalAction',
                details: { illegalAction: 'MonthNotPast' },
            })
        );
    });

    it('should open clean users and block users with anomalies', async () => {
        vi.mocked(User.find).mockReturnValue({
            lean: vi.fn().mockResolvedValue(employees),
        } as any);
        computeMonthAnomalies.mockImplementation(
            async (userId: string) =>
                userId === 'u2' ? ['hours_short'] : []
        );
        openMonthForUser.mockImplementation(async (userId: string) => ({
            _id: `ma-${userId}`,
            userId,
            year: 2025,
            month: 7,
            status: 'pending',
            requestedAt: new Date(),
        }));

        const req = mockReq({
            method: 'POST',
            body: { year: 2025, month: 7 },
        });
        const res = mockRes();

        await openMonthlyApprovalsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const payload = res.json.mock.calls[0][0];
        expect(payload.data.opened).toHaveLength(1);
        expect(payload.data.opened[0]).toMatchObject({
            userId: 'u1',
            userName: 'Anna',
            status: 'pending',
        });
        expect(payload.data.blocked).toEqual([
            {
                userId: 'u2',
                userName: 'Berta',
                anomalies: ['hours_short'],
            },
        ]);
        // Every registered, non-blocking, checkInRequired user is targeted (no userIds in the request).
        expect(User.find).toHaveBeenCalledWith(
            {
                registered: true,
                blocked: { $ne: true },
                checkInRequired: { $ne: false },
                deleted: { $ne: true },
            },
            'name trackingStartDate'
        );
        expect(openMonthForUser).toHaveBeenCalledTimes(1);
    });

    it('should open only the requested users when userIds is provided', async () => {
        vi.mocked(User.find).mockReturnValue({
            lean: vi.fn().mockResolvedValue([employees[0]]),
        } as any);
        computeMonthAnomalies.mockResolvedValue([]);
        openMonthForUser.mockResolvedValue({
            _id: 'ma-u1',
            userId: 'u1',
            year: 2025,
            month: 7,
            status: 'pending',
        });

        const req = mockReq({
            method: 'POST',
            body: { year: 2025, month: 7, userIds: ['u1'] },
        });
        const res = mockRes();

        await openMonthlyApprovalsHandler(req, res);

        expect(User.find).toHaveBeenCalledWith(
            {
                _id: { $in: ['u1'] },
                blocked: { $ne: true },
                deleted: { $ne: true },
            },
            'name trackingStartDate checkInRequired'
        );
        expect(res.json.mock.calls[0][0].data.blocked).toEqual([]);
    });
});

describe('GET /api/admin/monthly-approvals', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return rows with user names, pending first', async () => {
        vi.mocked(MonthlyApproval.find).mockReturnValue({
            lean: vi.fn().mockResolvedValue([
                {
                    _id: 'ma1',
                    userId: 'u1',
                    year: 2025,
                    month: 7,
                    status: 'approved',
                    approvedAt: new Date('2025-08-05T10:00:00'),
                },
                {
                    _id: 'ma2',
                    userId: 'u2',
                    year: 2025,
                    month: 6,
                    status: 'pending',
                    requestedAt: new Date('2025-07-05T10:00:00'),
                },
            ]),
        } as any);
        vi.mocked(User.find).mockReturnValue({
            lean: vi.fn().mockResolvedValue([
                { _id: 'u1', name: 'Anna' },
                { _id: 'u2', name: 'Berta' },
            ]),
        } as any);

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await adminMonthlyApprovalsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const rows = res.json.mock.calls[0][0].data.approvals;
        expect(rows).toHaveLength(2);
        // Pending first.
        expect(rows[0]).toMatchObject({
            _id: 'ma2',
            userName: 'Berta',
            status: 'pending',
        });
        expect(rows[1]).toMatchObject({
            _id: 'ma1',
            userName: 'Anna',
            status: 'approved',
        });
    });
});

describe('POST /api/admin/monthly-approvals/revoke', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should delete the approval document', async () => {
        vi.mocked(MonthlyApproval.deleteOne).mockResolvedValue({
            deletedCount: 1,
        } as any);

        const req = mockReq({
            method: 'POST',
            body: { userId: 'u1', year: 2025, month: 7 },
        });
        const res = mockRes();

        await revokeMonthlyApprovalHandler(req, res);

        expect(MonthlyApproval.deleteOne).toHaveBeenCalledWith({
            userId: 'u1',
            year: 2025,
            month: 7,
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 404 when there is nothing to revoke', async () => {
        vi.mocked(MonthlyApproval.deleteOne).mockResolvedValue({
            deletedCount: 0,
        } as any);

        const req = mockReq({
            method: 'POST',
            body: { userId: 'u1', year: 2025, month: 7 },
        });
        const res = mockRes();

        await revokeMonthlyApprovalHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'EntryNotFound',
            details: { entry: 'MonthlyApproval' },
        });
    });
});
