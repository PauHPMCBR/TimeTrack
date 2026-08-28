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
                email: 'worker@example.com',
                role: 'employee',
            };
            return handler(req, res);
        };
    },
    requireSameGroupOrAdmin: (
        handler: (req: unknown, res: unknown) => unknown
    ) => {
        return async (req: any, res: any) => {
            req.user = {
                userId: 'user-123',
                email: 'worker@example.com',
                role: 'employee',
            };
            return handler(req, res);
        };
    },
    AuthRequest: class {},
}));

vi.mock('@/models', () => ({
    MonthlyApproval: {
        find: vi.fn(),
        findById: vi.fn(),
    },
}));

import { MonthlyApproval } from '@/models';
import userMonthlyApprovalsHandler from '@/pages/api/monthly-approvals/user/[userId]';
import approveMonthlyRecordHandler from '@/pages/api/monthly-approvals/[approvalId]/approve';

const pendingDoc = {
    _id: 'ma1',
    userId: 'user-123',
    year: 2025,
    month: 7,
    status: 'pending',
    requestedAt: new Date('2025-08-01T09:00:00'),
    approvedAt: undefined as Date | undefined,
    save: vi.fn().mockResolvedValue(undefined),
};

describe('GET /api/monthly-approvals/user/[userId]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return the user approvals sorted newest first', async () => {
        vi.mocked(MonthlyApproval.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([pendingDoc]),
            }),
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { userId: 'user-123' },
        });
        const res = mockRes();

        await userMonthlyApprovalsHandler(req, res);

        expect(MonthlyApproval.find).toHaveBeenCalledWith({
            userId: 'user-123',
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { approvals: [pendingDoc] },
        });
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({
            method: 'POST',
            query: { userId: 'user-123' },
        });
        const res = mockRes();

        await userMonthlyApprovalsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
    });
});

describe('POST /api/monthly-approvals/[approvalId]/approve', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should approve a pending month (owner)', async () => {
        vi.mocked(MonthlyApproval.findById).mockResolvedValue(pendingDoc as any);

        const req = mockReq({
            method: 'POST',
            query: { approvalId: 'ma1' },
        });
        const res = mockRes();

        await approveMonthlyRecordHandler(req, res);

        expect(pendingDoc.save).toHaveBeenCalled();
        expect(pendingDoc.status).toBe('approved');
        expect(pendingDoc.approvedAt).toBeInstanceOf(Date);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
    });

    it('should refuse another user approving on someone else’s behalf', async () => {
        vi.mocked(MonthlyApproval.findById).mockResolvedValue({
            ...pendingDoc,
            userId: 'someone-else',
        } as any);

        const req = mockReq({
            method: 'POST',
            query: { approvalId: 'ma1' },
        });
        const res = mockRes();

        await approveMonthlyRecordHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'IllegalAction',
                details: { illegalAction: 'ModifyingFromAnotherUser' },
            })
        );
    });

    it('should refuse to approve twice', async () => {
        vi.mocked(MonthlyApproval.findById).mockResolvedValue({
            ...pendingDoc,
            status: 'approved',
            approvedAt: new Date(),
        } as any);

        const req = mockReq({
            method: 'POST',
            query: { approvalId: 'ma1' },
        });
        const res = mockRes();

        await approveMonthlyRecordHandler(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'IllegalAction',
                details: { illegalAction: 'MonthAlreadyApproved' },
            })
        );
    });

    it('should return 404 when the approval does not exist', async () => {
        vi.mocked(MonthlyApproval.findById).mockResolvedValue(null as any);

        const req = mockReq({
            method: 'POST',
            query: { approvalId: 'missing' },
        });
        const res = mockRes();

        await approveMonthlyRecordHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'EntryNotFound',
            details: { entry: 'MonthlyApproval' },
        });
    });
});
