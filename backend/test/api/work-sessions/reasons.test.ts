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
  WorkSessionReason: {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        { _id: 'reason-1', name: 'Working from home', type: 'all' },
        { _id: 'reason-2', name: 'Doctor appointment', type: 'check_in' },
      ]),
    }),
  },
}));

import reasonsHandler from '@/pages/api/work-sessions/reasons';

describe('GET /api/work-sessions/reasons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not GET', async () => {
    const req = mockReq({ method: 'POST' });
    const res = mockRes();

    await reasonsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });
});
