import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

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
  validateRequestBody: () => (req: any, res: any, next: (err?: unknown) => void) => next(),
}));

vi.mock('@/lib/settings', () => ({
  getAppSettings: vi.fn().mockResolvedValue({
    defaultExpectedHours: 8,
    benevolenceHours: 1,
    toleranceHours: 1,
    endOfDayHour: 17,
    nonWorkingDays: [6, 0],
  }),
}));

const queryChain = (result: unknown) => ({
  select: vi.fn().mockReturnThis(),
  sort: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(result),
});

const simpleChain = (result: unknown) => ({
  lean: vi.fn().mockResolvedValue(result),
});

vi.mock('@/models', () => ({
  User: { find: vi.fn(), findById: vi.fn() },
  WorkSession: { find: vi.fn(), deleteMany: vi.fn(), insertMany: vi.fn() },
  ElectiveVacation: { find: vi.fn() },
  YearlyVacationDays: { find: vi.fn() },
}));

import { User, WorkSession, ElectiveVacation, YearlyVacationDays } from '@/models';
import adminWorkSessionsHandler from '@/pages/api/admin/work-sessions';

const at = (h: number, m = 0, day = '2025-06-09') => new Date(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);

const users = [
  { _id: 'u1', name: 'Anna', email: 'anna@example.com', dni: '1', expectedWorkHours: 8 },
  { _id: 'u2', name: 'Berta', email: 'berta@example.com', dni: '2', expectedWorkHours: 8 },
];

