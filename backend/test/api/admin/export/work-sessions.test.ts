import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq } from '../../../utils/mocks';

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
  validateQueryParams: () => (req: any, res: any, next: (err?: unknown) => void) => next(),
}));

vi.mock('@/models', () => ({
  User: {
    find: vi.fn(),
  },
  WorkSession: {
    find: vi.fn(),
  },
}));

import { User, WorkSession } from '@/models';
import exportHandler from '@/pages/api/admin/export/work-sessions';

const mockExportRes = () => {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
};

describe('GET /api/admin/export/work-sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not GET', async () => {
    const req = mockReq({ method: 'POST', query: { userIds: 'user-1' } });
    const res = mockExportRes();

    await exportHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'MethodNotAllowed', details: {} });
  });

  it('should return CSV with sessions sorted by timestamp', async () => {
    const mockUsers = [
      { _id: 'user-1', name: 'Alice', email: 'alice@example.com' },
      { _id: 'user-2', name: 'Bob', email: 'bob@example.com' },
    ];
    const mockSessions = [
      { _id: 's2', userId: 'user-2', type: 'check_in', timestamp: new Date('2024-01-15T08:00:00Z'), reason: 'Work, from home', notes: 'note' },
      { _id: 's1', userId: 'user-1', type: 'check_out', timestamp: new Date('2024-01-14T17:00:00Z') },
    ];

    vi.mocked(User.find).mockResolvedValue(mockUsers as any);
    vi.mocked(WorkSession.find).mockReturnValue({
      sort: vi.fn().mockImplementation(() =>
        Promise.resolve(
          [...mockSessions].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )
        )
      ),
    } as any);

    const req = mockReq({ method: 'GET', query: { userIds: 'user-1,user-2' } });
    const res = mockExportRes();

    await exportHandler(req, res);

    expect(WorkSession.find).toHaveBeenCalledWith({ userId: { $in: ['user-1', 'user-2'] } });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('.csv')
    );
    expect(res.status).toHaveBeenCalledWith(200);

    const csv = res.send.mock.calls[0][0] as string;
    expect(csv).toContain('Name,Email,Timestamp,Type,Reason,Notes');
    expect(csv).toContain('Alice,alice@example.com');
    expect(csv).toContain('Bob,bob@example.com');
    expect(csv).toContain('"Work, from home"');
    expect(csv.indexOf('2024-01-14')).toBeLessThan(csv.indexOf('2024-01-15'));
  });

  it('should return 500 on database error', async () => {
    vi.mocked(User.find).mockRejectedValue(new Error('DB Error'));

    const req = mockReq({ method: 'GET', query: { userIds: 'user-1' } });
    const res = mockExportRes();

    await exportHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'GetError', details: {} });
  });
});
