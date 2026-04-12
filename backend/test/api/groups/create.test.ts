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

vi.mock('@/lib/validation', () => ({
  validateRequestBody: () => (req: any, res: any, next: Function) => next(),
}));

vi.mock('@/models', () => ({
  Group: {
    create: vi.fn(),
  },
  User: {
    updateMany: vi.fn().mockResolvedValue({}),
  },
}));

import { Group, User } from '@/models';
import groupCreateHandler from '@/pages/api/groups/create';

describe('POST /api/groups/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not POST', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await groupCreateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 201 with group on successful creation', async () => {
    const mockGroup = {
      _id: 'group-123',
      name: 'Test Group',
      description: 'Test Description',
      members: [],
    };

    vi.mocked(Group.create).mockResolvedValue(mockGroup);

    const req = mockReq({
      method: 'POST',
      body: { name: 'Test Group', description: 'Test Description' },
    });
    const res = mockRes();

    await groupCreateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      group: mockGroup,
    });
  });

  it('should add members to group and update users', async () => {
    const mockGroup = {
      _id: 'group-123',
      name: 'Test Group',
      description: 'Test Description',
      members: ['user-1', 'user-2'],
    };

    vi.mocked(Group.create).mockResolvedValue(mockGroup);

    const req = mockReq({
      method: 'POST',
      body: { 
        name: 'Test Group', 
        description: 'Test Description',
        members: ['user-1', 'user-2']
      },
    });
    const res = mockRes();

    await groupCreateHandler(req, res);

    expect(User.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['user-1', 'user-2'] } },
      { $addToSet: { groups: 'group-123' } }
    );
  });

  it('should return 500 on database error', async () => {
    vi.mocked(Group.create).mockRejectedValue(new Error('DB Error'));

    const req = mockReq({
      method: 'POST',
      body: { name: 'Test Group', description: 'Test Description' },
    });
    const res = mockRes();

    await groupCreateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'PostError',
      details: {},
    });
  });
});