describe('GET /api/admin/work-sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not GET', async () => {
    const req = mockReq({ method: 'POST' });
    const res = mockRes();

    await adminWorkSessionsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return ok and anomaly rows for a day', async () => {
    vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
    vi.mocked(WorkSession.find).mockReturnValue(queryChain([
      { _id: 's1', userId: 'u1', type: 'check_in', timestamp: at(9), source: 'user' },
      { _id: 's2', userId: 'u1', type: 'check_out', timestamp: at(17), source: 'user' },
      { _id: 's3', userId: 'u2', type: 'check_in', timestamp: at(9), source: 'admin' },
    ]) as any);
    vi.mocked(ElectiveVacation.find).mockReturnValue(simpleChain([]) as any);
    vi.mocked(YearlyVacationDays.find).mockReturnValue(simpleChain([]) as any);

    const req = mockReq({ method: 'GET', query: { period: 'day', date: '2025-06-09' } });
    const res = mockRes();

    await adminWorkSessionsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    const rows = payload.data.rows;

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ userName: 'Anna', status: 'ok', totalHours: 8, anomalies: [] });
    expect(rows[1]).toMatchObject({ userName: 'Berta', status: 'anomaly', totalHours: 0, anomalies: ['forgot_check_out'] });
    expect(rows[0].sessions.map((s: any) => s.source)).toEqual(['user', 'user']);
    expect(rows[1].sessions[0].source).toBe('admin');
  });

  it('should flag hours_over when worked more than expected + benevolence', async () => {
    vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
    vi.mocked(WorkSession.find).mockReturnValue(queryChain([
      { _id: 's1', userId: 'u1', type: 'check_in', timestamp: at(9) },
      { _id: 's2', userId: 'u1', type: 'check_out', timestamp: at(20) },
    ]) as any);
    vi.mocked(ElectiveVacation.find).mockReturnValue(simpleChain([]) as any);
    vi.mocked(YearlyVacationDays.find).mockReturnValue(simpleChain([]) as any);

    const req = mockReq({ method: 'GET', query: { period: 'day', date: '2025-06-09' } });
    const res = mockRes();

    await adminWorkSessionsHandler(req, res);

    const rows = res.json.mock.calls[0][0].data.rows;
    const anna = rows.find((r: any) => r.userId === 'u1');
    expect(anna).toMatchObject({ status: 'anomaly', totalHours: 11, anomalies: ['hours_over'] });
  });

  it('should mark a user as vacation when they have an approved vacation', async () => {
    vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
    vi.mocked(WorkSession.find).mockReturnValue(queryChain([]) as any);
    vi.mocked(ElectiveVacation.find).mockReturnValue(simpleChain([
      { _id: 'v1', userId: 'u2', date: new Date('2025-06-09T00:00:00'), status: 'approved' },
    ]) as any);
    vi.mocked(YearlyVacationDays.find).mockReturnValue(simpleChain([]) as any);

    const req = mockReq({ method: 'GET', query: { period: 'day', date: '2025-06-09' } });
    const res = mockRes();

    await adminWorkSessionsHandler(req, res);

    const rows = res.json.mock.calls[0][0].data.rows;
    const berta = rows.find((r: any) => r.userId === 'u2');
    expect(berta).toMatchObject({ status: 'vacation', anomalies: [] });
  });

  it('should mark hours_short when a weekday has no sessions', async () => {
    vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
    vi.mocked(WorkSession.find).mockReturnValue(queryChain([]) as any);
    vi.mocked(ElectiveVacation.find).mockReturnValue(simpleChain([]) as any);
    vi.mocked(YearlyVacationDays.find).mockReturnValue(simpleChain([]) as any);

    const req = mockReq({ method: 'GET', query: { period: 'day', date: '2025-06-09' } });
    const res = mockRes();

    await adminWorkSessionsHandler(req, res);

    const rows = res.json.mock.calls[0][0].data.rows;
    const anna = rows.find((r: any) => r.userId === 'u1');
    expect(anna).toMatchObject({ status: 'anomaly', totalHours: 0, anomalies: ['hours_short'] });
  });

  it('should show quiet non-working days as nonWorkingDay', async () => {
    vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
    vi.mocked(WorkSession.find).mockReturnValue(queryChain([]) as any);
    vi.mocked(ElectiveVacation.find).mockReturnValue(simpleChain([]) as any);
    vi.mocked(YearlyVacationDays.find).mockReturnValue(simpleChain([]) as any);

    const req = mockReq({ method: 'GET', query: { period: 'day', date: '2025-06-14' } }); // Saturday (non-working)
    const res = mockRes();

    await adminWorkSessionsHandler(req, res);

    const rows = res.json.mock.calls[0][0].data.rows;
    expect(rows).toHaveLength(2);
    expect(rows.every((r: any) => r.status === 'nonWorkingDay')).toBe(true);
  });

  it('should mark a user-specific non-working day', async () => {
    vi.mocked(User.find).mockReturnValue(queryChain([
      { _id: 'u1', name: 'Anna', email: 'anna@example.com', dni: '1', expectedWorkHours: 8, workDays: [5, 6] },
    ]) as any);
    vi.mocked(WorkSession.find).mockReturnValue(queryChain([]) as any);
    vi.mocked(ElectiveVacation.find).mockReturnValue(simpleChain([]) as any);
    vi.mocked(YearlyVacationDays.find).mockReturnValue(simpleChain([]) as any);

    const req = mockReq({ method: 'GET', query: { period: 'day', date: '2025-06-14' } }); // Saturday
    const res = mockRes();

    await adminWorkSessionsHandler(req, res);

    const rows = res.json.mock.calls[0][0].data.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userName: 'Anna', status: 'nonWorkingDay', anomalies: [] });
  });

  it('should sort rows by date then name', async () => {
    vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
    vi.mocked(WorkSession.find).mockReturnValue(queryChain([
      { _id: 's1', userId: 'u1', type: 'check_in', timestamp: at(9, 0, '2025-06-09') },
      { _id: 's2', userId: 'u1', type: 'check_out', timestamp: at(17, 0, '2025-06-09') },
      { _id: 's3', userId: 'u2', type: 'check_in', timestamp: at(9, 0, '2025-06-09') },
      { _id: 's4', userId: 'u2', type: 'check_out', timestamp: at(17, 0, '2025-06-09') },
      { _id: 's5', userId: 'u1', type: 'check_in', timestamp: at(9, 0, '2025-06-10') },
      { _id: 's6', userId: 'u1', type: 'check_out', timestamp: at(17, 0, '2025-06-10') },
    ]) as any);
    vi.mocked(ElectiveVacation.find).mockReturnValue(simpleChain([]) as any);
    vi.mocked(YearlyVacationDays.find).mockReturnValue(simpleChain([]) as any);

    const req = mockReq({ method: 'GET', query: { period: 'week', date: '2025-06-09' } });
    const res = mockRes();

    await adminWorkSessionsHandler(req, res);

    const rows = res.json.mock.calls[0][0].data.rows;
    const keys = rows.map((r: any) => `${r.date}:${r.userName}`);
    expect(keys).toEqual([
      '2025-06-09:Anna',
      '2025-06-09:Berta',
      '2025-06-10:Anna',
      '2025-06-10:Berta',
      '2025-06-11:Anna',
      '2025-06-11:Berta',
      '2025-06-12:Anna',
      '2025-06-12:Berta',
      '2025-06-13:Anna',
      '2025-06-13:Berta',
      '2025-06-14:Anna',
      '2025-06-14:Berta',
      '2025-06-15:Anna',
      '2025-06-15:Berta',
    ]);
  });

  it('should return 500 on database error', async () => {
    vi.mocked(User.find).mockImplementation(() => {
      throw new Error('DB Error');
    });

    const req = mockReq({ method: 'GET', query: { period: 'day', date: '2025-06-09' } });
    const res = mockRes();

    await adminWorkSessionsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'GetError',
      details: {},
    });
  });

  describe('PUT (replace day)', () => {
    it('should reject an incoherent sequence', async () => {
      vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' });

      const req = mockReq({
        method: 'PUT',
        body: {
          userId: 'u1',
          date: '2025-06-09',
          sessions: [
            { type: 'check_in', timestamp: at(9).toISOString() },
            { type: 'check_in', timestamp: at(10).toISOString() },
          ],
        },
      });
      const res = mockRes();

      await adminWorkSessionsHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'IncorrectParameter',
        details: {
          incorrectParameter: 'type',
          reasons: ['NotInOrder'],
        },
      });
    });

    it('should reject a timestamp outside the day', async () => {
      vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' });

      const req = mockReq({
        method: 'PUT',
        body: {
          userId: 'u1',
          date: '2025-06-09',
          sessions: [{ type: 'check_in', timestamp: new Date('2025-06-10T09:00:00').toISOString() }],
        },
      });
      const res = mockRes();

      await adminWorkSessionsHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'IncorrectParameter',
        details: {
          incorrectParameter: 'timestamp',
          reasons: ['OutOfDay'],
        },
      });
    });

    it('should reject equal timestamps', async () => {
      vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' });

      const req = mockReq({
        method: 'PUT',
        body: {
          userId: 'u1',
          date: '2025-06-09',
          sessions: [
            { type: 'check_in', timestamp: at(9).toISOString() },
            { type: 'check_out', timestamp: at(9).toISOString() },
          ],
        },
      });
      const res = mockRes();

      await adminWorkSessionsHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'IncorrectParameter',
        details: {
          incorrectParameter: 'timestamp',
          reasons: ['NotInOrder'],
        },
      });
    });

    it('should replace the day sessions on success', async () => {
      vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' });
      vi.mocked(WorkSession.deleteMany).mockResolvedValue({ deletedCount: 0 } as any);
      vi.mocked(WorkSession.insertMany).mockResolvedValue([
        { _id: 'x1', userId: 'u1', type: 'check_in', timestamp: at(9) },
        { _id: 'x2', userId: 'u1', type: 'check_out', timestamp: at(17) },
      ] as any);

      const req = mockReq({
        method: 'PUT',
        body: {
          userId: 'u1',
          date: '2025-06-09',
          sessions: [
            { type: 'check_in', timestamp: at(9).toISOString() },
            { type: 'check_out', timestamp: at(17).toISOString() },
          ],
        },
      });
      const res = mockRes();

      await adminWorkSessionsHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(WorkSession.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1' })
      );
      expect(WorkSession.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ userId: 'u1', type: 'check_in', source: 'admin' }),
          expect.objectContaining({ userId: 'u1', type: 'check_out', source: 'admin' }),
        ])
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ workSessions: expect.any(Array) }),
        })
      );
    });

    it('should return 404 when the user does not exist', async () => {
      vi.mocked(User.findById).mockResolvedValue(null);

      const req = mockReq({
        method: 'PUT',
        body: { userId: 'missing', date: '2025-06-09', sessions: [] },
      });
      const res = mockRes();

      await adminWorkSessionsHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'EntryNotFound',
        details: { entry: 'User' },
      });
    });

