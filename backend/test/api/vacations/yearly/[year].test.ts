import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../utils/mocks';

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
  YearlyVacationDays: {
    findOne: vi.fn(),
  },
}));

import { YearlyVacationDays } from '@/models';
import vacationYearlyHandler from '@/pages/api/vacations/yearly/[year]';

describe('GET /api/vacations/yearly/[year]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not GET', async () => {
    const req = mockReq({ method: 'POST', query: { year: '2024' } });
    const res = mockRes();

    await vacationYearlyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 200 with yearly vacations on successful GET', async () => {
    const mockYearlyVacation = {
      year: 2024,
      obligatoryDays: ['2024-01-01', '2024-12-25'],
      electiveDaysTotalCount: 22,
      selectedElectiveDays: [],
    };

    vi.mocked(YearlyVacationDays.findOne).mockResolvedValue(mockYearlyVacation);

    const req = mockReq({ method: 'GET', query: { year: '2024' } });
    const res = mockRes();

    await vacationYearlyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ vacations: mockYearlyVacation });
  });

  it('should return 404 if yearly vacation config not found', async () => {
    vi.mocked(YearlyVacationDays.findOne).mockResolvedValue(null);

    const req = mockReq({ method: 'GET', query: { year: '2099' } });
    const res = mockRes();

    await vacationYearlyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'EntryNotFound',
      details: { entry: 'YearlyVacationDays' },
    });
  });

  it('should return 500 on database error', async () => {
    vi.mocked(YearlyVacationDays.findOne).mockRejectedValue(new Error('DB Error'));

    const req = mockReq({ method: 'GET', query: { year: '2024' } });
    const res = mockRes();

    await vacationYearlyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'GetError',
      details: {},
    });
  });
});
