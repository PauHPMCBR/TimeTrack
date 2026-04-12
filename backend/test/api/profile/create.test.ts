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
  User: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

vi.stubEnv('FRONTEND_URL', 'http://localhost:3000');

import { User } from '@/models';
import profileCreateHandler from '@/pages/api/profile/create';

describe('POST /api/profile/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not POST', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await profileCreateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 400 if email already exists', async () => {
    vi.mocked(User.findOne).mockResolvedValue({ _id: 'existing-user' });

    const req = mockReq({
      method: 'POST',
      body: { email: 'existing@example.com', name: 'Test User' },
    });
    const res = mockRes();

    await profileCreateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'email',
        reasons: ['AlreadyExists'],
      },
    });
  });

  it('should return 201 with user and registration token on successful creation', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null);
    
    const mockNewUser = {
      _id: 'new-user-id',
      name: 'New User',
      email: 'new@example.com',
      role: 'employee',
      registered: false,
    };
    
    vi.mocked(User.create).mockResolvedValue(mockNewUser);

    const req = mockReq({
      method: 'POST',
      body: { email: 'new@example.com', name: 'New User', role: 'employee' },
    });
    const res = mockRes();

    await profileCreateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          user: expect.objectContaining({
            id: 'new-user-id',
            name: 'New User',
            email: 'new@example.com',
          }),
          registrationLink: expect.any(String),
          registrationToken: expect.any(String),
        }),
      })
    );
  });

  it('should use default role employee if not provided', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null);
    
    const mockNewUser = {
      _id: 'new-user-id',
      name: 'New User',
      email: 'new@example.com',
      role: 'employee',
      registered: false,
    };
    
    vi.mocked(User.create).mockResolvedValue(mockNewUser);

    const req = mockReq({
      method: 'POST',
      body: { email: 'new@example.com', name: 'New User' },
    });
    const res = mockRes();

    await profileCreateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'employee',
      })
    );
  });

  it('should return 500 on database error', async () => {
    vi.mocked(User.findOne).mockRejectedValue(new Error('DB Error'));

    const req = mockReq({
      method: 'POST',
      body: { email: 'new@example.com', name: 'New User' },
    });
    const res = mockRes();

    await profileCreateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'PostError',
      details: {},
    });
  });
});
