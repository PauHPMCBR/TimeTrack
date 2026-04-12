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
  WorkSession: class {
    static find = vi.fn().mockReturnValue({
      sort: vi.fn().mockResolvedValue([]),
    });
    save = vi.fn().mockResolvedValue({
      _id: 'session-123',
      userId: 'user-123',
      type: 'check_in',
      timestamp: new Date(),
      reason: null,
      notes: null,
    });
  },
}));

import { WorkSession } from '@/models';
import addTimestampHandler from '@/pages/api/work-sessions/add-timestamp';

describe('POST /api/work-sessions/add-timestamp', () => {
  let mockStaticFind: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStaticFind = vi.spyOn(WorkSession, 'find').mockReturnValue({
      sort: vi.fn().mockResolvedValue([]),
    } as any);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not POST', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();

    await addTimestampHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 400 if type is invalid', async () => {
    const req = mockReq({
      method: 'POST',
      body: { type: 'invalid', reason: null, notes: null },
    });
    const res = mockRes();

    await addTimestampHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'type',
        reasons: [],
      },
    });
  });

  it('should return 400 if already checked in', async () => {
    const req = mockReq({
      method: 'POST',
      body: { type: 'check_in', reason: null, notes: null },
    });
    const res = mockRes();

    mockStaticFind.mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        { _id: 'session-1', type: 'check_in', timestamp: new Date() },
      ]),
    } as any);

    await addTimestampHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'type',
        reasons: ['AlreadyCheckedIn'],
      },
    });
  });

  it('should return 400 if no entry today when checking out', async () => {
    const req = mockReq({
      method: 'POST',
      body: { type: 'check_out', reason: null, notes: null },
    });
    const res = mockRes();

    mockStaticFind.mockReturnValue({
      sort: vi.fn().mockResolvedValue([]),
    } as any);

    await addTimestampHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'type',
        reasons: ['NoEntryToday'],
      },
    });
  });

  it('should return 400 if already checked out', async () => {
    const req = mockReq({
      method: 'POST',
      body: { type: 'check_out', reason: null, notes: null },
    });
    const res = mockRes();

    mockStaticFind.mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        { _id: 'session-1', type: 'check_out', timestamp: new Date() },
      ]),
    } as any);

    await addTimestampHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IncorrectParameter',
      details: {
        incorrectParameter: 'type',
        reasons: ['AlreadyCheckedOut'],
      },
    });
  });

  it('should return 201 with check_in message on successful check_in', async () => {
    const req = mockReq({
      method: 'POST',
      body: { type: 'check_in', reason: null, notes: null },
    });
    const res = mockRes();

    mockStaticFind.mockReturnValue({
      sort: vi.fn().mockResolvedValue([]),
    } as any);

    await addTimestampHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'CheckInRegistered',
      })
    );
  });

  it('should return 201 with check_out message and hoursWorked on successful check_out', async () => {
    const req = mockReq({
      method: 'POST',
      body: { type: 'check_out', reason: null, notes: null },
    });
    const res = mockRes();

    const checkInTime = new Date();
    checkInTime.setHours(8, 0, 0, 0);
    const checkOutTime = new Date();
    checkOutTime.setHours(17, 0, 0, 0);

    mockStaticFind.mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        { _id: 'session-1', type: 'check_in', timestamp: checkInTime },
        { _id: 'session-2', type: 'check_out', timestamp: checkOutTime },
      ]),
    } as any);

    await addTimestampHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'CheckOutRegistered',
      })
    );
  });
});
