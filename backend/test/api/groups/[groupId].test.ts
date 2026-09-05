import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
    requireInGroupOrAdmin: (
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
    Group: {
        findById: vi.fn(),
    },
    User: {
        find: vi.fn(),
    },
}));

import { Group, User } from '@/models';
import groupHandler from '@/pages/api/groups/[groupId]';

const memberQuery = (docs: unknown[]) =>
    ({
        select: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(docs),
        }),
    }) as any;

describe('GET /api/groups/[groupId]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({ method: 'POST' });
        const res = mockRes();

        await groupHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return 200 with group on successful GET', async () => {
        const mockGroup = {
            _id: 'group-123',
            name: 'Test Group',
            description: 'Test Description',
            members: ['user-1'],
        };
        const mockMember = {
            _id: 'user-1',
            name: 'User 1',
            email: 'user1@example.com',
        };

        vi.mocked(Group.findById).mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockGroup),
        } as any);
        vi.mocked(User.find).mockReturnValue(memberQuery([mockMember]) as any);

        const req = mockReq({ method: 'GET', query: { groupId: 'group-123' } });
        const res = mockRes();

        await groupHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                group: { ...mockGroup, members: [mockMember] },
            },
        });
    });

    it('should preserve stored member order and exclude blocked/deleted users', async () => {
        const mockGroup = {
            _id: 'group-123',
            name: 'Test Group',
            members: ['user-2', 'user-1', 'user-3'],
        };

        vi.mocked(Group.findById).mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockGroup),
        } as any);
        // The DB returns users in its own order; user-3 was filtered out
        // (blocked/deleted) so only user-2 and user-1 come back.
        vi.mocked(User.find).mockReturnValue(
            memberQuery([
                { _id: 'user-1', name: 'User 1' },
                { _id: 'user-2', name: 'User 2' },
            ]) as any
        );

        const req = mockReq({ method: 'GET', query: { groupId: 'group-123' } });
        const res = mockRes();

        await groupHandler(req, res);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                group: {
                    ...mockGroup,
                    members: [
                        { _id: 'user-2', name: 'User 2' },
                        { _id: 'user-1', name: 'User 1' },
                    ],
                },
            },
        });
    });

    it('should return 404 if group not found', async () => {
        vi.mocked(Group.findById).mockReturnValue({
            lean: vi.fn().mockResolvedValue(null),
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { groupId: 'nonexistent' },
        });
        const res = mockRes();

        await groupHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'EntryNotFound',
            details: { entry: 'Group' },
        });
    });

    it('should return 500 on database error', async () => {
        vi.mocked(Group.findById).mockRejectedValue(new Error('DB Error'));

        const req = mockReq({ method: 'GET', query: { groupId: 'group-123' } });
        const res = mockRes();

        await groupHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });
});
