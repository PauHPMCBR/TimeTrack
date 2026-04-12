import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../utils/mocks';

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
  ElectiveVacation: {
    findById: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({}),
  },
}));

import { ElectiveVacation } from '@/models';
import vacationCancelHandler from '@/pages/api/vacations/[vacationId]/cancel';

describe('POST /api/vacations/[vacationId]/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return 405 if method is not POST', async () => {
    const req = mockReq({ method: 'GET', query: { vacationId: 'vacation-123' } });
    const res = mockRes();

    await vacationCancelHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: 'MethodNotAllowed',
      details: {},
    });
  });

  it('should return 400 if trying to cancel another user vacation', async () => {
    vi.mocked(ElectiveVacation.findById).mockResolvedValue({
      _id: 'vacation-123',
      userId: 'user-456',  // Different user
    });

    const req = mockReq({
      method: 'POST',
      query: { vacationId: 'vacation-123' },
    });
    const res = mockRes();

    await vacationCancelHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'IllegalAction',
      details: { illegalAction: 'ModifyingFromAnotherUser' },
    });
  });

  it('should return 201 with success on successful cancel', async () => {
    vi.mocked(ElectiveVacation.findById).mockResolvedValue({
      _id: 'vacation-123',
      userId: 'user-123',  // Same user
    });

    const req = mockReq({
      method: 'POST',
      query: { vacationId: 'vacation-123' },
    });
    const res = mockRes();

    await vacationCancelHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(ElectiveVacation.updateMany).toHaveBeenCalledWith(
      { _id: 'vacation-123' },
      { status: 'cancelled' }
    );
  });

  it('should return 500 on database error', async () => {
    vi.mocked(ElectiveVacation.findById).mockRejectedValue(new Error('DB Error'));

    const req = mockReq({
      method: 'POST',
      query: { vacationId: 'vacation-123' },
    });
    const res = mockRes();

    await vacationCancelHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'PostError',
      details: {},
    });
  });
});
