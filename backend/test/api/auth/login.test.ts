import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/validation', () => ({
  validateRequestBody: () => (req: any, res: any, next: Function) => next(),
}));

vi.mock('@/models', () => ({
  User: {
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.stubEnv('JWT_SECRET', 'test-secret-for-testing');
vi.stubEnv('BLOCK_MINUTES', '10');
vi.stubEnv('MAX_FAILED_LOGIN_ATTEMPTS', '5');

import loginHandler from '@/pages/api/auth/login';

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not POST', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await loginHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 401 if user not found', async () => {
    const { User } = await import('@/models');
    vi.mocked(User.findOne).mockResolvedValue(null);

    const req = mockReq({
      method: 'POST',
      body: { email: 'nonexistent@example.com', password: 'password123' },
    });
    const res = mockRes();

    await loginHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'InvalidCredentials',
      details: {},
    });
  });

  it('should return 500 if account is blocked', async () => {
    const blockedUser = {
      _id: { toString: () => 'user-id-123' },
      email: 'test@example.com',
      password: 'hashedpassword',
      role: 'employee',
      blocked: true,
      blockedSince: new Date(),
      failedLoginAttempts: 5,
      comparePassword: vi.fn().mockResolvedValue(true),
    };

    const { User } = await import('@/models');
    vi.mocked(User.findOne).mockResolvedValue(blockedUser);

    const req = mockReq({
      method: 'POST',
      body: { email: 'test@example.com', password: 'password123' },
    });
    const res = mockRes();

    await loginHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'AccountBlocked',
      })
    );
  });

  it('should return 401 if password is invalid', async () => {
    const user = {
      _id: { toString: () => 'user-id-123' },
      email: 'test@example.com',
      password: 'hashedpassword',
      role: 'employee',
      blocked: false,
      failedLoginAttempts: 0,
      comparePassword: vi.fn().mockResolvedValue(false),
    };

    const { User } = await import('@/models');
    vi.mocked(User.findOne).mockResolvedValue(user);
    vi.mocked(User.findByIdAndUpdate).mockResolvedValue({});

    const req = mockReq({
      method: 'POST',
      body: { email: 'test@example.com', password: 'wrongpassword' },
    });
    const res = mockRes();

    await loginHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'InvalidCredentials',
      details: {},
    });
  });

  it('should return 401 and block account after max failed attempts', async () => {
    const userWithAttempts = {
      _id: { toString: () => 'user-id-123' },
      email: 'test@example.com',
      password: 'hashedpassword',
      role: 'employee',
      blocked: false,
      failedLoginAttempts: 4,
      comparePassword: vi.fn().mockResolvedValue(false),
    };

    const { User } = await import('@/models');
    vi.mocked(User.findOne).mockResolvedValue(userWithAttempts);
    vi.mocked(User.findByIdAndUpdate).mockResolvedValue({});

    const req = mockReq({
      method: 'POST',
      body: { email: 'test@example.com', password: 'wrongpassword' },
    });
    const res = mockRes();

    await loginHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        blocked: true,
        failedLoginAttempts: 5,
      })
    );
  });

  it('should return 200 with token on successful login', async () => {
    const user = {
      _id: { toString: () => 'user-id-123' },
      email: 'test@example.com',
      password: 'hashedpassword',
      role: 'employee',
      blocked: false,
      failedLoginAttempts: 0,
      comparePassword: vi.fn().mockResolvedValue(true),
      toObject: function() { return this; },
    };

    const { User } = await import('@/models');
    vi.mocked(User.findOne).mockResolvedValue(user);
    vi.mocked(User.findByIdAndUpdate).mockResolvedValue({});

    const req = mockReq({
      method: 'POST',
      body: { email: 'test@example.com', password: 'correctpassword' },
    });
    const res = mockRes();

    await loginHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          token: expect.any(String),
        }),
      })
    );
  });
});
