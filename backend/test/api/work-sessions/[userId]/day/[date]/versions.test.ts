import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../../../utils/mocks';

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
import dayVersionsHandler from '@/pages/api/work-sessions/[userId]/day/[date]/versions';

describe('GET /api/work-sessions/[userId]/day/[date]/versions', () => {
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

        await dayVersionsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return the full version history (active and replaced)', async () => {
        const history = [
            {
                _id: 'day-1',
                userId: 'user-456',
                date: '2024-01-15',
                version: 1,
                status: 'replaced',
                replacedByVersion: 2,
                replacedAt: new Date('2024-01-15T09:10:00'),
                sessions: [
                    { type: 'check_in', time: '08:50', overtime: false },
                    { type: 'check_out', time: '17:00', overtime: false },
                ],
            },
            {
                _id: 'day-2',
                userId: 'user-456',
                date: '2024-01-15',
                version: 2,
                status: 'active',
                source: 'adminManual',
                editReason: 'Admin day correction',
                sessions: [
                    { type: 'check_in', time: '09:00', overtime: false },
                    { type: 'check_out', time: '17:30', overtime: false },
                ],
            },
        ];

        vi.mocked(WorkDaySessions.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue(history),
            }),
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { userId: 'user-456', date: '2024-01-15' },
        });
        const res = mockRes();

        await dayVersionsHandler(req, res);

        // Unlike the regular day reader, the versions endpoint must NOT
        // filter replaced documents: it returns every version, ascending.
        expect(WorkDaySessions.find).toHaveBeenCalledWith({
            userId: 'user-456',
            date: '2024-01-15',
        });
        expect(vi.mocked(WorkDaySessions.find).mock.results[0].value.sort).toHaveBeenCalledWith(
            { version: 1 }
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { workSessions: history },
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
            query: { userId: 'user-456', date: '2024-01-15' },
        });
        const res = mockRes();

        await dayVersionsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });
});
