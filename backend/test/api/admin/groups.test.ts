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
  Group: {
    find: vi.fn(),
  },
}));

import { Group } from '@/models';
import adminGroupsHandler from '@/pages/api/admin/groups';

describe('GET /api/admin/groups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not GET', async () => {
    const req = mockReq({ method: 'POST' });
    const res = mockRes();

    await adminGroupsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 200 with groups on successful GET', async () => {
    const mockGroups = [
      { _id: 'group-1', name: 'Group 1' },
      { _id: 'group-2', name: 'Group 2' },
    ];

    vi.mocked(Group.find).mockResolvedValue(mockGroups);

    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await adminGroupsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ groups: mockGroups });
  });

  it('should return 500 on database error', async () => {
    vi.mocked(Group.find).mockRejectedValue(new Error('DB Error'));

    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await adminGroupsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'GetError',
      details: {},
    });
  });
});