it('should paginate rows when limit/offset are provided', async () => {
    vi.mocked(User.find).mockReturnValue(queryChain(users) as any);
    vi.mocked(WorkSession.find).mockReturnValue(queryChain([]) as any);
    vi.mocked(ElectiveVacation.find).mockReturnValue(simpleChain([]) as any);
    vi.mocked(YearlyVacationDays.find).mockReturnValue(simpleChain([]) as any);

    const req = mockReq({
      method: 'GET',
      query: { period: 'week', date: '2025-06-09', limit: '3', offset: '2' },
    });
    const res = mockRes();

    await adminWorkSessionsHandler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.data.total).toBe(14); // 2 users × 7 days
    expect(body.data.limit).toBe(3);
    expect(body.data.offset).toBe(2);
    expect(body.data.rows).toHaveLength(3);
    const keys = body.data.rows.map((r: any) => `${r.date}:${r.userName}`);
    expect(keys).toEqual([
      '2025-06-10:Anna',
      '2025-06-10:Berta',
      '2025-06-11:Anna',
    ]);
  });

  it('should return 500 on database error', async () => {
      vi.mocked(User.findById).mockRejectedValue(new Error('DB Error'));

      const req = mockReq({
        method: 'PUT',
        body: { userId: 'u1', date: '2025-06-09', sessions: [] },
      });
      const res = mockRes();

      await adminWorkSessionsHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'PutError',
        details: {},
      });
    });
  });
});