import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/settings', () => ({
    getAppSettings: vi.fn(),
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
    User: { findById: vi.fn() },
}));

import { User } from '@/models';
import { getAppSettings } from '@/lib/settings';
import publicPrivacyNoticeHandler from '@/pages/api/public/privacy-notice';
import privacyAckHandler from '@/pages/api/me/privacy-acknowledgment';

describe('GET /api/public/privacy-notice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return only the notice text without leaking other settings', async () => {
        vi.mocked(getAppSettings).mockResolvedValue({
            privacyNoticeText: 'Avis de privacitat...',
            timezone: 'Europe/Madrid',
        } as any);

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await publicPrivacyNoticeHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { privacyNoticeText: 'Avis de privacitat...' },
        });
        // Nothing else from the settings document may leak publicly.
        const payload = res.json.mock.calls[0][0];
        expect(Object.keys(payload.data)).toEqual(['privacyNoticeText']);
    });

    it('should return an empty text when no notice is configured', async () => {
        vi.mocked(getAppSettings).mockResolvedValue({
            privacyNoticeText: '',
        } as any);

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await publicPrivacyNoticeHandler(req, res);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { privacyNoticeText: '' },
        });
    });
});

describe('POST /api/me/privacy-acknowledgment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should record the first acknowledgment timestamp', async () => {
        const user: {
            _id: string;
            deleted: boolean;
            privacyNoticeAcknowledgedAt?: Date;
            save: () => Promise<unknown>;
        } = {
            _id: 'user-123',
            deleted: false,
            save: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(User.findById).mockResolvedValue(user as any);

        const req = mockReq({ method: 'POST' });
        const res = mockRes();

        await privacyAckHandler(req, res);

        expect(user.privacyNoticeAcknowledgedAt).toBeInstanceOf(Date);
        expect(user.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { acknowledgedAt: user.privacyNoticeAcknowledgedAt },
        });
    });

    it('should be idempotent: the first timestamp is kept', async () => {
        const first = new Date('2026-01-01T10:00:00');
        const user = {
            _id: 'user-123',
            deleted: false,
            privacyNoticeAcknowledgedAt: first,
            save: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(User.findById).mockResolvedValue(user as any);

        const req = mockReq({ method: 'POST' });
        const res = mockRes();

        await privacyAckHandler(req, res);

        expect(user.privacyNoticeAcknowledgedAt).toBe(first);
        expect(user.save).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { acknowledgedAt: first },
        });
    });

    it('should return 404 for a deleted user', async () => {
        vi.mocked(User.findById).mockResolvedValue({
            _id: 'user-123',
            deleted: true,
        } as any);

        const req = mockReq({ method: 'POST' });
        const res = mockRes();

        await privacyAckHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'EntryNotFound',
            details: { entry: 'User' },
        });
    });
});
