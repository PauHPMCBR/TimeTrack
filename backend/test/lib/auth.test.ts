import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes, createAuthHeader } from '../utils/mocks';
import jwt from 'jsonwebtoken';

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

import { requireInGroupOrAdmin, requireSameGroupOrAdmin, authenticateToken, signToken, REFRESH_TOKEN_HEADER } from '@/lib/auth';
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

describe('authenticateToken sliding expiration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  const handler = vi.fn().mockResolvedValue(undefined);

  it('re-issues a token in X-Auth-Token when the token is close to expiring', async () => {
    const nearExpiry = jwt.sign(
      { userId: 'user-1', email: 'a@b.c', role: 'employee' },
      'test-secret-for-testing',
      { expiresIn: '1h' }
    );

    const req: any = mockReq({
      headers: { authorization: `Bearer ${nearExpiry}` },
    });
    const res = mockRes();

    await authenticateToken(handler)(req, res);

    expect(handler).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith(REFRESH_TOKEN_HEADER, expect.any(String));
  });

  it('does not re-issue when the token is still fresh', async () => {
    const fresh = jwt.sign(
      { userId: 'user-1', email: 'a@b.c', role: 'employee' },
      'test-secret-for-testing',
      { expiresIn: '96h' }
    );

    const req: any = mockReq({
      headers: { authorization: `Bearer ${fresh}` },
    });
    const res = mockRes();

    await authenticateToken(handler)(req, res);

    expect(handler).toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('rejects a token past the 30-day absolute cap even if unexpired', async () => {
    const sessionStart = Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60;
    const capped = jwt.sign(
      { userId: 'user-1', email: 'a@b.c', role: 'employee', sessionStart },
      'test-secret-for-testing',
      { expiresIn: '96h' }
    );

    const req: any = mockReq({
      headers: { authorization: `Bearer ${capped}` },
    });
    const res = mockRes();

    await authenticateToken(handler)(req, res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'InvalidToken' })
    );
  });

  it('refresh preserves the original sessionStart and re-issues a 96h token', async () => {
    const sessionStart = Math.floor(Date.now() / 1000) - 10 * 24 * 60 * 60; // 10 days ago
    const nearExpiry = jwt.sign(
      { userId: 'user-1', email: 'a@b.c', role: 'employee', sessionStart },
      'test-secret-for-testing',
      { expiresIn: '1h' }
    );

    const req: any = mockReq({
      headers: { authorization: `Bearer ${nearExpiry}` },
    });
    const res = mockRes();

    await authenticateToken(handler)(req, res);

    expect(handler).toHaveBeenCalled();
    const refreshed = res.setHeader.mock.calls.find((c: any[]) => c[0] === REFRESH_TOKEN_HEADER)?.[1];
    const decoded = jwt.verify(refreshed, 'test-secret-for-testing') as any;
    expect(decoded.sessionStart).toBe(sessionStart);
    expect(decoded.exp - Math.floor(Date.now() / 1000)).toBeCloseTo(96 * 3600, -2); // ~96h
  });

  it('signToken issues a 96h token with the expected payload', () => {
    const token = signToken({ userId: 'u1', email: 'a@b.c', role: 'employee' });
    const decoded = jwt.verify(token, 'test-secret-for-testing') as any;

    expect(decoded.userId).toBe('u1');
    expect(decoded.email).toBe('a@b.c');
    expect(decoded.role).toBe('employee');
    expect(decoded.sessionStart).toBeTruthy();
    expect(decoded.exp - decoded.iat).toBeCloseTo(96 * 3600, -2); // ~96h
  });
});
