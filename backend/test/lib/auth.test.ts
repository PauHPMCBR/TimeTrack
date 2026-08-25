import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes, createAuthHeader } from '../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/models', () => ({
  User: {
    findById: vi.fn(),
  },
  Group: {
    findById: vi.fn(),
  },
}));

vi.stubEnv('JWT_SECRET', 'test-secret-for-testing');

import { requireInGroupOrAdmin, requireSameGroupOrAdmin } from '@/lib/auth';
import { User, Group } from '@/models';

const objectId = (id: string) => ({ toString: () => id });

describe('requireInGroupOrAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  const handler = vi.fn().mockResolvedValue(undefined);

  it('allows admins without membership check', async () => {
    const req: any = mockReq({
      headers: { authorization: createAuthHeader({ userId: 'admin-1', role: 'admin' }) },
      query: { groupId: 'group-1' },
    });
    (req as any).user = undefined;
    const res = mockRes();

    await requireInGroupOrAdmin(handler)(req, res);

    expect(handler).toHaveBeenCalled();
    expect(Group.findById).not.toHaveBeenCalled();
  });

  it('allows members whose ObjectId id matches the token userId string', async () => {
    vi.mocked(User.findById).mockResolvedValue({ _id: objectId('user-1') } as any);
    vi.mocked(Group.findById).mockResolvedValue({
      _id: objectId('group-1'),
      members: [objectId('user-1'), objectId('user-2')],
    } as any);

    const req: any = mockReq({
      headers: { authorization: createAuthHeader({ userId: 'user-1', role: 'employee' }) },
      query: { groupId: 'group-1' },
    });
    const res = mockRes();

    await requireInGroupOrAdmin(handler)(req, res);

    expect(handler).toHaveBeenCalled();
  });

  it('rejects non-members with 403 NoAccessToGroup', async () => {
    vi.mocked(User.findById).mockResolvedValue({ _id: objectId('user-3') } as any);
    vi.mocked(Group.findById).mockResolvedValue({
      _id: objectId('group-1'),
      members: [objectId('user-1')],
    } as any);

    const req: any = mockReq({
      headers: { authorization: createAuthHeader({ userId: 'user-3', role: 'employee' }) },
      query: { groupId: 'group-1' },
    });
    const res = mockRes();

    const wrapped = requireInGroupOrAdmin(handler);
    await wrapped(req, res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'NoAccessToGroup' })
    );
  });

  it('returns 404 when the group does not exist', async () => {
    vi.mocked(User.findById).mockResolvedValue({ _id: objectId('user-1') } as any);
    vi.mocked(Group.findById).mockResolvedValue(null as any);

    const req: any = mockReq({
      headers: { authorization: createAuthHeader({ userId: 'user-1', role: 'employee' }) },
      query: { groupId: 'missing-group' },
    });
    const res = mockRes();

    await requireInGroupOrAdmin(handler)(req, res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('requireSameGroupOrAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  const handler = vi.fn().mockResolvedValue(undefined);

  it('allows users sharing at least one group', async () => {
    vi.mocked(User.findById)
      .mockResolvedValueOnce({ groups: [objectId('g1')] } as any) // current user
      .mockResolvedValueOnce({ groups: [objectId('g2'), objectId('g1')] } as any); // target

    const req: any = mockReq({
      headers: { authorization: createAuthHeader({ userId: 'user-1', role: 'employee' }) },
      query: { userId: 'user-2' },
    });
    const res = mockRes();

    await requireSameGroupOrAdmin(handler)(req, res);

    expect(handler).toHaveBeenCalled();
  });

  it('rejects users with no shared groups', async () => {
    vi.mocked(User.findById)
      .mockResolvedValueOnce({ groups: [objectId('g1')] } as any)
      .mockResolvedValueOnce({ groups: [objectId('g9')] } as any);

    const req: any = mockReq({
      headers: { authorization: createAuthHeader({ userId: 'user-1', role: 'employee' }) },
      query: { userId: 'user-2' },
    });
    const res = mockRes();

    await requireSameGroupOrAdmin(handler)(req, res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
