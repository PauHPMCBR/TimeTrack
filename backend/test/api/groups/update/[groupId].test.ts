import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../utils/mocks';

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
  validateQueryParams: () => (req: any, res: any, next: Function) => next(),
  validateRequestBody: () => (req: any, res: any, next: Function) => next(),
}));

vi.mock('@/models', () => ({
  Group: {
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
  User: {
    updateMany: vi.fn().mockResolvedValue({}),
  },
}));

import { Group, User } from '@/models';
import groupUpdateHandler from '@/pages/api/groups/update/[groupId]';

describe('PUT/DELETE /api/groups/update/[groupId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not PUT or DELETE', async () => {
    const req = mockReq({ method: 'GET', query: { groupId: 'group-123' } });
    const res = mockRes();

    await groupUpdateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  describe('PUT', () => {
    it('should return 200 with updated group on successful PUT', async () => {
      const mockGroup = {
        _id: 'group-123',
        name: 'Updated Group',
        description: 'Updated Description',
        members: [],
      };

      vi.mocked(Group.findByIdAndUpdate).mockResolvedValue(mockGroup);

      const req = mockReq({
        method: 'PUT',
        query: { groupId: 'group-123' },
        body: { name: 'Updated Group', description: 'Updated Description' },
      });
      const res = mockRes();

      await groupUpdateHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ group: mockGroup });
    });

    it('should return 404 if group not found on PUT', async () => {
      vi.mocked(Group.findByIdAndUpdate).mockResolvedValue(null);

      const req = mockReq({
        method: 'PUT',
        query: { groupId: 'nonexistent' },
        body: { name: 'Updated Group', description: 'Updated Description' },
      });
      const res = mockRes();

      await groupUpdateHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'EntryNotFound',
        details: { entry: 'Group' },
      });
    });

    it('should return 500 on database error during PUT', async () => {
      vi.mocked(Group.findByIdAndUpdate).mockRejectedValue(new Error('DB Error'));

      const req = mockReq({
        method: 'PUT',
        query: { groupId: 'group-123' },
        body: { name: 'Updated Group', description: 'Updated Description' },
      });
      const res = mockRes();

      await groupUpdateHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'PutError',
        details: {},
      });
    });
  });

  describe('DELETE', () => {
    it('should return 200 with message on successful DELETE', async () => {
      const mockGroup = {
        _id: 'group-123',
        name: 'Test Group',
      };

      vi.mocked(Group.findByIdAndDelete).mockResolvedValue(mockGroup);

      const req = mockReq({ method: 'DELETE', query: { groupId: 'group-123' } });
      const res = mockRes();

      await groupUpdateHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'GroupDeleted' });
      expect(User.updateMany).toHaveBeenCalledWith(
        { groups: 'group-123' },
        { $pull: { groups: 'group-123' } }
      );
    });

    it('should return 404 if group not found on DELETE', async () => {
      vi.mocked(Group.findByIdAndDelete).mockResolvedValue(null);

      const req = mockReq({ method: 'DELETE', query: { groupId: 'nonexistent' } });
      const res = mockRes();

      await groupUpdateHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'EntryNotFound',
        details: { entry: 'Group' },
      });
    });

    it('should return 500 on database error during DELETE', async () => {
      vi.mocked(Group.findByIdAndDelete).mockRejectedValue(new Error('DB Error'));

      const req = mockReq({ method: 'DELETE', query: { groupId: 'group-123' } });
      const res = mockRes();

      await groupUpdateHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'DeleteError',
        details: {},
      });
    });
  });
});
