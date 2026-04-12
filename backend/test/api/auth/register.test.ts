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
  },
}));

vi.stubEnv('JWT_SECRET', 'test-secret-for-testing');

import registerHandler from '@/pages/api/auth/register';

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not POST', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await registerHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 400 if registration token is invalid', async () => {
    const { User } = await import('@/models');
    vi.mocked(User.findOne).mockResolvedValue(null);

    const req = mockReq({
      method: 'POST',
      body: { 
        registrationToken: 'invalid-token', 
        email: 'test@example.com',
        name: 'Test User',
        password: 'SecurePass123!'
      },
    });
    const res = mockRes();

    await registerHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'InvalidRegisterToken',
      details: {},
    });
  });

  it('should return 400 if email does not match token', async () => {
    const user = {
      _id: { toString: () => 'user-id-123' },
      email: 'test@example.com',
      registrationToken: 'valid-token',
      registered: false,
      name: 'Test User',
      save: vi.fn().mockResolvedValue({}),
    };

    const { User } = await import('@/models');
    vi.mocked(User.findOne).mockResolvedValue(user);

    const req = mockReq({
      method: 'POST',
      body: { 
        registrationToken: 'valid-token', 
        email: 'wrong@example.com',
        name: 'Test User',
        password: 'SecurePass123!'
      },
    });
    const res = mockRes();

    await registerHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'email',
        reasons: [],
      },
    });
  });

  it('should return 400 if password is too short', async () => {
    const user = {
      _id: { toString: () => 'user-id-123' },
      email: 'test@example.com',
      registrationToken: 'valid-token',
      registered: false,
      name: 'Test User',
      save: vi.fn().mockResolvedValue({}),
    };

    const { User } = await import('@/models');
    vi.mocked(User.findOne).mockResolvedValue(user);

    const req = mockReq({
      method: 'POST',
      body: { 
        registrationToken: 'valid-token', 
        email: 'test@example.com',
        name: 'Test User',
        password: 'Short1!'
      },
    });
    const res = mockRes();

    await registerHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'password',
        reasons: ['LessThan12Characters'],
      },
    });
  });

  it('should return 400 if password is missing lowercase', async () => {
    const user = {
      _id: { toString: () => 'user-id-123' },
      email: 'test@example.com',
      registrationToken: 'valid-token',
      registered: false,
      name: 'Test User',
      save: vi.fn().mockResolvedValue({}),
    };

    const { User } = await import('@/models');
    vi.mocked(User.findOne).mockResolvedValue(user);

    const req = mockReq({
      method: 'POST',
      body: { 
        registrationToken: 'valid-token', 
        email: 'test@example.com',
        name: 'Test User',
        password: 'SECUREPASS123!'
      },
    });
    const res = mockRes();

    await registerHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'password',
        reasons: ['MissingLowercase'],
      },
    });
  });

  it('should return 400 if password is missing uppercase', async () => {
    const user = {
      _id: { toString: () => 'user-id-123' },
      email: 'test@example.com',
      registrationToken: 'valid-token',
      registered: false,
      name: 'Test User',
      save: vi.fn().mockResolvedValue({}),
    };

    const { User } = await import('@/models');
    vi.mocked(User.findOne).mockResolvedValue(user);

    const req = mockReq({
      method: 'POST',
      body: { 
        registrationToken: 'valid-token', 
        email: 'test@example.com',
        name: 'Test User',
        password: 'securepass123!'
      },
    });
    const res = mockRes();

    await registerHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'password',
        reasons: ['MissingUppercase'],
      },
    });
  });

  it('should return 400 if password is missing number', async () => {
    const user = {
      _id: { toString: () => 'user-id-123' },
      email: 'test@example.com',
      registrationToken: 'valid-token',
      registered: false,
      name: 'Test User',
      save: vi.fn().mockResolvedValue({}),
    };

    const { User } = await import('@/models');
    vi.mocked(User.findOne).mockResolvedValue(user);

    const req = mockReq({
      method: 'POST',
      body: { 
        registrationToken: 'valid-token', 
        email: 'test@example.com',
        name: 'Test User',
        password: 'SecurePassword!'
      },
    });
    const res = mockRes();

    await registerHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'password',
        reasons: ['MissingNumber'],
      },
    });
  });

  it('should return 400 if password is missing special character', async () => {
    const user = {
      _id: { toString: () => 'user-id-123' },
      email: 'test@example.com',
      registrationToken: 'valid-token',
      registered: false,
      name: 'Test User',
      save: vi.fn().mockResolvedValue({}),
    };

    const { User } = await import('@/models');
    vi.mocked(User.findOne).mockResolvedValue(user);

    const req = mockReq({
      method: 'POST',
      body: { 
        registrationToken: 'valid-token', 
        email: 'test@example.com',
        name: 'Test User',
        password: 'SecurePass123'
      },
    });
    const res = mockRes();

    await registerHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'password',
        reasons: ['MissingSign'],
      },
    });
  });

  it('should return 400 if password contains email', async () => {
    const user = {
      _id: { toString: () => 'user-id-123' },
      email: 'other@example.com',
      registrationToken: 'valid-token',
      registered: false,
      name: 'Test User',
      save: vi.fn().mockResolvedValue({}),
    };

    const { User } = await import('@/models');
    vi.mocked(User.findOne).mockResolvedValue(user);

    const req = mockReq({
      method: 'POST',
      body: { 
        registrationToken: 'valid-token', 
        email: 'other@example.com',
        name: 'Test User',
        password: 'SecurePass123!other@example.com'  // Contains full email
      },
    });
    const res = mockRes();

    await registerHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'password',
        reasons: ['ContainsEmail'],
      },
    });
  });

  it('should return 400 if password contains username', async () => {
    const user = {
      _id: { toString: () => 'user-id-123' },
      email: 'test@example.com',
      registrationToken: 'valid-token',
      registered: false,
      name: 'Alice',
      save: vi.fn().mockResolvedValue({}),
    };

    const { User } = await import('@/models');
    vi.mocked(User.findOne).mockResolvedValue(user);

    const req = mockReq({
      method: 'POST',
      body: { 
        registrationToken: 'valid-token', 
        email: 'test@example.com',
        name: 'Alice',
        password: 'SecurePass123!Alice'
      },
    });
    const res = mockRes();

    await registerHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'password',
        reasons: ['ContainsUsername'],
      },
    });
  });

  it('should return 200 with token on successful registration', async () => {
    const user = {
      _id: { toString: () => 'user-id-123' },
      email: 'test@example.com',
      registrationToken: 'valid-token',
      registered: false,
      name: 'Test User',
      role: 'employee',
      save: vi.fn().mockResolvedValue({}),
    };

    const { User } = await import('@/models');
    vi.mocked(User.findOne).mockResolvedValue(user);

    const req = mockReq({
      method: 'POST',
      body: { 
        registrationToken: 'valid-token', 
        email: 'test@example.com',
        name: 'Test User',
        password: 'SecurePass123!'
      },
    });
    const res = mockRes();

    await registerHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.any(String),
        user: expect.any(Object),
      })
    );
  });
});
