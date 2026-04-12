import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
  requireSameGroupOrAdmin: (handler: Function) => {
    return async (req: any, res: any) => {
      req.user = { userId: 'user-123', email: 'test@example.com', role: 'employee' };
      return handler(req, res);
    };
  },
  AuthRequest: class {},
}));

vi.mock('@/lib/validation', () => ({
  validateQueryParams: () => (req: any, res: any, next: Function) => next(),
}));

vi.mock('@/models', () => ({
  ElectiveVacation: {
    find: vi.fn(),
  },
  YearlyVacationDays: {
    findOne: vi.fn(),
    create: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

import { ElectiveVacation, YearlyVacationDays } from '@/models';
import userVacationsHandler from '@/pages/api/vacations/user/[userId]/[year]';

describe('GET /api/vacations/user/[userId]/[year]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not GET', async () => {
    const req = mockReq({ method: 'POST', query: { userId: 'user-456', year: '2024' } });
    const res = mockRes();

    await userVacationsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 200 with vacations and yearly config on successful GET', async () => {
    const mockVacations = [
      { _id: 'vacation-1', userId: 'user-456', date: new Date('2024-06-15'), status: 'pending' },
    ];

    const mockYearlyVacation = {
      year: 2024,
      userId: 'user-456',
      obligatoryDays: ['2024-01-01'],
      electiveDaysTotalCount: 22,
      selectedElectiveDays: [],
    };

    vi.mocked(ElectiveVacation.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue(mockVacations),
    } as any);

    vi.mocked(YearlyVacationDays.findOne)
      .mockResolvedValueOnce({ year: 2024, electiveDaysTotalCount: 22, obligatoryDays: [] })  // globalSettings
      .mockResolvedValueOnce(mockYearlyVacation);  // user yearly

    const req = mockReq({ method: 'GET', query: { userId: 'user-456', year: '2024' } });
    const res = mockRes();

    await userVacationsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      year: 2024,
      electives: mockVacations,
      yearlyVacationDays: mockYearlyVacation,
    });
  });

  it('should create new user yearly config from global settings if not exists', async () => {
    const mockVacations: any[] = [];

    vi.mocked(ElectiveVacation.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue(mockVacations),
    } as any);

    vi.mocked(YearlyVacationDays.findOne)
      .mockResolvedValueOnce({ year: 2024, electiveDaysTotalCount: 22, obligatoryDays: ['2024-01-01'] })  // globalSettings
      .mockResolvedValueOnce(null);  // user yearly not found

    vi.mocked(YearlyVacationDays.create).mockResolvedValue({
      year: 2024,
      userId: 'user-456',
      obligatoryDays: ['2024-01-01'],
      electiveDaysTotalCount: 22,
      selectedElectiveDays: [],
    });

    const req = mockReq({ method: 'GET', query: { userId: 'user-456', year: '2024' } });
    const res = mockRes();

    await userVacationsHandler(req, res);

    expect(YearlyVacationDays.create).toHaveBeenCalledWith({
      userId: 'user-456',
      year: 2024,
      obligatoryDays: ['2024-01-01'],
      electiveDaysTotalCount: 22,
      selectedElectiveDays: [],
    });

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should return 500 on database error', async () => {
    vi.mocked(ElectiveVacation.find).mockReturnValue({
      sort: vi.fn().mockRejectedValue(new Error('DB Error')),
    } as any);

    const req = mockReq({ method: 'GET', query: { userId: 'user-456', year: '2024' } });
    const res = mockRes();

    await userVacationsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'GetError',
      details: {},
    });
  });
});
