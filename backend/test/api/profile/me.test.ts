import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
  authenticateToken: (handler: Function) => {
    return async (req: any, res: any) => {
      req.user = { userId: 'user-123', email: 'test@example.com', role: 'employee' };
      return handler(req, res);
    };
  },
  AuthRequest: class {},
}));

vi.mock('@/models', () => ({
  User: {
    findById: vi.fn(),
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
        populate: vi.fn().mockResolvedValue(mockUser),
      }),
    } as any);

    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await profileMeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      user: mockUser,
    });
  });

  it('should return 404 if user not found', async () => {
    const { User } = await import('@/models');
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue(null),
      }),
    } as any);

    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await profileMeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'EntryNotFound',
      details: { entry: 'User' },
    });
  });

  it('should return 500 on database error', async () => {
    const { User } = await import('@/models');
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockReturnValue({
        populate: vi.fn().mockRejectedValue(new Error('DB Error')),
      }),
    } as any);

    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await profileMeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'GetError',
      details: {},
    });
  });
});
