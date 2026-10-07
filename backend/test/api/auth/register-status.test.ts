import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

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

    validateQueryParams:
        () => (req: any, res: any, next: (err?: unknown) => void) =>
            next(),
}));

vi.mock('@/models', () => ({
    User: {
        findOne: vi.fn(),
    },
}));

vi.mock('@/repositories/user-repository', () => ({
    findActiveByEmail: vi.fn(),
    notDeleted: { deleted: { $ne: true } },
}));

import registerStatusHandler from '@/pages/api/auth/register/[token]';

describe('GET /api/auth/register/[token]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({ method: 'POST', query: { token: 'tok' } });
        const res = mockRes();

        await registerStatusHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
    });

    it('should return pending when the invited account is not registered yet', async () => {
        const { findActiveByEmail } = await import(
            '@/repositories/user-repository'
        );
        vi.mocked(findActiveByEmail).mockResolvedValue({
            registered: false,
            registrationToken: 'tok',
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { token: 'tok', email: 'anna@example.com' },
        });
        const res = mockRes();

        await registerStatusHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { status: 'pending' },
        });
    });

    it('should return alreadyRegistered when the account is active, whatever the token', async () => {
        const { findActiveByEmail } = await import(
            '@/repositories/user-repository'
        );
        vi.mocked(findActiveByEmail).mockResolvedValue({
            registered: true,
            registrationToken: undefined,
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { token: 'a-dead-token', email: 'anna@example.com' },
        });
        const res = mockRes();

        await registerStatusHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { status: 'alreadyRegistered' },
        });
    });

    it('should return invalid when the token does not match a pending account', async () => {
        const { findActiveByEmail } = await import(
            '@/repositories/user-repository'
        );
        vi.mocked(findActiveByEmail).mockResolvedValue({
            registered: false,
            registrationToken: 'other-token',
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { token: 'tok', email: 'anna@example.com' },
        });
        const res = mockRes();

        await registerStatusHandler(req, res);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { status: 'invalid' },
        });
    });

    it('should return invalid when the email is unknown', async () => {
        const { findActiveByEmail } = await import(
            '@/repositories/user-repository'
        );
        vi.mocked(findActiveByEmail).mockResolvedValue(null);

        const req = mockReq({
            method: 'GET',
            query: { token: 'tok', email: 'nobody@example.com' },
        });
        const res = mockRes();

        await registerStatusHandler(req, res);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { status: 'invalid' },
        });
    });

    it('should fall back to the token alone when the link lost its email', async () => {
        const { User } = await import('@/models');
        vi.mocked(User.findOne).mockResolvedValue({ _id: 'u1' } as any);

        const req = mockReq({ method: 'GET', query: { token: 'tok' } });
        const res = mockRes();

        await registerStatusHandler(req, res);

        expect(User.findOne).toHaveBeenCalledWith({
            registrationToken: 'tok',
            registered: false,
            deleted: { $ne: true },
        });
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { status: 'pending' },
        });
    });

    it('should return invalid when no pending account matches the token alone', async () => {
        const { User } = await import('@/models');
        vi.mocked(User.findOne).mockResolvedValue(null);

        const req = mockReq({ method: 'GET', query: { token: 'tok' } });
        const res = mockRes();

        await registerStatusHandler(req, res);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { status: 'invalid' },
        });
    });
});