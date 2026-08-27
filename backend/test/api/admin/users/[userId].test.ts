import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
  requireRole: (roles: string[], handler: (req: unknown, res: unknown) => unknown) => {
    return async (req: any, res: any) => {
      req.user = { userId: 'admin-123', email: 'admin@example.com', role: 'admin' };
      return handler(req, res);
    };
  },
  AuthRequest: class {},
}));

vi.mock('@/lib/validation', () => ({
  validateQueryParams: () => (req: any, res: any, next: (err?: unknown) => void) => next(),
  validateRequestBody: () => (req: any, res: any, next: (err?: unknown) => void) => next(),
}));

vi.mock('@/lib/sanitize', () => ({
  toPublicUser: (user: unknown) => user,
}));

vi.mock('@/models', () => ({
  User: {
    findById: vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

import { User } from '@/models';
import updateUserHandler from '@/pages/api/admin/users/[userId]';

describe('PUT /api/admin/users/[userId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not PUT or GET', async () => {
    const req = mockReq({ method: 'DELETE', query: { userId: 'user-1' } });
    const res = mockRes();

    await updateUserHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return the registration link for a non-activated user (GET)', async () => {
    vi.mocked(User.findById).mockResolvedValue({
      _id: 'user-1',
      name: 'Anna',
      email: 'anna@example.com',
      registered: false,
      registrationToken: 'tok123',
    });

    const req = mockReq({ method: 'GET', query: { userId: 'user-1' } });
    const res = mockRes();

    await updateUserHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.registrationLink).toContain('/register/tok123');
    expect(payload.data.registrationLink).toContain('anna%40example.com');
  });

  it('should return null registration link for an activated user (GET)', async () => {
    vi.mocked(User.findById).mockResolvedValue({
      _id: 'user-1',
      name: 'Anna',
      email: 'anna@example.com',
      registered: true,
      registrationToken: 'tok123',
    });

    const req = mockReq({ method: 'GET', query: { userId: 'user-1' } });
    const res = mockRes();

    await updateUserHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data.registrationLink).toBeNull();
  });

  it('should return 404 if user does not exist', async () => {
    vi.mocked(User.findById).mockResolvedValue(null);

    const req = mockReq({
      method: 'PUT',
      query: { userId: 'missing-user' },
      body: { name: 'New Name' },
    });
    const res = mockRes();

    await updateUserHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'EntryNotFound',
      details: { entry: 'User' },
    });
  });

  it('should return 400 if email is taken by another user', async () => {
    vi.mocked(User.findById).mockResolvedValue({
      _id: 'user-1',
      email: 'old@example.com',
    });
    vi.mocked(User.findOne).mockResolvedValue({ _id: 'other-user' });

    const req = mockReq({
      method: 'PUT',
      query: { userId: 'user-1' },
      body: { email: 'taken@example.com' },
    });
    const res = mockRes();

    await updateUserHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'email',
        reasons: ['AlreadyExists'],
      },
    });
  });

  it('should update user and return sanitized user on success', async () => {
    const existingUser = { _id: 'user-1', email: 'old@example.com' };
    vi.mocked(User.findById)
      .mockResolvedValueOnce(existingUser)
      .mockResolvedValueOnce({
        _id: 'user-1',
        name: 'Updated Name',
        email: 'new@example.com',
        role: 'employee',
        dni: '12345678A',
        expectedWorkHours: 7.5,
      });
    vi.mocked(User.findOne).mockResolvedValue(null);

    const req = mockReq({
      method: 'PUT',
      query: { userId: 'user-1' },
      body: {
        name: 'Updated Name',
        email: 'new@example.com',
        dni: '12345678A',
        expectedWorkHours: 7.5,
      },
    });
    const res = mockRes();

    await updateUserHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        name: 'Updated Name',
        email: 'new@example.com',
        dni: '12345678A',
        expectedWorkHours: 7.5,
      }),
      { new: true }
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          user: expect.objectContaining({
            name: 'Updated Name',
            expectedWorkHours: 7.5,
          }),
        }),
      })
    );
  });

  it('should return 500 on database error', async () => {
    vi.mocked(User.findById).mockRejectedValue(new Error('DB Error'));

    const req = mockReq({
      method: 'PUT',
      query: { userId: 'user-1' },
      body: { name: 'New Name' },
    });
    const res = mockRes();

    await updateUserHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'PutError',
      details: {},
    });
  });
});