import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
    authenticateToken: (handler: (req: unknown, res: unknown) => unknown) => {
        return async (req: any, res: any) => {
            req.user = {
                userId: 'user-123',
                email: 'test@example.com',
                role: 'employee',
            };
            return handler(req, res);
        };
    },
    AuthRequest: class {},
}));

vi.mock('@/lib/validation', () => ({
    validateRequestBody:
        () => (req: any, res: any, next: (err?: unknown) => void) =>
            next(),
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
            success: false,
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
            success: false,
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
                {
                    _id: 'session-1',
                    type: 'check_in',
                    timestamp: new Date(),
                },
            ]),
        } as any);

        await addTimestampHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
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
            success: false,
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
                {
                    _id: 'session-1',
                    type: 'check_out',
                    timestamp: new Date(),
                },
            ]),
        } as any);

        await addTimestampHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
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
                data: expect.objectContaining({
                    message: 'CheckInRegistered',
                }),
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

        // The last session today is an open check-in, so a check-out is valid.
        mockStaticFind.mockReturnValue({
            sort: vi.fn().mockResolvedValue([
                {
                    _id: 'session-1',
                    type: 'check_in',
                    timestamp: checkInTime,
                },
            ]),
        } as any);

        await addTimestampHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    message: 'CheckOutRegistered',
                    hoursWorked: expect.any(Number),
                }),
            })
        );
    });

    it('should serialize concurrent requests for the same user', async () => {
        let resolveFirst!: (v: any[]) => void;
        const firstFindPromise = new Promise<any[]>((resolve) => {
            resolveFirst = resolve;
        });
        const findCalls: boolean[] = [];
        mockStaticFind.mockImplementation(() => {
            findCalls.push(true);
            if (findCalls.length === 1) {
                return { sort: vi.fn().mockReturnValue(firstFindPromise) };
            }
            return { sort: vi.fn().mockResolvedValue([]) };
        });

        const req1 = mockReq({ method: 'POST', body: { type: 'check_in' } });
        const res1 = mockRes();
        const p1 = addTimestampHandler(req1, res1);

        const req2 = mockReq({ method: 'POST', body: { type: 'check_in' } });
        const res2 = mockRes();
        const p2 = addTimestampHandler(req2, res2);

        // Let the first request acquire the per-user lock and start its query.
        await vi.waitFor(() => {
            expect(findCalls.length).toBe(1);
        });

        // The second request must be blocked behind the lock, not yet querying.
        expect(findCalls.length).toBe(1);

        resolveFirst!([]);
        await Promise.all([p1, p2]);

        expect(res1.status).toHaveBeenCalledWith(201);
        expect(res2.status).toHaveBeenCalledWith(201);
        expect(findCalls.length).toBe(2);
    });
});
