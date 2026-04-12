import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
  authenticateToken: (handler: Function) => {
    return async (req: any, res: any) => {
      req.user = { userId: 'user-123', email: 'test@example.com', role: 'employee' };
      return handler(req, res);
    };
  },
  AuthRequest: class {},
}));

vi.mock('@/models', () => ({
  User: {
    findById: vi.fn(),
  },
  Group: {
    find: vi.fn(),
  },
  ElectiveVacation: {
    find: vi.fn(),
  },
}));

import { User, Group, ElectiveVacation } from '@/models';
import teamVacationsHandler from '@/pages/api/groups/team-vacations';

describe('GET /api/groups/team-vacations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not GET', async () => {
    const req = mockReq({ method: 'POST' });
    const res = mockRes();

    await teamVacationsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 400 if year is not provided', async () => {
    const req = mockReq({ method: 'GET', query: {} });
    const res = mockRes();

    await teamVacationsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'YearRequired' });
  });

  it('should return 404 if user not found', async () => {
    vi.mocked(User.findById).mockResolvedValue(null);

    const req = mockReq({ method: 'GET', query: { year: '2024' } });
    const res = mockRes();

    await teamVacationsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'UserNotFound' });
  });

  it('should return 200 with vacations on successful GET', async () => {
    vi.mocked(User.findById).mockResolvedValue({
      _id: 'user-123',
      groups: ['group-1'],
    });

    vi.mocked(Group.find).mockResolvedValue([
      { _id: 'group-1', members: ['user-456', 'user-789'] },
    ]);

    const mockVacations = [
      { _id: 'vacation-1', userId: { name: 'User 1' }, date: new Date('2024-06-15') },
    ];
    vi.mocked(ElectiveVacation.find).mockReturnValue({
      populate: vi.fn().mockResolvedValue(mockVacations),
    } as any);

    const req = mockReq({ method: 'GET', query: { year: '2024' } });
    const res = mockRes();

    await teamVacationsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ vacations: mockVacations });
  });

  it('should return 500 on database error', async () => {
    vi.mocked(User.findById).mockRejectedValue(new Error('DB Error'));

    const req = mockReq({ method: 'GET', query: { year: '2024' } });
    const res = mockRes();

    await teamVacationsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'GetError',
      details: {},
    });
  });
});
