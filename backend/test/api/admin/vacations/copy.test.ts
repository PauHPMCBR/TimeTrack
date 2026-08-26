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
  validateRequestBody: () => (req: any, res: any, next: (err?: unknown) => void) => next(),
}));

vi.mock('@/models', () => ({
  YearlyVacationDays: {
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create: vi.fn(),
  },
}));

import { YearlyVacationDays } from '@/models';
import copyYearlyHandler from '@/pages/api/admin/vacations/copy';

describe('POST /api/admin/vacations/copy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not POST', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await copyYearlyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 404 if source year has no template', async () => {
    vi.mocked(YearlyVacationDays.findOne).mockResolvedValue(null);

    const req = mockReq({
      method: 'POST',
      body: { fromYear: 2024, toYear: 2025 },
    });
    const res = mockRes();

    await copyYearlyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'EntryNotFound',
      details: { entry: 'YearlyVacationDays' },
    });
  });

  it('should default fromYear to toYear - 1', async () => {
    const source = {
      _id: 'source-2024',
      year: 2024,
      obligatoryDays: [new Date(2024, 0, 6)],
      electiveDaysTotalCount: 22,
      selectedElectiveDays: [],
    };
    vi.mocked(YearlyVacationDays.findOne)
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(null);

    const req = mockReq({
      method: 'POST',
      body: { toYear: 2025 },
    });
    const res = mockRes();

    await copyYearlyHandler(req, res);

    expect(YearlyVacationDays.findOne).toHaveBeenCalledWith({
      year: 2024,
      userId: { $exists: false },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should shift obligatory days to the target year and create a new template', async () => {
    vi.mocked(YearlyVacationDays.findOne)
      .mockResolvedValueOnce({
        _id: 'source-2024',
        year: 2024,
        obligatoryDays: [new Date(2024, 0, 6)],
        electiveDaysTotalCount: 22,
        selectedElectiveDays: [],
      })
      .mockResolvedValueOnce(null);

    const req = mockReq({
      method: 'POST',
      body: { fromYear: 2024, toYear: 2025 },
    });
    const res = mockRes();

    await copyYearlyHandler(req, res);

    expect(YearlyVacationDays.create).toHaveBeenCalledWith(
      expect.objectContaining({
        year: 2025,
        electiveDaysTotalCount: 22,
        obligatoryDays: [new Date(2025, 0, 6)],
        selectedElectiveDays: [],
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'YearlyVacationCopied',
        year: 2025,
        sourceYear: 2024,
      })
    );
  });

  it('should update an existing target template', async () => {
    vi.mocked(YearlyVacationDays.findOne)
      .mockResolvedValueOnce({
        _id: 'source-2024',
        year: 2024,
        obligatoryDays: [new Date(2024, 1, 1)],
        electiveDaysTotalCount: 20,
        selectedElectiveDays: [],
      })
      .mockResolvedValueOnce({ _id: 'target-2025', year: 2025 });

    const req = mockReq({
      method: 'POST',
      body: { fromYear: 2024, toYear: 2025 },
    });
    const res = mockRes();

    await copyYearlyHandler(req, res);

    expect(YearlyVacationDays.findByIdAndUpdate).toHaveBeenCalledWith(
      'target-2025',
      expect.objectContaining({
        electiveDaysTotalCount: 20,
        obligatoryDays: [new Date(2025, 1, 1)],
        selectedElectiveDays: [],
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should return 500 on database error', async () => {
    vi.mocked(YearlyVacationDays.findOne).mockRejectedValue(new Error('DB Error'));

    const req = mockReq({
      method: 'POST',
      body: { fromYear: 2024, toYear: 2025 },
    });
    const res = mockRes();

    await copyYearlyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'PostError',
      details: {},
    });
  });
});