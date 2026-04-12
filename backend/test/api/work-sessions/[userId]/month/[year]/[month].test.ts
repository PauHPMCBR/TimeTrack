import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../../../utils/mocks';

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
  WorkSession: {
    find: vi.fn(),
  },
}));

import { WorkSession } from '@/models';
import workSessionMonthHandler from '@/pages/api/work-sessions/[userId]/month/[year]/[month]';

describe('GET /api/work-sessions/[userId]/month/[year]/[month]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not GET', async () => {
    const req = mockReq({ method: 'POST', query: { userId: 'user-456', year: '2024', month: '1' } });
    const res = mockRes();

    await workSessionMonthHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 200 with monthly sessions on successful GET', async () => {
    const mockSessions = [
      { _id: 'session-1', type: 'check_in', timestamp: new Date('2024-01-15T08:00:00') },
      { _id: 'session-2', type: 'check_out', timestamp: new Date('2024-01-15T17:00:00') },
    ];

    vi.mocked(WorkSession.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue(mockSessions),
    } as any);

    const req = mockReq({ method: 'GET', query: { userId: 'user-456', year: '2024', month: '1' } });
    const res = mockRes();

    await workSessionMonthHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-456',
        year: 2024,
        month: 1,
        sessionsByDay: expect.any(Array),
        summary: expect.objectContaining({
          totalSessions: 2,
          totalHoursWorked: expect.any(Number),
          daysWithSessions: expect.any(Number),
        }),
      })
    );
  });

  it('should return 500 on database error', async () => {
    vi.mocked(WorkSession.find).mockReturnValue({
      sort: vi.fn().mockRejectedValue(new Error('DB Error')),
    } as any);

    const req = mockReq({ method: 'GET', query: { userId: 'user-456', year: '2024', month: '1' } });
    const res = mockRes();

    await workSessionMonthHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'GetError',
      details: {},
    });
  });
});
