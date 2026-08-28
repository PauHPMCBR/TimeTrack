import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../../../utils/mocks';

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
                _id: 's1',
                type: 'check_in',
                timestamp: new Date('2024-01-15T08:50:00'),
                version: 1,
                status: 'replaced',
                replacedByVersion: 2,
                replacedAt: new Date('2024-01-15T09:10:00'),
            },
            {
                _id: 's2',
                type: 'check_out',
                timestamp: new Date('2024-01-15T17:00:00'),
                version: 1,
                status: 'replaced',
                replacedByVersion: 2,
                replacedAt: new Date('2024-01-15T09:10:00'),
            },
            {
                _id: 's3',
                type: 'check_in',
                timestamp: new Date('2024-01-15T09:00:00'),
                version: 2,
                status: 'active',
                source: 'admin',
                notes: 'Admin day correction',
            },
            {
                _id: 's4',
                type: 'check_out',
                timestamp: new Date('2024-01-15T17:30:00'),
                version: 2,
                status: 'active',
                source: 'admin',
                notes: 'Admin day correction',
            },
        ];

        vi.mocked(WorkSession.find).mockReturnValue({
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
        // filter replaced documents: it returns every version, ordered by
        // version then timestamp.
        expect(WorkSession.find).toHaveBeenCalledWith({
            userId: 'user-456',
            timestamp: {
                $gte: new Date(2024, 0, 15, 0, 0, 0, 0),
                $lt: new Date(2024, 0, 16, 0, 0, 0, 0),
            },
        });
        expect(vi.mocked(WorkSession.find).mock.results[0].value.sort).toHaveBeenCalledWith(
            { version: 1, timestamp: 1 }
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { workSessions: history },
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

        await dayVersionsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });
});
