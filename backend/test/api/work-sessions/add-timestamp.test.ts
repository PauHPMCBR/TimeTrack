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
    runValidation: async (middleware: any, req: any, res: any) => {
        await new Promise((resolve) =>
            middleware(req, res, () => resolve(true))
        );
        return !res.headersSent;
    },

    validateRequestBody:
        () => (req: any, res: any, next: (err?: unknown) => void) =>
            next(),
}));

const { constructed } = vi.hoisted(() => ({
    constructed: [] as any[],
}));

vi.mock('@/models', () => {
    class WorkSession {
        static find = vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue([]),
        });
        static countDocuments = vi.fn().mockResolvedValue(0);
        static updateMany = vi.fn().mockResolvedValue({});
        constructor(doc: any) {
            constructed.push(doc);
        }
        save = vi.fn().mockResolvedValue({
            _id: 'session-123',
            userId: 'user-123',
            type: 'check_in',
            timestamp: new Date(),
            notes: null,
        });
    }
    class User {
        static updateOne = vi.fn().mockResolvedValue({});
    }
    return { WorkSession, User };
});

import { WorkSession } from '@/models';
import addTimestampHandler from '@/pages/api/work-sessions/add-timestamp';

describe('POST /api/work-sessions/add-timestamp', () => {
    let mockStaticFind: any;

    beforeEach(() => {
        vi.clearAllMocks();
        constructed.length = 0;
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
            body: { type: 'invalid', notes: null },
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
            body: { type: 'check_in', notes: null },
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
            body: { type: 'check_out', notes: null },
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
            body: { type: 'check_out', notes: null },
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
            body: { type: 'check_in', notes: null },
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
            body: { type: 'check_out', notes: null },
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

    it('should join the day’s current version and record the actor', async () => {
        const req = mockReq({
            method: 'POST',
            body: { type: 'check_out', notes: null },
        });
        const res = mockRes();

        // The day was already superseded twice by admin corrections: its
        // active documents are version 3, so a new punch joins version 3.
        mockStaticFind.mockReturnValue({
            sort: vi.fn().mockResolvedValue([
                {
                    _id: 'session-1',
                    type: 'check_in',
                    timestamp: new Date(),
                    version: 3,
                    status: 'active',
                },
            ]),
        } as any);

        await addTimestampHandler(req, res);

        expect(constructed).toHaveLength(1);
        expect(constructed[0]).toMatchObject({
            userId: 'user-123',
            type: 'check_out',
            source: 'user',
            version: 3,
            status: 'active',
        });
        expect(res.status).toHaveBeenCalledWith(201);
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

    describe('manual punch vs programmed automatic sessions', () => {
        const past = (msAgo: number) => new Date(Date.now() - msAgo);
        const future = (msAhead: number) => new Date(Date.now() + msAhead);
        const HOUR = 3_600_000;

        it('should override the programmed auto check-in/out when checking in manually after auto-apply', async () => {
            const req = mockReq({
                method: 'POST',
                body: { type: 'check_in', notes: null },
            });
            const res = mockRes();

            // Auto timetable 09:00-17:00 applied earlier today: the check-out
            // is still in the future, so it must not block the real punch.
            mockStaticFind.mockReturnValue({
                sort: vi.fn().mockResolvedValue([
                    {
                        _id: 'auto-in',
                        type: 'check_in',
                        timestamp: past(2 * HOUR),
                        source: 'automatic',
                        version: 2,
                        status: 'active',
                    },
                    {
                        _id: 'auto-out',
                        type: 'check_out',
                        timestamp: future(6 * HOUR),
                        source: 'automatic',
                        version: 2,
                        status: 'active',
                    },
                ]),
            } as any);

            await addTimestampHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(WorkSession.updateMany).toHaveBeenCalledTimes(1);
            expect(WorkSession.updateMany).toHaveBeenCalledWith(
                { _id: { $in: expect.arrayContaining(['auto-in', 'auto-out']) } },
                {
                    $set: expect.objectContaining({
                        status: 'replaced',
                        replacedByVersion: 2,
                    }),
                }
            );
            expect(constructed).toHaveLength(1);
            expect(constructed[0]).toMatchObject({
                type: 'check_in',
                source: 'user',
                version: 2,
                status: 'active',
            });
        });

        it('should keep the open automatic check-in and only drop the future check-out when checking out manually', async () => {
            const req = mockReq({
                method: 'POST',
                body: { type: 'check_out', notes: null },
            });
            const res = mockRes();

            mockStaticFind.mockReturnValue({
                sort: vi.fn().mockResolvedValue([
                    {
                        _id: 'auto-in',
                        type: 'check_in',
                        timestamp: past(2 * HOUR),
                        source: 'automatic',
                        version: 1,
                        status: 'active',
                    },
                    {
                        _id: 'auto-out',
                        type: 'check_out',
                        timestamp: future(6 * HOUR),
                        source: 'automatic',
                        version: 1,
                        status: 'active',
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
            expect(WorkSession.updateMany).toHaveBeenCalledWith(
                { _id: { $in: ['auto-out'] } },
                expect.anything()
            );
        });

        it('should not allow stacked check-ins after a manual check-in even with a future automatic check-out', async () => {
            const req = mockReq({
                method: 'POST',
                body: { type: 'check_in', notes: null },
            });
            const res = mockRes();

            mockStaticFind.mockReturnValue({
                sort: vi.fn().mockResolvedValue([
                    {
                        _id: 'auto-in',
                        type: 'check_in',
                        timestamp: past(3 * HOUR),
                        source: 'automatic',
                        version: 1,
                        status: 'active',
                    },
                    {
                        _id: 'manual-in',
                        type: 'check_in',
                        timestamp: past(1 * HOUR),
                        source: 'user',
                        version: 1,
                        status: 'active',
                    },
                    {
                        _id: 'auto-out',
                        type: 'check_out',
                        timestamp: future(6 * HOUR),
                        source: 'automatic',
                        version: 1,
                        status: 'active',
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
            expect(WorkSession.updateMany).not.toHaveBeenCalled();
        });

        it('should keep closed automatic intervals and replace the open one plus later programmed ones', async () => {
            const req = mockReq({
                method: 'POST',
                body: { type: 'check_in', notes: null },
            });
            const res = mockRes();

            // Timetable 09:00-13:00 + 15:00-19:00, now ~16:00: the first
            // interval is closed, the second is open with a future check-out.
            mockStaticFind.mockReturnValue({
                sort: vi.fn().mockResolvedValue([
                    {
                        _id: 'in-09',
                        type: 'check_in',
                        timestamp: past(8 * HOUR),
                        source: 'automatic',
                        version: 1,
                        status: 'active',
                    },
                    {
                        _id: 'out-13',
                        type: 'check_out',
                        timestamp: past(4 * HOUR),
                        source: 'automatic',
                        version: 1,
                        status: 'active',
                    },
                    {
                        _id: 'in-15',
                        type: 'check_in',
                        timestamp: past(1 * HOUR),
                        source: 'automatic',
                        version: 1,
                        status: 'active',
                    },
                    {
                        _id: 'out-19',
                        type: 'check_out',
                        timestamp: future(2 * HOUR),
                        source: 'automatic',
                        version: 1,
                        status: 'active',
                    },
                ]),
            } as any);

            await addTimestampHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            // The manual punch overrides the open auto check-in (15:00) and
            // the still-programmed 19:00 check-out; the closed 09-13 interval
            // stays untouched.
            expect(WorkSession.updateMany).toHaveBeenCalledWith(
                { _id: { $in: ['out-19', 'in-15'] } },
                expect.anything()
            );
            expect(constructed).toHaveLength(1);
            expect(constructed[0]).toMatchObject({ type: 'check_in' });
        });
    });
});
