import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
    requireSelfOrAdmin: (
        handler: (req: unknown, res: unknown) => unknown
    ) => {
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
        () => (req: any, res: any, next: (err?: unknown) => void) =>
            next(),
}));

vi.mock('@/models', () => ({
    WorkDaySessions: {
        find: vi.fn(),
    },
}));

import { WorkDaySessions } from '@/models';
import workSessionRangeHandler from '@/pages/api/work-sessions/[userId]/range';

describe('GET /api/work-sessions/[userId]/range', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({
            method: 'POST',
            query: { userId: 'user-456', from: '2024-01-01', to: '2024-03-31' },
        });
        const res = mockRes();

        await workSessionRangeHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return 200 with sessions within the range on successful GET', async () => {
        const mockDaySessions = [
            {
                _id: 'day-1',
                userId: 'user-456',
                date: '2024-02-01',
                source: 'userClick',
                sessions: [
                    { type: 'check_in', time: '08:00', overtime: false },
                    { type: 'check_out', time: '17:00', overtime: false },
                ],
            },
        ];

        vi.mocked(WorkDaySessions.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue(mockDaySessions),
            }),
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { userId: 'user-456', from: '2024-01-01', to: '2024-03-31' },
        });
        const res = mockRes();

        await workSessionRangeHandler(req, res);

        expect(WorkDaySessions.find).toHaveBeenCalledWith({
            userId: 'user-456',
            date: { $gte: '2024-01-01', $lte: '2024-03-31' },
            status: { $ne: 'replaced' },
        });
        expect(
            vi.mocked(WorkDaySessions.find).mock.results[0].value.sort
        ).toHaveBeenCalledWith({ date: 1 });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { daySessions: mockDaySessions },
        });
    });

    it('should return 500 on database error', async () => {
        vi.mocked(WorkDaySessions.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockRejectedValue(new Error('DB Error')),
            }),
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { userId: 'user-456', from: '2024-01-01', to: '2024-03-31' },
        });
        const res = mockRes();

        await workSessionRangeHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });
});
