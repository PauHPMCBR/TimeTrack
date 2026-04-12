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

vi.mock('@/models', () => ({
  ElectiveVacation: {
    find: vi.fn(),
  },
}));

import { ElectiveVacation } from '@/models';
import pendingVacationsHandler from '@/pages/api/admin/vacations/pending-vacations';

describe('GET /api/admin/vacations/pending-vacations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not GET', async () => {
    const req = mockReq({ method: 'POST' });
    const res = mockRes();

    await pendingVacationsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 200 with pending vacations on successful GET', async () => {
    const mockVacations = [
      { _id: 'vacation-1', userId: 'user-1', date: new Date('2024-06-15'), status: 'pending' },
      { _id: 'vacation-2', userId: 'user-2', date: new Date('2024-06-20'), status: 'pending' },
    ];

    vi.mocked(ElectiveVacation.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue(mockVacations),
    } as any);

    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await pendingVacationsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ vacations: mockVacations });
  });

  it('should return 500 on database error', async () => {
    vi.mocked(ElectiveVacation.find).mockReturnValue({
      sort: vi.fn().mockRejectedValue(new Error('DB Error')),
    } as any);

    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await pendingVacationsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'GetError',
      details: {},
    });
  });
});
