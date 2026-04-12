import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
  requireSameGroupOrAdmin: (handler: Function) => {
    return async (req: any, res: any) => {
      req.user = { userId: 'user-123', email: 'test@example.com', role: 'employee' };
      return handler(req, res);
    };
  },
  AuthRequest: class {},
}));

vi.mock('@/lib/validation', () => ({
  validateQueryParams: () => (req: any, res: any, next: Function) => next(),
}));

vi.mock('@/models', () => ({
  User: {
    findById: vi.fn(),
  },
}));

import profileUserHandler from '@/pages/api/profile/[userId]';

describe('GET /api/profile/[userId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not GET', async () => {
    const req = mockReq({ method: 'POST' });
    const res = mockRes();

    await profileUserHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 200 with user profile on successful GET', async () => {
    const mockUser = {
      _id: 'user-456',
      name: 'Other User',
      email: 'other@example.com',
      role: 'employee',
      groups: [],
    };

    const { User } = await import('@/models');
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockUser),
      }),
    } as any);

    const req = mockReq({ method: 'GET', query: { userId: 'user-456' } });
    const res = mockRes();

    await profileUserHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockUser);
  });

  it('should return 404 if user not found', async () => {
    const { User } = await import('@/models');
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue(null),
      }),
    } as any);

    const req = mockReq({ method: 'GET', query: { userId: 'nonexistent' } });
    const res = mockRes();

    await profileUserHandler(req, res);

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

    const req = mockReq({ method: 'GET', query: { userId: 'user-456' } });
    const res = mockRes();

    await profileUserHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'GetError',
      details: {},
    });
  });
});
