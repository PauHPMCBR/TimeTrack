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

vi.mock('@/models', () => ({
    WorkDaySessions: {
        aggregate: vi.fn(),
    },
    User: {
        find: vi.fn(),
    },
}));

import { WorkDaySessions, User } from '@/models';
import currentlyWorkingHandler from '@/pages/api/admin/currently-working';

describe('GET /api/admin/currently-working', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.resetModules();
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({ method: 'POST' });
        const res = mockRes();

        await currentlyWorkingHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return 200 with users currently working', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-06-10T10:00:00Z'));

        vi.mocked(WorkDaySessions.aggregate).mockResolvedValue([
            {
                _id: 'user-1',
                userId: 'user-1',
                date: '2024-06-10',
                sessions: [{ type: 'check_in', time: '12:00' }],
            },
            {
                _id: 'user-2',
                userId: 'user-2',
                date: '2024-06-10',
                sessions: [{ type: 'check_in', time: '12:00' }],
            },
        ]);

        const mockUsers = [
            { _id: 'user-1', name: 'User 1', email: 'user1@example.com' },
            { _id: 'user-2', name: 'User 2', email: 'user2@example.com' },
        ];
        vi.mocked(User.find).mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockUsers),
        } as any);

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await currentlyWorkingHandler(req, res);

        const pipeline = vi.mocked(WorkDaySessions.aggregate).mock.calls[0][0];
        expect(pipeline[0]).toEqual({
            $match: { date: '2024-06-10', status: { $ne: 'replaced' } },
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                count: 2,
                users: mockUsers,
            },
        });
    });

    it('should return 200 with empty array when no users are working', async () => {
        vi.mocked(WorkDaySessions.aggregate).mockResolvedValue([]);
        vi.mocked(User.find).mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
        } as any);

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await currentlyWorkingHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                count: 0,
                users: [],
            },
        });
    });

    it('should return 500 on database error', async () => {
        vi.mocked(WorkDaySessions.aggregate).mockRejectedValue(
            new Error('DB Error')
        );

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await currentlyWorkingHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });
});
