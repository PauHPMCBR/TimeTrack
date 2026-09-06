import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

const syncIndexes = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
    requireRole: (
        roles: string[],
        handler: (req: unknown, res: unknown) => unknown
    ) => {
        return async (req: any, res: any) => {
            if (!req.user) {
                return res.status(403).json({
                    success: false,
                    error: 'InsufficientPermissions',
                    details: {},
                });
            }
            return handler(req, res);
        };
    },
    AuthRequest: class {},
}));

vi.mock('@/models', () => ({
    User: { syncIndexes },
    WorkSession: { syncIndexes },
    ElectiveVacation: { syncIndexes },
    Group: { syncIndexes },
    YearlyVacationDays: { syncIndexes },
    WorkSessionReason: { syncIndexes },
    MonthlyApproval: { syncIndexes },
    UserFile: { syncIndexes },
}));

import syncHandler from '@/pages/api/admin/indexes/sync';

describe('POST /api/admin/indexes/sync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        delete process.env.CRON_SECRET;
        vi.resetModules();
    });

    it('should return 403 without a valid cron secret or admin token', async () => {
        process.env.CRON_SECRET = 'secret-1';

        const req = mockReq({
            method: 'POST',
            headers: { 'x-cron-secret': 'wrong' },
        });
        const res = mockRes();

        await syncHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(syncIndexes).not.toHaveBeenCalled();
    });

    it('should accept the CRON_SECRET header (deploy script path)', async () => {
        process.env.CRON_SECRET = 'secret-1';

        const req = mockReq({
            method: 'POST',
            headers: { 'x-cron-secret': 'secret-1' },
        });
        const res = mockRes();

        await syncHandler(req, res);

        expect(syncIndexes).toHaveBeenCalledTimes(8);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { indexes: expect.any(Object) },
        });
    });

    it('should accept an admin token (requireRole path)', async () => {
        const req = mockReq({
            method: 'POST',
            headers: {},
            user: { userId: 'admin-1', role: 'admin' },
        });
        const res = mockRes();

        await syncHandler(req, res);

        expect(syncIndexes).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 500 PostError when a syncIndexes call fails', async () => {
        syncIndexes.mockRejectedValue(new Error('DB Error'));

        const req = mockReq({
            method: 'POST',
            headers: {},
            user: { userId: 'admin-1', role: 'admin' },
        });
        const res = mockRes();

        await syncHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'PostError',
            details: {},
        });
    });
});
