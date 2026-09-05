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
    validateRequestBody:
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
        findByIdAndUpdate: vi.fn(),
    },
}));

import { User } from '@/models';
import updateUserHandler from '@/pages/api/admin/users/[userId]';

describe('PUT /api/admin/users/[userId]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not PUT or GET', async () => {
        const req = mockReq({ method: 'DELETE', query: { userId: 'user-1' } });
        const res = mockRes();

        await updateUserHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return the registration link for a non-activated user (GET)', async () => {
        vi.mocked(User.findById).mockResolvedValue({
            _id: 'user-1',
            name: 'Anna',
            email: 'anna@example.com',
            registered: false,
            registrationToken: 'tok123',
        });

        const req = mockReq({ method: 'GET', query: { userId: 'user-1' } });
        const res = mockRes();

        await updateUserHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const payload = res.json.mock.calls[0][0];
        expect(payload.success).toBe(true);
        expect(payload.data.registrationLink).toContain('/register/tok123');
        expect(payload.data.registrationLink).toContain('anna%40example.com');
    });

    it('should return null registration link for an activated user (GET)', async () => {
        vi.mocked(User.findById).mockResolvedValue({
            _id: 'user-1',
            name: 'Anna',
            email: 'anna@example.com',
            registered: true,
            registrationToken: 'tok123',
        });

        const req = mockReq({ method: 'GET', query: { userId: 'user-1' } });
        const res = mockRes();

        await updateUserHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const payload = res.json.mock.calls[0][0];
        expect(payload.data.registrationLink).toBeNull();
    });

    it('should return 404 if user does not exist', async () => {
        vi.mocked(User.findById).mockResolvedValue(null);

        const req = mockReq({
            method: 'PUT',
            query: { userId: 'missing-user' },
            body: { name: 'New Name' },
        });
        const res = mockRes();

        await updateUserHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'EntryNotFound',
            details: { entry: 'User' },
        });
    });

    it('should return 400 if email is taken by another user', async () => {
        vi.mocked(User.findById).mockResolvedValue({
            _id: 'user-1',
            email: 'old@example.com',
        });
        vi.mocked(User.findOne).mockResolvedValue({ _id: 'other-user' });

        const req = mockReq({
            method: 'PUT',
            query: { userId: 'user-1' },
            body: { email: 'taken@example.com' },
        });
        const res = mockRes();

        await updateUserHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IncorrectParameter',
            details: {
                incorrectParameter: 'email',
                reasons: ['AlreadyExists'],
            },
        });
    });

    it('should update user and return sanitized user on success', async () => {
        const existingUser: any = {
            _id: 'user-1',
            email: 'old@example.com',
            save: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(User.findById).mockResolvedValue(existingUser);
        vi.mocked(User.findOne).mockResolvedValue(null);

        const req = mockReq({
            method: 'PUT',
            query: { userId: 'user-1' },
            body: {
                name: 'Updated Name',
                email: 'new@example.com',
                dni: '12345678A',
                expectedWorkHours: 7.5,
            },
        });
        const res = mockRes();

        await updateUserHandler(req, res);

        expect(existingUser.name).toBe('Updated Name');
        expect(existingUser.email).toBe('new@example.com');
        expect(existingUser.dni).toBe('12345678A');
        expect(existingUser.expectedWorkHours).toBe(7.5);
        expect(existingUser.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    user: expect.objectContaining({
                        name: 'Updated Name',
                        expectedWorkHours: 7.5,
                    }),
                }),
            })
        );
    });

    it('should update trackingStartDate when provided', async () => {
        const existingUser: any = {
            _id: 'user-1',
            email: 'old@example.com',
            save: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(User.findById).mockResolvedValue(existingUser);

        const req = mockReq({
            method: 'PUT',
            query: { userId: 'user-1' },
            body: { trackingStartDate: '2024-01-15' },
        });
        const res = mockRes();

        await updateUserHandler(req, res);

        const expected = new Date('2024-01-15T00:00:00');
        expect(existingUser.trackingStartDate.getTime()).toBe(
            expected.getTime()
        );
        expect(existingUser.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should reject an invalid trackingStartDate', async () => {
        const existingUser: any = {
            _id: 'user-1',
            email: 'old@example.com',
            save: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(User.findById).mockResolvedValue(existingUser);

        const req = mockReq({
            method: 'PUT',
            query: { userId: 'user-1' },
            body: { trackingStartDate: 'not-a-date' },
        });
        const res = mockRes();

        await updateUserHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IncorrectParameter',
            details: expect.objectContaining({
                incorrectParameter: 'trackingStartDate',
            }),
        });
        expect(existingUser.save).not.toHaveBeenCalled();
    });

    it('should invalidate the password with an unknown hash when requested', async () => {
        const existingUser: any = {
            _id: 'user-1',
            email: 'old@example.com',
            name: 'Anna',
            resetPasswordToken: 'stale-token',
            resetPasswordExpires: new Date(),
            save: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(User.findById).mockResolvedValue(existingUser);

        const req = mockReq({
            method: 'PUT',
            query: { userId: 'user-1' },
            body: { invalidatePassword: true },
        });
        const res = mockRes();

        await updateUserHandler(req, res);

        // A random, unknowable hash is set and any stale reset token cleared.
        expect(existingUser.password).toBeDefined();
        expect(existingUser.resetPasswordToken).toBeUndefined();
        expect(existingUser.resetPasswordExpires).toBeUndefined();
        expect(existingUser.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should ignore an explicit password (admins cannot set a known password)', async () => {
        const existingUser: any = {
            _id: 'user-1',
            email: 'old@example.com',
            name: 'Anna',
            password: 'old-hash',
            save: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(User.findById).mockResolvedValue(existingUser);

        const req = mockReq({
            method: 'PUT',
            query: { userId: 'user-1' },
            body: { password: 'NewPassword123!' },
        });
        const res = mockRes();

        await updateUserHandler(req, res);

        expect(existingUser.password).toBe('old-hash');
        expect(existingUser.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should reject demoting an admin', async () => {
        const existingUser: any = {
            _id: 'user-1',
            role: 'admin',
            save: vi.fn().mockResolvedValue(true),
        };
        vi.mocked(User.findById).mockResolvedValue(existingUser);

        const req = mockReq({
            method: 'PUT',
            query: { userId: 'user-1' },
            body: { role: 'employee' },
        });
        const res = mockRes();

        await updateUserHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IncorrectParameter',
            details: {
                incorrectParameter: 'role',
                reasons: ['CannotDemoteAdmin'],
            },
        });
        expect(existingUser.save).not.toHaveBeenCalled();
    });

    it('should return 500 on database error', async () => {
        vi.mocked(User.findById).mockRejectedValue(new Error('DB Error'));

        const req = mockReq({
            method: 'PUT',
            query: { userId: 'user-1' },
            body: { name: 'New Name' },
        });
        const res = mockRes();

        await updateUserHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'PutError',
            details: {},
        });
    });
});
