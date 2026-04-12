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

vi.mock('@/lib/validation', () => ({
  validateRequestBody: () => (req: any, res: any, next: Function) => next(),
}));

vi.mock('@/models', () => ({
  ElectiveVacation: {
    find: vi.fn(),
    create: vi.fn(),
  },
  YearlyVacationDays: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

import { ElectiveVacation, YearlyVacationDays } from '@/models';
import vacationCreateHandler from '@/pages/api/vacations/create';

describe('POST /api/vacations/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not POST', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await vacationCreateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 400 if all vacations are used', async () => {
    vi.mocked(YearlyVacationDays.findOne).mockResolvedValue({
      year: 2024,
      userId: 'user-123',
      obligatoryDays: [],
      electiveDaysTotalCount: 0,
      selectedElectiveDays: [],
    });

    const req = mockReq({
      method: 'POST',
      body: { date: '2024-06-15', reason: 'Doctor appointment' },
    });
    const res = mockRes();

    await vacationCreateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IllegalAction',
      details: {
        illegalAction: 'AllVacationsUsed',
      },
    });
  });

  it('should return 400 if duplicate vacation request exists', async () => {
    vi.mocked(YearlyVacationDays.findOne).mockResolvedValue({
      year: 2024,
      userId: 'user-123',
      obligatoryDays: [],
      electiveDaysTotalCount: 10,
      selectedElectiveDays: [],
    });

    vi.mocked(ElectiveVacation.find).mockResolvedValue([{ _id: 'existing-vacation' }]);

    const req = mockReq({
      method: 'POST',
      body: { date: '2024-06-15', reason: 'Doctor appointment' },
    });
    const res = mockRes();

    await vacationCreateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IllegalAction',
      details: {
        illegalAction: 'DuplicateVacationRequest',
      },
    });
  });

  it('should return 400 if date is obligatory vacation', async () => {
    vi.mocked(YearlyVacationDays.findOne).mockResolvedValue({
      year: 2024,
      userId: 'user-123',
      obligatoryDays: ['2024-06-15'],
      electiveDaysTotalCount: 10,
      selectedElectiveDays: [],
    });

    vi.mocked(ElectiveVacation.find).mockResolvedValue([]);

    const req = mockReq({
      method: 'POST',
      body: { date: '2024-06-15', reason: 'Doctor appointment' },
    });
    const res = mockRes();

    await vacationCreateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IllegalAction',
      details: {
        illegalAction: 'AlreadyObligatoryVacation',
      },
    });
  });

  it('should return 201 with vacation on successful creation', async () => {
    vi.mocked(YearlyVacationDays.findOne).mockResolvedValue({
      year: 2024,
      userId: 'user-123',
      obligatoryDays: [],
      electiveDaysTotalCount: 10,
      selectedElectiveDays: [],
    });

    vi.mocked(ElectiveVacation.find).mockResolvedValue([]);

    const mockVacation = {
      _id: 'vacation-123',
      userId: 'user-123',
      date: new Date('2024-06-15'),
      reason: 'Doctor appointment',
      status: 'pending',
    };

    vi.mocked(ElectiveVacation.create).mockResolvedValue(mockVacation);

    const req = mockReq({
      method: 'POST',
      body: { date: '2024-06-15', reason: 'Doctor appointment' },
    });
    const res = mockRes();

    await vacationCreateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      vacation: mockVacation,
    });
  });

  it('should return 500 on database error', async () => {
    vi.mocked(YearlyVacationDays.findOne).mockRejectedValue(new Error('DB Error'));

    const req = mockReq({
      method: 'POST',
      body: { date: '2024-06-15', reason: 'Doctor appointment' },
    });
    const res = mockRes();

    await vacationCreateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'PostError',
      details: {},
    });
  });
});
