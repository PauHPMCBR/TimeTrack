import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../utils/mocks';

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
  Group: {
    find: vi.fn(),
  },
}));

import groupUserHandler from '@/pages/api/groups/user/[userId]';

describe('GET /api/groups/user/[userId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not GET', async () => {
    const req = mockReq({ method: 'POST' });
    const res = mockRes();

    await groupUserHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 200 with groups on successful GET', async () => {
    const mockGroups = [
      { _id: 'group-1', name: 'Group A', description: 'Description A' },
      { _id: 'group-2', name: 'Group B', description: 'Description B' },
    ];

    const { Group } = await import('@/models');
    vi.mocked(Group.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue(mockGroups),
    } as any);

    const req = mockReq({ method: 'GET', query: { userId: 'user-456' } });
    const res = mockRes();

    await groupUserHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ groups: mockGroups });
  });

  it('should return 500 on database error', async () => {
    const { Group } = await import('@/models');
    vi.mocked(Group.find).mockReturnValue({
      sort: vi.fn().mockRejectedValue(new Error('DB Error')),
    } as any);

    const req = mockReq({ method: 'GET', query: { userId: 'user-456' } });
    const res = mockRes();

    await groupUserHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'GetError',
      details: {},
    });
  });
});
