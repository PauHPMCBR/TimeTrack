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

vi.mock('@/lib/mail', () => ({
    sendPasswordReset: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models', () => ({
    User: {
        findOne: vi.fn(),
        updateOne: vi.fn(),
    },
}));

vi.stubEnv('FRONTEND_URL', 'http://localhost:3000');

import { User } from '@/models';
import { sendPasswordReset } from '@/lib/mail';
import forgotPasswordHandler from '@/pages/api/auth/forgot-password';

describe('POST /api/auth/forgot-password', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not POST', async () => {
        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await forgotPasswordHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('emails a reset link to a registered user', async () => {
        const user = {
            _id: 'user-123',
            name: 'Test User',
            email: 'test@example.com',
        };
        vi.mocked(User.findOne).mockResolvedValue(user);

        const req = mockReq({
            method: 'POST',
            body: { email: 'TEST@example.com' },
        });
        const res = mockRes();

        await forgotPasswordHandler(req, res);

        expect(User.findOne).toHaveBeenCalledWith({
            email: 'test@example.com',
            registered: true,
        });
        expect(User.updateOne).toHaveBeenCalledWith(
            { _id: 'user-123' },
            expect.objectContaining({
                resetPasswordToken: expect.any(String),
                resetPasswordExpires: expect.any(Date),
            })
        );
        expect(sendPasswordReset).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'test@example.com',
                name: 'Test User',
                resetLink: expect.stringContaining(
                    'http://localhost:3000/reset-password?token='
                ),
                expiresHours: 1,
            })
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { message: 'ResetLinkSent' },
        });
    });

    it('does not email unknown accounts but still returns success (no enumeration)', async () => {
        vi.mocked(User.findOne).mockResolvedValue(null);

        const req = mockReq({
            method: 'POST',
            body: { email: 'nobody@example.com' },
        });
        const res = mockRes();

        await forgotPasswordHandler(req, res);

        expect(sendPasswordReset).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { message: 'ResetLinkSent' },
        });
    });
});