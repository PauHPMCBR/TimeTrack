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
    WorkSession: {
        find: vi.fn(),
    },
}));

import type { DateKey } from 'shared/src/lib/day-key';
import { WorkSession } from '@/models';
import workSessionRangeHandler from '@/pages/api/work-sessions/[userId]/range';
import { dayRange } from '@/lib/date-range';

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
        const mockSessions = [
            {
                _id: 'session-1',
                type: 'check_in',
                timestamp: new Date('2024-02-01T08:00:00'),
            },
            {
                _id: 'session-2',
                type: 'check_out',
                timestamp: new Date('2024-02-01T17:00:00'),
            },
        ];

        vi.mocked(WorkSession.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue(mockSessions),
            }),
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { userId: 'user-456', from: '2024-01-01', to: '2024-03-31' },
        });
        const res = mockRes();

        await workSessionRangeHandler(req, res);

        expect(WorkSession.find).toHaveBeenCalledWith({
            userId: 'user-456',
            timestamp: {
                $gte: dayRange('2024-01-01' as DateKey).start,
                $lt: dayRange('2024-03-31' as DateKey).end,
            },
            status: { $ne: 'replaced' },
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { workSessions: mockSessions },
        });
    });

    it('should return 500 on database error', async () => {
        vi.mocked(WorkSession.find).mockReturnValue({
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
