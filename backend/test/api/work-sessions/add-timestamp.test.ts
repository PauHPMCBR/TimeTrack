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

vi.mock('@/models', () => ({
    WorkDaySessions: {
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        updateOne: vi.fn().mockResolvedValue({}),
    },
}));

import { WorkDaySessions } from '@/models';
import addTimestampHandler from '@/pages/api/work-sessions/add-timestamp';
import { dateKeyInTz, timeKeyInTz } from 'shared/src/lib/day-key';

const PINNED_INSTANT = new Date('2024-06-10T10:00:00Z');
const NOW_DATE = dateKeyInTz(PINNED_INSTANT, 'Europe/Madrid');
const NOW_TIME = timeKeyInTz(PINNED_INSTANT, 'Europe/Madrid');

const makeDayDoc = (
    sessions: unknown[],
    overrides: Record<string, unknown> = {}
) => ({
    _id: 'day-1',
    version: 1,
    source: 'userClick',
    date: NOW_DATE,
    sessions,
    ...overrides,
});

describe('POST /api/work-sessions/add-timestamp', () => {
    let dateNowSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        (WorkDaySessions.findOne as any).mockResolvedValue(null);
        dateNowSpy = vi
            .spyOn(Date, 'now')
            .mockReturnValue(PINNED_INSTANT.getTime());
    });

    afterEach(() => {
        dateNowSpy.mockRestore();
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

        (WorkDaySessions.findOne as any).mockResolvedValue(
            makeDayDoc([{ type: 'check_in', time: NOW_TIME, overtime: false }])
        );

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

        (WorkDaySessions.findOne as any).mockResolvedValue(
            makeDayDoc([{ type: 'check_out', time: NOW_TIME, overtime: false }])
        );

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

        await addTimestampHandler(req, res);

        expect(WorkDaySessions.findOne).toHaveBeenCalledWith(
            {
                userId: 'user-123',
                date: NOW_DATE,
                status: { $ne: 'replaced' },
            },
            undefined,
            undefined
        );

        expect(WorkDaySessions.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-123',
                date: NOW_DATE,
                sessions: [
                    { type: 'check_in', time: NOW_TIME, overtime: false },
                ],
                source: 'userClick',
                version: 1,
                status: 'active',
            })
        );

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    message: 'CheckInRegistered',
                    session: {
                        type: 'check_in',
                        time: NOW_TIME,
                        overtime: false,
                    },
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

        // The last session today is an open check-in, so a check-out is valid.
        (WorkDaySessions.findOne as any).mockResolvedValue(
            makeDayDoc([{ type: 'check_in', time: '08:00', overtime: false }])
        );

        await addTimestampHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    message: 'CheckOutRegistered',
                    hoursWorked: 4,
                    session: {
                        type: 'check_out',
                        time: NOW_TIME,
                        overtime: false,
                    },
                }),
            })
        );
    });

    it('should persist the overtime flag on the appended session', async () => {
        const req = mockReq({
            method: 'POST',
            body: { type: 'check_out', notes: null, overtime: true },
        });
        const res = mockRes();

        (WorkDaySessions.findOne as any).mockResolvedValue(
            makeDayDoc([{ type: 'check_in', time: NOW_TIME, overtime: false }])
        );

        await addTimestampHandler(req, res);

        expect(WorkDaySessions.updateOne).toHaveBeenCalledWith(
            { _id: 'day-1' },
            expect.objectContaining({
                $push: {
                    sessions: {
                        type: 'check_out',
                        time: NOW_TIME,
                        notesEncrypted: '',
                        overtime: true,
                    },
                },
            })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should default the overtime flag to false when not provided', async () => {
        const req = mockReq({
            method: 'POST',
            body: { type: 'check_in', notes: null },
        });
        const res = mockRes();

        await addTimestampHandler(req, res);

        expect(WorkDaySessions.create).toHaveBeenCalledWith(
            expect.objectContaining({
                sessions: [
                    { type: 'check_in', time: NOW_TIME, overtime: false },
                ],
            })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should sync the paired open check-in overtime flag to the check-out decision', async () => {
        const req = mockReq({
            method: 'POST',
            body: { type: 'check_out', notes: null, overtime: false },
        });
        const res = mockRes();

        // The check-in was punched with the overtime toggle on, but the
        // user unchecked it before leaving: the saved interval must not
        // end up overtime (interval overtime = either end flagged).
        (WorkDaySessions.findOne as any).mockResolvedValue(
            makeDayDoc([{ type: 'check_in', time: NOW_TIME, overtime: true }])
        );

        await addTimestampHandler(req, res);

        expect(WorkDaySessions.updateOne).toHaveBeenCalledWith(
            {
                _id: 'day-1',
                'sessions.time': NOW_TIME,
                'sessions.type': 'check_in',
            },
            { $set: { 'sessions.$.overtime': false } }
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should flag the paired open check-in when checking out as overtime', async () => {
        const req = mockReq({
            method: 'POST',
            body: { type: 'check_out', notes: null, overtime: true },
        });
        const res = mockRes();

        (WorkDaySessions.findOne as any).mockResolvedValue(
            makeDayDoc([{ type: 'check_in', time: NOW_TIME, overtime: false }])
        );

        await addTimestampHandler(req, res);

        expect(WorkDaySessions.updateOne).toHaveBeenCalledWith(
            {
                _id: 'day-1',
                'sessions.time': NOW_TIME,
                'sessions.type': 'check_in',
            },
            { $set: { 'sessions.$.overtime': true } }
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should not touch the paired check-in when its flag already matches', async () => {
        const req = mockReq({
            method: 'POST',
            body: { type: 'check_out', notes: null, overtime: true },
        });
        const res = mockRes();

        (WorkDaySessions.findOne as any).mockResolvedValue(
            makeDayDoc([{ type: 'check_in', time: NOW_TIME, overtime: true }])
        );

        await addTimestampHandler(req, res);

        expect(WorkDaySessions.updateOne).toHaveBeenCalledTimes(1);
        expect(WorkDaySessions.create).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should append to the day’s current version without creating a new one', async () => {
        const req = mockReq({
            method: 'POST',
            body: { type: 'check_out', notes: null },
        });
        const res = mockRes();

        // The day was already superseded twice by admin corrections: its
        // active document is version 3, so a new punch joins version 3.
        (WorkDaySessions.findOne as any).mockResolvedValue(
            makeDayDoc([{ type: 'check_in', time: NOW_TIME, overtime: false }], {
                version: 3,
                status: 'active',
            })
        );

        await addTimestampHandler(req, res);

        expect(WorkDaySessions.updateOne).toHaveBeenCalledWith(
            { _id: 'day-1' },
            expect.objectContaining({
                $set: expect.objectContaining({ source: 'userClick' }),
                $push: {
                    sessions: {
                        type: 'check_out',
                        time: NOW_TIME,
                        notesEncrypted: '',
                        overtime: false,
                    },
                },
            })
        );
        // The live punch appends to the current version; no new version.
        expect(WorkDaySessions.create).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should serialize concurrent requests for the same user', async () => {
        let resolveFirst!: (v: unknown) => void;
        const firstFindPromise = new Promise<unknown>((resolve) => {
            resolveFirst = resolve;
        });
        const findCalls: boolean[] = [];
        (WorkDaySessions.findOne as any).mockImplementation(() => {
            findCalls.push(true);
            if (findCalls.length === 1) {
                return firstFindPromise;
            }
            return Promise.resolve(null);
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

        resolveFirst!(null);
        await Promise.all([p1, p2]);

        expect(res1.status).toHaveBeenCalledWith(201);
        expect(res2.status).toHaveBeenCalledWith(201);
        expect(findCalls.length).toBe(2);
    });

    describe('manual punch vs programmed automatic sessions', () => {
        const HOUR = 3_600_000;
        const past = (msAgo: number) =>
            timeKeyInTz(PINNED_INSTANT.getTime() - msAgo, 'Europe/Madrid');
        const future = (msAhead: number) =>
            timeKeyInTz(PINNED_INSTANT.getTime() + msAhead, 'Europe/Madrid');

        // The day's source is the self-applied auto timetable, so its
        // still-future sessions are "programmed" and punchable.
        beforeEach(() => {
            (WorkDaySessions.findOne as any).mockResolvedValue(
                makeDayDoc([], { source: 'userAutomatic' })
            );
        });

        it('should override the programmed auto check-in/out when checking in manually after auto-apply', async () => {
            const req = mockReq({
                method: 'POST',
                body: { type: 'check_in', notes: null },
            });
            const res = mockRes();

            // Auto timetable 10:00-18:00 applied earlier today: the check-out
            // is still in the future, so it must not block the real punch.
            (WorkDaySessions.findOne as any).mockResolvedValue(
                makeDayDoc(
                    [
                        {
                            type: 'check_in',
                            time: past(2 * HOUR),
                            overtime: false,
                        },
                        {
                            type: 'check_out',
                            time: future(6 * HOUR),
                            overtime: false,
                        },
                    ],
                    { source: 'userAutomatic', version: 2 }
                )
            );

            await addTimestampHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            // The old version is flagged replaced and the punch becomes the
            // next version with only the effective sessions.
            expect(WorkDaySessions.updateOne).toHaveBeenCalledWith(
                { _id: 'day-1' },
                expect.objectContaining({
                    $set: expect.objectContaining({
                        status: 'replaced',
                        replacedByVersion: 3,
                    }),
                })
            );
            expect(WorkDaySessions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    sessions: [
                        { type: 'check_in', time: NOW_TIME, overtime: false },
                    ],
                    source: 'userClick',
                    version: 3,
                    status: 'active',
                })
            );
        });

        it('should keep the open automatic check-in and only drop the future check-out when checking out manually', async () => {
            const req = mockReq({
                method: 'POST',
                body: { type: 'check_out', notes: null },
            });
            const res = mockRes();

            (WorkDaySessions.findOne as any).mockResolvedValue(
                makeDayDoc(
                    [
                        {
                            type: 'check_in',
                            time: past(2 * HOUR),
                            overtime: false,
                        },
                        {
                            type: 'check_out',
                            time: future(6 * HOUR),
                            overtime: false,
                        },
                    ],
                    { source: 'userAutomatic', version: 1 }
                )
            );

            await addTimestampHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        message: 'CheckOutRegistered',
                        hoursWorked: 2,
                    }),
                })
            );
            expect(WorkDaySessions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    sessions: [
                        {
                            type: 'check_in',
                            time: past(2 * HOUR),
                            overtime: false,
                        },
                        {
                            type: 'check_out',
                            time: NOW_TIME,
                            overtime: false,
                        },
                    ],
                    version: 2,
                })
            );
        });

        it('should not allow stacked check-ins after a manual check-in even with a future automatic check-out', async () => {
            const req = mockReq({
                method: 'POST',
                body: { type: 'check_in', notes: null },
            });
            const res = mockRes();

            (WorkDaySessions.findOne as any).mockResolvedValue(
                makeDayDoc(
                    [
                        {
                            type: 'check_in',
                            time: past(3 * HOUR),
                            overtime: false,
                        },
                        {
                            type: 'check_in',
                            time: past(1 * HOUR),
                            overtime: false,
                        },
                        {
                            type: 'check_out',
                            time: future(6 * HOUR),
                            overtime: false,
                        },
                    ],
                    { source: 'userAutomatic', version: 1 }
                )
            );

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
            expect(WorkDaySessions.create).not.toHaveBeenCalled();
            expect(WorkDaySessions.updateOne).not.toHaveBeenCalled();
        });

        it('should keep closed automatic intervals and replace the open one plus later programmed ones', async () => {
            dateNowSpy.mockReturnValue(
                new Date('2024-06-10T14:00:00Z').getTime()
            );
            const req = mockReq({
                method: 'POST',
                body: { type: 'check_in', notes: null },
            });
            const res = mockRes();

            // Timetable 09:00-13:00 + 15:00-19:00, now ~16:00: the first
            // interval is closed, the second is open with a future check-out.
            (WorkDaySessions.findOne as any).mockResolvedValue(
                makeDayDoc(
                    [
                        { type: 'check_in', time: '09:00', overtime: false },
                        { type: 'check_out', time: '13:00', overtime: false },
                        { type: 'check_in', time: '15:00', overtime: false },
                        { type: 'check_out', time: '19:00', overtime: false },
                    ],
                    { source: 'userAutomatic', version: 1 }
                )
            );

            await addTimestampHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            // The manual punch overrides the open auto check-in (15:00) and
            // the still-programmed 19:00 check-out; the closed 09-13 interval
            // stays untouched.
            expect(WorkDaySessions.updateOne).toHaveBeenCalledWith(
                { _id: 'day-1' },
                expect.objectContaining({
                    $set: expect.objectContaining({
                        status: 'replaced',
                        replacedByVersion: 2,
                    }),
                })
            );
            expect(WorkDaySessions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    sessions: [
                        {
                            type: 'check_in',
                            time: '09:00',
                            overtime: false,
                        },
                        {
                            type: 'check_out',
                            time: '13:00',
                            overtime: false,
                        },
                        {
                            type: 'check_in',
                            time: '16:00',
                            overtime: false,
                        },
                    ],
                })
            );
        });

        it('overrides future sessions of a non-automatic day too (planned-ahead correction)', async () => {
            const req = mockReq({
                method: 'POST',
                body: { type: 'check_out', notes: null },
            });
            const res = mockRes();

            // The day was admin-corrected with a planned future check-out;
            // a real punch must still override it.
            (WorkDaySessions.findOne as any).mockResolvedValue(
                makeDayDoc(
                    [
                        {
                            type: 'check_in',
                            time: past(2 * HOUR),
                            overtime: false,
                        },
                        {
                            type: 'check_out',
                            time: future(6 * HOUR),
                            overtime: false,
                        },
                    ],
                    { source: 'adminManual', version: 3 }
                )
            );

            await addTimestampHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(WorkDaySessions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    sessions: [
                        {
                            type: 'check_in',
                            time: past(2 * HOUR),
                            overtime: false,
                        },
                        {
                            type: 'check_out',
                            time: NOW_TIME,
                            overtime: false,
                        },
                    ],
                    source: 'userClick',
                    version: 4,
                    status: 'active',
                })
            );
        });
    });
});
