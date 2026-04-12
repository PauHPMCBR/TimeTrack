import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
  requireInGroupOrAdmin: (handler: Function) => {
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
    findById: vi.fn(),
  },
}));

import { Group } from '@/models';
import groupHandler from '@/pages/api/groups/[groupId]';

describe('GET /api/groups/[groupId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not GET', async () => {
    const req = mockReq({ method: 'POST' });
    const res = mockRes();

    await groupHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 200 with group on successful GET', async () => {
    const mockGroup = {
      _id: 'group-123',
      name: 'Test Group',
      description: 'Test Description',
      members: [{ name: 'User 1', email: 'user1@example.com' }],
    };

    const mockQuery = {
      populate: vi.fn().mockResolvedValue(mockGroup),
    };

    vi.mocked(Group.findById)
      .mockReturnValueOnce(mockGroup as any)
      .mockReturnValue(mockQuery as any);

    const req = mockReq({ method: 'GET', query: { groupId: 'group-123' } });
    const res = mockRes();

    await groupHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ group: mockGroup });
  });

  it('should return 404 if group not found', async () => {
    vi.mocked(Group.findById).mockResolvedValue(null);

    const req = mockReq({ method: 'GET', query: { groupId: 'nonexistent' } });
    const res = mockRes();

    await groupHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'EntryNotFound',
      details: { entry: 'Group' },
    });
  });

  it('should return 500 on database error', async () => {
    vi.mocked(Group.findById).mockRejectedValue(new Error('DB Error'));

    const req = mockReq({ method: 'GET', query: { groupId: 'group-123' } });
    const res = mockRes();

    await groupHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'GetError',
      details: {},
    });
  });
});
