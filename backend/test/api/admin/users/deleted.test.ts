import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../utils/mocks';

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
    User: {
        find: vi.fn(),
    },
}));

import { User } from '@/models';
import deletedUsersHandler from '@/pages/api/admin/users/deleted';

describe('GET /api/admin/users/deleted', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('lists soft-deleted users sorted by deletion date', async () => {
        const deletedAt = new Date('2026-01-02T10:00:00Z');
        vi.mocked(User.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([
                    {
                        _id: 'user-1',
                        name: 'Anna',
                        email: 'anna@example.com',
                        deletedAt,
                    },
                ]),
            }),
        } as any);

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await deletedUsersHandler(req, res);

        expect(User.find).toHaveBeenCalledWith({ deleted: true });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                users: [
                    {
                        _id: 'user-1',
                        name: 'Anna',
                        email: 'anna@example.com',
                        deleted: true,
                        deletedAt: deletedAt.toISOString(),
                    },
                ],
            },
        });
    });

    it('returns 405 for other methods', async () => {
        const req = mockReq({ method: 'POST' });
        const res = mockRes();

        await deletedUsersHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
    });
});
