import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
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
    MonthlyApprovalEvent: {
        find: vi.fn(),
    },
    User: { find: vi.fn() },
}));

import { MonthlyApprovalEvent, User } from '@/models';
import historyHandler from '@/pages/api/monthly-approvals/history/[userId]';

describe('GET /api/monthly-approvals/history/[userId]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return the month events chronologically with actor names', async () => {
        vi.mocked(MonthlyApprovalEvent.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([
                    {
                        _id: 'e1',
                        userId: 'user-123',
                        year: 2025,
                        month: 7,
                        action: 'opened',
                        actorId: 'admin-1',
                        timestamp: new Date('2025-08-01T09:00:00'),
                    },
                    {
                        _id: 'e2',
                        userId: 'user-123',
                        year: 2025,
                        month: 7,
                        action: 'confirmed',
                        actorId: 'user-123',
                        timestamp: new Date('2025-08-03T10:00:00'),
                    },
                    {
                        _id: 'e3',
                        userId: 'user-123',
                        year: 2025,
                        month: 7,
                        action: 'revoked',
                        actorId: 'admin-1',
                        timestamp: new Date('2025-08-05T12:00:00'),
                    },
                ]),
            }),
        } as any);
        vi.mocked(User.find).mockReturnValue({
            lean: vi.fn().mockResolvedValue([
                { _id: 'admin-1', name: 'Admin One' },
                { _id: 'user-123', name: 'Worker' },
            ]),
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { userId: 'user-123', year: '2025', month: '7' },
        });
        const res = mockRes();

        await historyHandler(req, res);

        // Full chain for (user, month), chronological, actors resolved.
        expect(MonthlyApprovalEvent.find).toHaveBeenCalledWith({
            userId: 'user-123',
            year: 2025,
            month: 7,
        });
        expect(res.status).toHaveBeenCalledWith(200);
        const events = res.json.mock.calls[0][0].data.events;
        expect(events.map((e: any) => e.action)).toEqual([
            'opened',
            'confirmed',
            'revoked',
        ]);
        expect(events[0].actorName).toBe('Admin One');
        expect(events[1].actorName).toBe('Worker');
    });

    it('should return an empty list when there is no history', async () => {
        vi.mocked(MonthlyApprovalEvent.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([]),
            }),
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { userId: 'user-123', year: '2025', month: '8' },
        });
        const res = mockRes();

        await historyHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { events: [] },
        });
        // No actor lookup needed without events.
        expect(User.find).not.toHaveBeenCalled();
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({
            method: 'POST',
            query: { userId: 'user-123', year: '2025', month: '7' },
        });
        const res = mockRes();

        await historyHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
    });
});
