import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../../utils/mocks';

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

vi.mock('@/lib/sanitize', () => ({
    toPublicUser: (user: unknown) => user,
}));

vi.mock('@/models', () => ({
    User: {
        findById: vi.fn(),
        findOne: vi.fn(),
        updateOne: vi.fn(),
    },
    Group: {
        updateMany: vi.fn(),
    },
}));

import { User, Group } from '@/models';
import restoreUserHandler from '@/pages/api/admin/users/[userId]/restore';

describe('POST /api/admin/users/[userId]/restore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('clears the deleted flag and re-adds the user to their groups', async () => {
        vi.mocked(User.findById)
            .mockResolvedValueOnce({
                _id: 'user-1',
                role: 'employee',
                email: 'anna@example.com',
                deleted: true,
                groups: ['g1', 'g2'],
            } as any)
            .mockResolvedValueOnce({
                _id: 'user-1',
                role: 'employee',
                email: 'anna@example.com',
                deleted: false,
                groups: ['g1', 'g2'],
            } as any);
        vi.mocked(User.updateOne).mockResolvedValue({} as any);
        vi.mocked(Group.updateMany).mockResolvedValue({} as any);

        const req = mockReq({
            method: 'POST',
            query: { userId: 'user-1' },
        });
        const res = mockRes();

        await restoreUserHandler(req, res);

        expect(User.updateOne).toHaveBeenCalledWith(
            { _id: 'user-1' },
            {
                $set: { deleted: false, updatedAt: expect.any(Date) },
                $unset: { deletedAt: 1 },
            }
        );
        expect(Group.updateMany).toHaveBeenCalledWith(
            { _id: { $in: ['g1', 'g2'] } },
            { $addToSet: { members: 'user-1' } }
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects restoring when another non-deleted user holds the email', async () => {
        vi.mocked(User.findById).mockResolvedValue({
            _id: 'user-1',
            role: 'employee',
            email: 'anna@example.com',
            deleted: true,
            groups: [],
        } as any);
        vi.mocked(User.findOne).mockResolvedValue({
            _id: 'user-9',
            email: 'anna@example.com',
        } as any);

        const req = mockReq({
            method: 'POST',
            query: { userId: 'user-1' },
        });
        const res = mockRes();

        await restoreUserHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IncorrectParameter',
            details: {
                incorrectParameter: 'email',
                reasons: ['AlreadyExists'],
            },
        });
        expect(User.updateOne).not.toHaveBeenCalled();
    });

    it('allows restoring when only deleted users share the email', async () => {
        vi.mocked(User.findById)
            .mockResolvedValueOnce({
                _id: 'user-1',
                role: 'employee',
                email: 'anna@example.com',
                deleted: true,
                groups: [],
            } as any)
            .mockResolvedValueOnce({
                _id: 'user-1',
                role: 'employee',
                email: 'anna@example.com',
                deleted: false,
                groups: [],
            } as any);
        vi.mocked(User.findOne).mockResolvedValue(null as any);
        vi.mocked(User.updateOne).mockResolvedValue({} as any);
        vi.mocked(Group.updateMany).mockResolvedValue({} as any);

        const req = mockReq({
            method: 'POST',
            query: { userId: 'user-1' },
        });
        const res = mockRes();

        await restoreUserHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(User.updateOne).toHaveBeenCalled();
    });

    it('returns 404 when the user does not exist', async () => {
        vi.mocked(User.findById).mockResolvedValue(null as any);

        const req = mockReq({
            method: 'POST',
            query: { userId: 'missing' },
        });
        const res = mockRes();

        await restoreUserHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(User.updateOne).not.toHaveBeenCalled();
    });

    it('rejects restoring a user that is not deleted', async () => {
        vi.mocked(User.findById).mockResolvedValue({
            _id: 'user-1',
            role: 'employee',
            deleted: false,
            groups: [],
        } as any);

        const req = mockReq({
            method: 'POST',
            query: { userId: 'user-1' },
        });
        const res = mockRes();

        await restoreUserHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IncorrectParameter',
            details: {
                incorrectParameter: 'userId',
                reasons: ['NotDeleted'],
            },
        });
        expect(User.updateOne).not.toHaveBeenCalled();
    });

    it('returns 405 for other methods', async () => {
        const req = mockReq({ method: 'GET', query: { userId: 'user-1' } });
        const res = mockRes();

        await restoreUserHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
    });
});
