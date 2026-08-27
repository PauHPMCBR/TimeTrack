import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
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

vi.mock('@/lib/auth', () => ({
    signToken: vi.fn().mockReturnValue('jwt-token'),
}));

vi.mock('@/models', () => ({
    User: {
        findOne: vi.fn(),
    },
}));

vi.stubEnv('JWT_SECRET', 'test-secret-for-testing');

import { User } from '@/models';
import resetPasswordHandler from '@/pages/api/auth/reset-password';

function makeUser(overrides: any = {}) {
    return {
        _id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'employee',
        registered: true,
        resetPasswordToken: 'reset-token',
        resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000),
        failedLoginAttempts: 0,
        blocked: false,
        blockedSince: undefined,
        password: undefined,
        save: vi.fn().mockResolvedValue({}),
        toObject: vi.fn().mockReturnValue({}),
        ...overrides,
    };
}

describe('POST /api/auth/reset-password', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not POST', async () => {
        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await resetPasswordHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('rejects an invalid reset token', async () => {
        vi.mocked(User.findOne).mockResolvedValue(null);

        const req = mockReq({
            method: 'POST',
            body: {
                token: 'wrong',
                email: 'test@example.com',
                password: 'StrongPass1!',
            },
        });
        const res = mockRes();

        await resetPasswordHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'InvalidResetToken',
            details: {},
        });
    });

    it('rejects an expired reset token', async () => {
        vi.mocked(User.findOne).mockResolvedValue(
            makeUser({
                resetPasswordExpires: new Date(Date.now() - 1000),
            })
        );

        const req = mockReq({
            method: 'POST',
            body: {
                token: 'reset-token',
                email: 'test@example.com',
                password: 'StrongPass1!',
            },
        });
        const res = mockRes();

        await resetPasswordHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'ResetTokenExpired',
            details: {},
        });
    });

    it('sets the new password, clears the token and returns a session token', async () => {
        const user = makeUser();
        vi.mocked(User.findOne).mockResolvedValue(user);

        const req = mockReq({
            method: 'POST',
            body: {
                token: 'reset-token',
                email: 'test@example.com',
                password: 'StrongPass1!',
            },
        });
        const res = mockRes();

        await resetPasswordHandler(req, res);

        expect(user.password).toBe('StrongPass1!');
        expect(user.resetPasswordToken).toBeUndefined();
        expect(user.resetPasswordExpires).toBeUndefined();
        expect(user.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({ token: 'jwt-token' }),
            })
        );
    });

    it('rejects a password that fails the policy', async () => {
        vi.mocked(User.findOne).mockResolvedValue(makeUser());

        const req = mockReq({
            method: 'POST',
            body: {
                token: 'reset-token',
                email: 'test@example.com',
                password: 'short',
            },
        });
        const res = mockRes();

        await resetPasswordHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IncorrectParameter',
            details: {
                incorrectParameter: 'password',
                reasons: ['TooShort', 'MissingUppercase', 'MissingNumber', 'MissingSign'],
            },
        });
    });
});