import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../../utils/mocks';

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
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  YearlyVacationDays: {
    findOne: vi.fn(),
    create: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

import { ElectiveVacation, YearlyVacationDays } from '@/models';
import vacationResolveHandler from '@/pages/api/admin/vacations/resolve/[vacationId]';

describe('POST /api/admin/vacations/resolve/[vacationId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not POST', async () => {
    const req = mockReq({ method: 'GET', query: { vacationId: 'vacation-123' } });
    const res = mockRes();

    await vacationResolveHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 400 if status is invalid', async () => {
    const req = mockReq({
      method: 'POST',
      query: { vacationId: 'vacation-123' },
      body: { status: 'invalid' },
    });
    const res = mockRes();

    await vacationResolveHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'status',
        reasons: [],
      },
    });
  });

  it('should return 404 if vacation not found', async () => {
    vi.mocked(ElectiveVacation.findById).mockResolvedValue(null);

    const req = mockReq({
      method: 'POST',
      query: { vacationId: 'nonexistent' },
      body: { status: 'approved' },
    });
    const res = mockRes();

    await vacationResolveHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'EntryNotFound',
      details: { entry: 'Vacation' },
    });
  });

  it('should return 200 on successful approve', async () => {
    vi.mocked(ElectiveVacation.findById).mockResolvedValue({
      _id: 'vacation-123',
      userId: 'user-456',
      date: new Date('2024-06-15'),
      status: 'pending',
    });
    vi.mocked(ElectiveVacation.findByIdAndUpdate).mockResolvedValue({});
    vi.mocked(YearlyVacationDays.findOne).mockResolvedValue(null);

    const req = mockReq({
      method: 'POST',
      query: { vacationId: 'vacation-123' },
      body: { status: 'approved' },
    });
    const res = mockRes();

    await vacationResolveHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('should return 200 on successful reject', async () => {
    vi.mocked(ElectiveVacation.findById).mockResolvedValue({
      _id: 'vacation-123',
      userId: 'user-456',
      date: new Date('2024-06-15'),
      status: 'pending',
    });
    vi.mocked(ElectiveVacation.findByIdAndUpdate).mockResolvedValue({});

    const req = mockReq({
      method: 'POST',
      query: { vacationId: 'vacation-123' },
      body: { status: 'rejected' },
    });
    const res = mockRes();

    await vacationResolveHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('should return 500 on database error', async () => {
    vi.mocked(ElectiveVacation.findById).mockRejectedValue(new Error('DB Error'));

    const req = mockReq({
      method: 'POST',
      query: { vacationId: 'vacation-123' },
      body: { status: 'approved' },
    });
    const res = mockRes();

    await vacationResolveHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'PostError',
      details: {},
    });
  });
});
