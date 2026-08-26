import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq } from '../../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
  requireSameGroupOrAdmin: (handler: (req: any, res: any) => unknown) => {
    return async (req: any, res: any) => {
      req.user = { userId: 'user-123', email: 'test@example.com', role: 'employee' };
      return handler(req, res);
    };
  },
  AuthRequest: class {},
}));

vi.mock('@/lib/validation', () => ({
  validateQueryParams: () => (req: any, res: any, next: (err?: unknown) => void) => next(),
}));

vi.mock('@/lib/storage', () => ({
  AVATAR_MIME: 'image/jpeg',
  readAvatar: vi.fn(),
}));

vi.mock('@/models', () => ({
  User: {
    findById: vi.fn(),
  },
}));

import { User } from '@/models';
import { readAvatar } from '@/lib/storage';
import avatarServeHandler from '@/pages/api/profile/[userId]/avatar';

const mockRes = () => {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
};

describe('GET /api/profile/[userId]/avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not GET', async () => {
    const req = mockReq({ method: 'POST', query: { userId: 'user-123' } });
    const res = mockRes();

    await avatarServeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'MethodNotAllowed', details: {} });
  });

  it('should serve the avatar with the correct content type', async () => {
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue({ _id: 'user-123', avatar: 'user-123-1.png' }),
    } as any);
    vi.mocked(readAvatar).mockResolvedValue(Buffer.from('imagedata'));

    const req = mockReq({ method: 'GET', query: { userId: 'user-123' } });
    const res = mockRes();

    await avatarServeHandler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=31536000, immutable');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(Buffer.from('imagedata'));
  });

  it('should return 404 when user has no avatar', async () => {
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue({ _id: 'user-123', avatar: null }),
    } as any);

    const req = mockReq({ method: 'GET', query: { userId: 'user-123' } });
    const res = mockRes();

    await avatarServeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'EntryNotFound',
      details: { entry: 'Avatar' },
    });
  });

  it('should return 404 when the file is missing', async () => {
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue({ _id: 'user-123', avatar: 'user-123-1.png' }),
    } as any);
    vi.mocked(readAvatar).mockRejectedValue(new Error('ENOENT'));

    const req = mockReq({ method: 'GET', query: { userId: 'user-123' } });
    const res = mockRes();

    await avatarServeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});