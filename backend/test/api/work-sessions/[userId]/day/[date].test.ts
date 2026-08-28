import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../../utils/mocks';

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

import { WorkSession } from '@/models';
import workSessionDayHandler from '@/pages/api/work-sessions/[userId]/day/[date]';

describe('GET /api/work-sessions/[userId]/day/[date]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({
            method: 'POST',
            query: { userId: 'user-456', date: '2024-01-15' },
        });
        const res = mockRes();

        await workSessionDayHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return 200 with sessions on successful GET', async () => {
        const mockSessions = [
            {
                _id: 'session-1',
                type: 'check_in',
                timestamp: new Date('2024-01-15T08:00:00'),
            },
            {
                _id: 'session-2',
                type: 'check_out',
                timestamp: new Date('2024-01-15T17:00:00'),
            },
        ];

        vi.mocked(WorkSession.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue(mockSessions),
            }),
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { userId: 'user-456', date: '2024-01-15' },
        });
        const res = mockRes();

        await workSessionDayHandler(req, res);

        // Day bucket must be the local calendar day, derived from the raw
        // "YYYY-MM-DD" string (independent of the server timezone).
        expect(WorkSession.find).toHaveBeenCalledWith({
            userId: 'user-456',
            timestamp: {
                $gte: new Date(2024, 0, 15, 0, 0, 0, 0),
                $lt: new Date(2024, 0, 16, 0, 0, 0, 0),
            },
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
            query: { userId: 'user-456', date: '2024-01-15' },
        });
        const res = mockRes();

        await workSessionDayHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });
});
