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

vi.mock('@/lib/validation', () => ({
    runValidation: async (middleware: any, req: any, res: any) => {
        await new Promise((resolve) =>
            middleware(req, res, () => resolve(true))
        );
        return !res.headersSent;
    },
    validateRequestBody:
        () => (req: any, res: any, next: (err?: unknown) => void) =>
            next(),
}));

vi.mock('@/models', () => ({
    User: {
        findById: vi.fn(),
        findByIdAndUpdate: vi.fn(),
    },
}));

import profileMeHandler from '@/pages/api/profile/me';

describe('GET /api/profile/me', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({ method: 'POST' });
        const res = mockRes();

        await profileMeHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return 200 with user profile on successful GET', async () => {
        const mockUser = {
            _id: 'user-123',
            name: 'Test User',
            email: 'test@example.com',
            role: 'employee',
            groups: [],
        };

        const { User } = await import('@/models');
        vi.mocked(User.findById).mockReturnValue({
            select: vi.fn().mockReturnValue({
                populate: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue(mockUser),
                }),
            }),
        } as any);

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await profileMeHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { user: mockUser },
        });
    });

    it('should return 404 if user not found', async () => {
        const { User } = await import('@/models');
        vi.mocked(User.findById).mockReturnValue({
            select: vi.fn().mockReturnValue({
                populate: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue(null),
                }),
            }),
        } as any);

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await profileMeHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'EntryNotFound',
            details: { entry: 'User' },
        });
    });

    it('should return 500 on database error', async () => {
        const { User } = await import('@/models');
        vi.mocked(User.findById).mockReturnValue({
            select: vi.fn().mockReturnValue({
                populate: vi.fn().mockReturnValue({
                    lean: vi.fn().mockRejectedValue(new Error('DB Error')),
                }),
            }),
        } as any);

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await profileMeHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });
});

describe('PUT /api/profile/me (automatic timetable)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('updates the user auto timetable and returns the updated profile', async () => {
        const { User } = await import('@/models');
        const updated = {
            _id: 'user-123',
            name: 'Test User',
            email: 'test@example.com',
            role: 'employee',
            autoTimetable: [
                { checkIn: '08:30', checkOut: '16:30' },
                { checkIn: '14:00', checkOut: '18:00' },
            ],
        };
        vi.mocked(User.findByIdAndUpdate).mockReturnValue({
            select: vi.fn().mockReturnValue({
                populate: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue(updated),
                }),
            }),
        } as any);

        const req = mockReq({
            method: 'PUT',
            body: {
                autoTimetable: updated.autoTimetable,
            },
        });
        const res = mockRes();

        await profileMeHandler(req, res);

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
            'user-123',
            expect.objectContaining({
                autoTimetable: updated.autoTimetable,
            }),
            { new: true }
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { user: updated },
        });
    });

    it('returns 404 when the user does not exist', async () => {
        const { User } = await import('@/models');
        vi.mocked(User.findByIdAndUpdate).mockReturnValue({
            select: vi.fn().mockReturnValue({
                populate: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue(null),
                }),
            }),
        } as any);

        const req = mockReq({
            method: 'PUT',
            body: { autoTimetable: [{ checkIn: '09:00', checkOut: '17:00' }] },
        });
        const res = mockRes();

        await profileMeHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'EntryNotFound',
            details: { entry: 'User' },
        });
    });
});

describe('PUT /api/profile/me (password change)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    function chain(updated: unknown) {
        return {
            select: vi.fn().mockReturnValue({
                populate: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue(updated),
                }),
            }),
        } as any;
    }

    it('changes the password when current password matches', async () => {
        const { User } = await import('@/models');
        const userDoc: any = {
            _id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            comparePassword: vi.fn().mockResolvedValue(true),
            save: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(User.findById).mockResolvedValue(userDoc);
        vi.mocked(User.findByIdAndUpdate).mockReturnValue(
            chain({ _id: 'user-123' })
        );

        const req = mockReq({
            method: 'PUT',
            body: {
                password: 'NewPassword123!',
                currentPassword: 'OldPassword1!',
            },
        });
        const res = mockRes();

        await profileMeHandler(req, res);

        expect(userDoc.comparePassword).toHaveBeenCalledWith('OldPassword1!');
        expect(userDoc.password).toBe('NewPassword123!');
        expect(userDoc.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects a password change without the current password', async () => {
        const { User } = await import('@/models');
        const userDoc: any = {
            _id: 'user-123',
            comparePassword: vi.fn(),
            save: vi.fn(),
        };
        vi.mocked(User.findById).mockResolvedValue(userDoc);

        const req = mockReq({
            method: 'PUT',
            body: { password: 'NewPassword123!' },
        });
        const res = mockRes();

        await profileMeHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IncorrectParameter',
            details: {
                incorrectParameter: 'password',
                reasons: ['CurrentPasswordRequired'],
            },
        });
        expect(userDoc.save).not.toHaveBeenCalled();
    });

    it('rejects an incorrect current password', async () => {
        const { User } = await import('@/models');
        const userDoc: any = {
            _id: 'user-123',
            comparePassword: vi.fn().mockResolvedValue(false),
            save: vi.fn(),
        };
        vi.mocked(User.findById).mockResolvedValue(userDoc);

        const req = mockReq({
            method: 'PUT',
            body: {
                password: 'NewPassword123!',
                currentPassword: 'WrongPassword1!',
            },
        });
        const res = mockRes();

        await profileMeHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IncorrectParameter',
            details: {
                incorrectParameter: 'currentPassword',
                reasons: ['InvalidCurrentPassword'],
            },
        });
        expect(userDoc.save).not.toHaveBeenCalled();
    });

    it('rejects a new password that fails the policy', async () => {
        const { User } = await import('@/models');
        const userDoc: any = {
            _id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            comparePassword: vi.fn().mockResolvedValue(true),
            save: vi.fn(),
        };
        vi.mocked(User.findById).mockResolvedValue(userDoc);

        const req = mockReq({
            method: 'PUT',
            body: {
                password: 'short',
                currentPassword: 'OldPassword1!',
            },
        });
        const res = mockRes();

        await profileMeHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IncorrectParameter',
            details: {
                incorrectParameter: 'password',
                reasons: [
                    'TooShort',
                    'MissingUppercase',
                    'MissingNumber',
                    'MissingSign',
                ],
            },
        });
        expect(userDoc.save).not.toHaveBeenCalled();
    });
});
