import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../../utils/mocks';

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
        findOne: vi.fn(),
    },
}));

import { WorkDaySessions } from '@/models';
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
        const mockDay = {
            _id: 'day-1',
            userId: 'user-456',
            date: '2024-01-15',
            source: 'userClick',
            sessions: [
                { type: 'check_in', time: '08:00', overtime: false },
                { type: 'check_out', time: '17:00', overtime: false },
            ],
        };

        vi.mocked(WorkDaySessions.findOne).mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockDay),
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { userId: 'user-456', date: '2024-01-15' },
        });
        const res = mockRes();

        await workSessionDayHandler(req, res);

        // Day bucket is the raw "YYYY-MM-DD" key compared inclusively;
        // replaced versions are excluded.
        expect(WorkDaySessions.findOne).toHaveBeenCalledWith(
            {
                userId: 'user-456',
                date: '2024-01-15',
                status: { $ne: 'replaced' },
            },
            undefined,
            undefined
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { workSessions: mockDay.sessions },
        });
    });

    it('should return 500 on database error', async () => {
        vi.mocked(WorkDaySessions.findOne).mockReturnValue({
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
