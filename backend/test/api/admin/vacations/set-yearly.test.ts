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

vi.mock('@/lib/validation', () => ({
  validateRequestBody: () => (req: any, res: any, next: Function) => next(),
}));

vi.mock('@/models', () => ({
  YearlyVacationDays: {
    findOne: vi.fn(),
    create: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

import { YearlyVacationDays } from '@/models';
import setYearlyHandler from '@/pages/api/admin/vacations/set-yearly';

describe('POST /api/admin/vacations/set-yearly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not POST', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await setYearlyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 400 if userId is provided', async () => {
    const req = mockReq({
      method: 'POST',
      body: {
        year: 2024,
        obligatoryDays: ['2024-01-01'],
        electiveDaysTotalCount: 22,
        userId: 'some-user-id',  // Should not be set
      },
    });
    const res = mockRes();

    await setYearlyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'userId',
        reasons: ['ShouldNotBeSet'],
      },
    });
  });

  it('should return 400 if obligatory days are not in the year', async () => {
    const req = mockReq({
      method: 'POST',
      body: {
        year: 2024,
        obligatoryDays: ['2025-01-01'],  // Not in 2024
        electiveDaysTotalCount: 22,
      },
    });
    const res = mockRes();

    await setYearlyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'obligatoryDays',
        reasons: ['DatesNotInYear'],
      },
    });
  });

  it('should return 200 on successful update of existing config', async () => {
    vi.mocked(YearlyVacationDays.findOne).mockResolvedValue({
      _id: 'existing-vacation',
      year: 2024,
      obligatoryDays: [],
      electiveDaysTotalCount: 20,
    });

    vi.mocked(YearlyVacationDays.findByIdAndUpdate).mockResolvedValue({});

    const req = mockReq({
      method: 'POST',
      body: {
        year: 2024,
        obligatoryDays: ['2024-01-01'],
        electiveDaysTotalCount: 22,
      },
    });
    const res = mockRes();

    await setYearlyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'YearlyVacationSaved',
      year: 2024,
    });
  });

  it('should return 200 on successful create of new config', async () => {
    vi.mocked(YearlyVacationDays.findOne).mockResolvedValue(null);
    vi.mocked(YearlyVacationDays.create).mockResolvedValue({});

    const req = mockReq({
      method: 'POST',
      body: {
        year: 2025,
        obligatoryDays: ['2025-01-01'],
        electiveDaysTotalCount: 22,
      },
    });
    const res = mockRes();

    await setYearlyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'YearlyVacationSaved',
      year: 2025,
    });
  });

  it('should return 500 on database error', async () => {
    vi.mocked(YearlyVacationDays.findOne).mockRejectedValue(new Error('DB Error'));

    const req = mockReq({
      method: 'POST',
      body: {
        year: 2024,
        obligatoryDays: ['2024-01-01'],
        electiveDaysTotalCount: 22,
      },
    });
    const res = mockRes();

    await setYearlyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'PostError',
      details: {},
    });
  });
});
