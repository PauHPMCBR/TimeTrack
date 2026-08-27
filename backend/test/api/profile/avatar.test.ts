import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
    authenticateToken: (handler: (req: any, res: any) => unknown) => {
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
    validateRequestBody:
        () => (req: any, res: any, next: (err?: unknown) => void) =>
            next(),
}));

vi.mock('@/lib/storage', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/storage')>();
    return {
        ...actual,
        saveAvatar: vi.fn(),
    };
});

vi.mock('@/models', () => ({
    User: {
        findByIdAndUpdate: vi.fn(),
    },
}));

import { User } from '@/models';
import { saveAvatar, AVATAR_MAX_BYTES } from '@/lib/storage';
import avatarHandler from '@/pages/api/profile/avatar';

const TINY_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('POST /api/profile/avatar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not POST', async () => {
        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await avatarHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should upload a valid avatar and update the user', async () => {
        vi.mocked(saveAvatar).mockResolvedValue('user-123-1700000000000.jpg');
        vi.mocked(User.findByIdAndUpdate).mockResolvedValue({
            _id: 'user-123',
            avatar: 'user-123-1700000000000.jpg',
        });

        const req = mockReq({ method: 'POST', body: { dataUrl: TINY_PNG } });
        const res = mockRes();

        await avatarHandler(req, res);

        expect(saveAvatar).toHaveBeenCalledWith('user-123', expect.any(Buffer));
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
            'user-123',
            expect.objectContaining({ avatar: 'user-123-1700000000000.jpg' }),
            { new: true }
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { avatar: 'user-123-1700000000000.jpg' },
        });
    });

    it('should reject a payload that is not an image', async () => {
        const req = mockReq({
            method: 'POST',
            body: {
                dataUrl:
                    'data:image/png;base64,' +
                    Buffer.from('not an image').toString('base64'),
            },
        });
        const res = mockRes();

        await avatarHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IncorrectParameter',
            details: {
                incorrectParameter: 'avatar',
                reasons: ['InvalidAvatarFormat'],
            },
        });
    });

    it('should reject an oversized image', async () => {
        const big = Buffer.alloc(AVATAR_MAX_BYTES + 1, 0x00);
        const req = mockReq({
            method: 'POST',
            body: {
                dataUrl: 'data:image/png;base64,' + big.toString('base64'),
            },
        });
        const res = mockRes();

        await avatarHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IncorrectParameter',
            details: {
                incorrectParameter: 'avatar',
                reasons: ['AvatarTooLarge'],
            },
        });
    });

    it('should return 500 on database error', async () => {
        vi.mocked(saveAvatar).mockResolvedValue('user-123-1700000000000.jpg');
        vi.mocked(User.findByIdAndUpdate).mockRejectedValue(
            new Error('DB Error')
        );

        const req = mockReq({ method: 'POST', body: { dataUrl: TINY_PNG } });
        const res = mockRes();

        await avatarHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'PostError',
            details: {},
        });
    });
});
