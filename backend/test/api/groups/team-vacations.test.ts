import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
    authenticateToken: (handler: (req: unknown, res: unknown) => unknown) => {
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

vi.mock('@/models', () => ({
    User: {
        findById: vi.fn(),
        find: vi.fn(),
    },
    Group: {
        find: vi.fn(),
    },
    ElectiveVacation: {
        find: vi.fn(),
    },
}));

import { User, Group, ElectiveVacation } from '@/models';
import teamVacationsHandler from '@/pages/api/groups/team-vacations';

describe('GET /api/groups/team-vacations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({ method: 'POST' });
        const res = mockRes();

        await teamVacationsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return 400 if year is not provided', async () => {
        const req = mockReq({ method: 'GET', query: {} });
        const res = mockRes();

        await teamVacationsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'YearRequired' });
    });

    it('should return 404 if user not found', async () => {
        vi.mocked(User.findById).mockReturnValue({
            lean: vi.fn().mockResolvedValue(null),
        } as any);

        const req = mockReq({ method: 'GET', query: { year: '2024' } });
        const res = mockRes();

        await teamVacationsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'UserNotFound' });
    });

    it('should return 200 with vacations on successful GET', async () => {
        vi.mocked(User.findById).mockReturnValue({
            lean: vi
                .fn()
                .mockResolvedValue({ _id: 'user-123', groups: ['group-1'] }),
        } as any);

        vi.mocked(Group.find).mockReturnValue({
            lean: vi
                .fn()
                .mockResolvedValue([
                    { _id: 'group-1', members: ['user-456', 'user-789'] },
                ]),
        } as any);

        const mockVacations = [
            {
                _id: 'vacation-1',
                userId: 'user-456',
                approvedBy: 'admin-1',
                date: new Date('2024-06-15'),
            },
        ];
        vi.mocked(ElectiveVacation.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue(mockVacations),
            }),
        } as any);

        vi.mocked(User.find)
            // Active members filter (called with second arg '_id', no .select()).
            .mockReturnValueOnce({
                lean: vi.fn().mockResolvedValue([
                    { _id: 'user-456' },
                    { _id: 'user-789' },
                ]),
            } as any)
            // resolveVacationNames calls User.find().select('name email').lean().
            .mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue([
                        {
                            _id: 'user-456',
                            name: 'User 1',
                            email: 'user1@example.com',
                        },
                        {
                            _id: 'admin-1',
                            name: 'System Administrator',
                            email: 'admin@example.com',
                        },
                    ]),
                }),
            } as any);

        const req = mockReq({ method: 'GET', query: { year: '2024' } });
        const res = mockRes();

        await teamVacationsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                vacations: [
                    {
                        ...mockVacations[0],
                        userId: {
                            _id: 'user-456',
                            name: 'User 1',
                            email: 'user1@example.com',
                        },
                        approvedByName: 'System Administrator',
                    },
                ],
            },
        });
    });

    it('should return 500 on database error', async () => {
        vi.mocked(User.findById).mockRejectedValue(new Error('DB Error'));

        const req = mockReq({ method: 'GET', query: { year: '2024' } });
        const res = mockRes();

        await teamVacationsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });
});
