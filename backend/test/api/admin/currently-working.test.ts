import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
  requireRole: (roles: string[], handler: Function) => {
    return async (req: any, res: any) => {
      req.user = { userId: 'admin-123', email: 'admin@example.com', role: 'admin' };
      return handler(req, res);
    };
  },
  AuthRequest: class {},
}));

vi.mock('@/models', () => ({
  WorkSession: {
    aggregate: vi.fn(),
  },
  User: {
    find: vi.fn(),
  },
}));

import { WorkSession, User } from '@/models';
import currentlyWorkingHandler from '@/pages/api/admin/currently-working';

describe('GET /api/admin/currently-working', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not GET', async () => {
    const req = mockReq({ method: 'POST' });
    const res = mockRes();

    await currentlyWorkingHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 200 with users currently working', async () => {
    vi.mocked(WorkSession.aggregate).mockResolvedValue([
      { _id: 'user-1', latestSession: { type: 'check_in', timestamp: new Date() } },
      { _id: 'user-2', latestSession: { type: 'check_in', timestamp: new Date() } },
    ]);

    const mockUsers = [
      { _id: 'user-1', name: 'User 1', email: 'user1@example.com' },
      { _id: 'user-2', name: 'User 2', email: 'user2@example.com' },
    ];
    vi.mocked(User.find).mockResolvedValue(mockUsers);

    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await currentlyWorkingHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      count: 2,
      users: mockUsers,
    });
  });

  it('should return 200 with empty array when no users are working', async () => {
    vi.mocked(WorkSession.aggregate).mockResolvedValue([]);
    vi.mocked(User.find).mockResolvedValue([]);

    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await currentlyWorkingHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      count: 0,
      users: [],
    });
  });

  it('should return 500 on database error', async () => {
    vi.mocked(WorkSession.aggregate).mockRejectedValue(new Error('DB Error'));

    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await currentlyWorkingHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'GetError',
      details: {},
    });
  });
});
