import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
  requireSameGroupOrAdmin: (handler: (req: unknown, res: unknown) => unknown) => {
    return async (req: any, res: any) => {
      req.user = { userId: 'user-123', email: 'test@example.com', role: 'employee' };
      return handler(req, res);
    };
  },
  AuthRequest: class {},
}));

vi.mock('@/lib/validation', () => ({
  validateQueryParams: () => (req: any, res: any, next: (err?: unknown) => void) => next(),
}));

vi.mock('@/models', () => ({
  WorkSession: {
    find: vi.fn(),
  },
}));

import { WorkSession } from '@/models';
import workSessionRangeHandler from '@/pages/api/work-sessions/[userId]/range';

describe('GET /api/work-sessions/[userId]/range', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not GET', async () => {
    const req = mockReq({ method: 'POST', query: { userId: 'user-456', from: '2024-01-01', to: '2024-03-31' } });
    const res = mockRes();

    await workSessionRangeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 200 with sessions within the range on successful GET', async () => {
    const mockSessions = [
      { _id: 'session-1', type: 'check_in', timestamp: new Date('2024-02-01T08:00:00') },
      { _id: 'session-2', type: 'check_out', timestamp: new Date('2024-02-01T17:00:00') },
    ];

    vi.mocked(WorkSession.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockSessions),
      }),
    } as any);

    const req = mockReq({ method: 'GET', query: { userId: 'user-456', from: '2024-01-01', to: '2024-03-31' } });
    const res = mockRes();

    await workSessionRangeHandler(req, res);

    expect(WorkSession.find).toHaveBeenCalledWith({
      userId: 'user-456',
      timestamp: {
        $gte: new Date('2024-01-01T00:00:00'),
        $lte: new Date('2024-03-31T23:59:59.999'),
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      workSessions: mockSessions,
    });
  });

  it('should return 400 when to is not a valid date', async () => {
    const req = mockReq({ method: 'GET', query: { userId: 'user-456', from: '2024-01-01', to: 'nope' } });
    const res = mockRes();

    await workSessionRangeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'date',
        reasons: ['InvalidTimestamp'],
      },
    });
  });

  it('should return 500 on database error', async () => {
    vi.mocked(WorkSession.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockRejectedValue(new Error('DB Error')),
      }),
    } as any);

    const req = mockReq({ method: 'GET', query: { userId: 'user-456', from: '2024-01-01', to: '2024-03-31' } });
    const res = mockRes();

    await workSessionRangeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'GetError',
      details: {},
    });
  });
});