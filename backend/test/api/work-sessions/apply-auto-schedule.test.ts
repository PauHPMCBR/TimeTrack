import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

process.env.COMPANY_LANGUAGE = 'en';

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

vi.mock('@/lib/user-lock', () => ({
    withUserLock: async (_userId: string, fn: () => unknown) => fn(),
}));

const { savedDocs, findOne, updateOne } = vi.hoisted(() => {
    const savedDocs: any[] = [];
    const findOne = vi.fn().mockResolvedValue(null);
    const updateOne = vi.fn().mockResolvedValue({});
    return { savedDocs, findOne, updateOne };
});

vi.mock('@/models', () => {
    const WorkDaySessions = {
        findOne,
        updateOne,
        create: vi.fn((doc: any) => {
            savedDocs.push(doc);
            return Promise.resolve({ ...doc, _id: 'day-1' });
        }),
    };
    return {
        User: { findById: vi.fn() },
        WorkDaySessions,
        MonthlyApproval: { findOne: vi.fn().mockResolvedValue(null) },
    };
});

import { User, WorkDaySessions } from '@/models';
import applyAutoScheduleHandler from '@/pages/api/work-sessions/apply-auto-schedule';

vi.mock('@/lib/work-day-records', () => ({
    recomputeWorkDayRecords: vi.fn().mockResolvedValue(undefined),
    recomputeWorkDayRecordsForRange: vi.fn().mockResolvedValue(undefined),
    lastClosedDayKey: vi.fn().mockResolvedValue('2025-06-09'),
    backfillUserWorkDayRecordsFromTrackingStart: vi
        .fn()
        .mockResolvedValue(0),
    ensureWorkDayRecordsForDay: vi.fn().mockResolvedValue(0),
    backfillAllWorkDayRecords: vi.fn().mockResolvedValue(0),
}));

function mockUser(user: any) {
    vi.mocked(User.findById).mockReturnValue({
        lean: vi.fn().mockResolvedValue(user),
    } as any);
}

describe('POST /api/work-sessions/apply-auto-schedule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        savedDocs.length = 0;
        findOne.mockReturnValue({
            lean: vi.fn().mockResolvedValue(null),
        });
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('replaces the day sessions with the user auto timetable (multiple intervals)', async () => {
        mockUser({
            autoTimetable: [
                { checkIn: '08:30', checkOut: '12:30' },
                { checkIn: '14:00', checkOut: '18:00' },
            ],
        });

        const req = mockReq({
            method: 'POST',
            body: { date: '2026-08-27' },
        });
        const res = mockRes();

        await applyAutoScheduleHandler(req, res);

        // On a fresh day there is nothing to supersede.
        expect(updateOne).not.toHaveBeenCalled();
        expect(savedDocs).toHaveLength(1);
        expect(savedDocs[0]).toMatchObject({
            userId: 'user-123',
            date: '2026-08-27',
            source: 'userAutomatic',
            version: 1,
            status: 'active',
            sessions: [
                {
                    type: 'check_in',
                    time: '08:30',
                    notes: 'Automatic timetable applied',
                    overtime: false,
                },
                { type: 'check_out', time: '12:30' },
                { type: 'check_in', time: '14:00' },
                { type: 'check_out', time: '18:00' },
            ],
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    workDaySessions: expect.objectContaining({
                        _id: 'day-1',
                    }),
                    totalHours: 8,
                    anomalies: [],
                }),
            })
        );
    });

    it('flags existing sessions as replaced instead of deleting them', async () => {
        mockUser({
            autoTimetable: [{ checkIn: '09:00', checkOut: '17:00' }],
        });
        // The day already has an active version 2 (original punches plus a
        // later correction); it must be superseded, never deleted.
        findOne.mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                _id: 's1',
                version: 2,
                status: 'active',
            }),
        });

        const req = mockReq({
            method: 'POST',
            body: { date: '2026-08-27' },
        });
        const res = mockRes();

        await applyAutoScheduleHandler(req, res);

        expect(updateOne).toHaveBeenCalledWith(
            { _id: 's1' },
            expect.objectContaining({
                $set: expect.objectContaining({
                    status: 'replaced',
                    replacedByVersion: 3,
                }),
            })
        );
        expect(savedDocs).toHaveLength(1);
        expect(savedDocs[0]).toMatchObject({
            version: 3,
            status: 'active',
            source: 'userAutomatic',
        });
        expect(savedDocs[0].sessions[0]).toMatchObject({
            type: 'check_in',
            time: '09:00',
            notes: 'Automatic timetable applied',
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('falls back to the default 09:00-17:00 timetable when the user has none', async () => {
        mockUser({});

        const req = mockReq({
            method: 'POST',
            body: { date: '2026-08-27' },
        });
        const res = mockRes();

        await applyAutoScheduleHandler(req, res);

        expect(savedDocs).toHaveLength(1);
        expect(savedDocs[0].sessions[0]).toMatchObject({
            type: 'check_in',
            time: '09:00',
        });
        expect(savedDocs[0].sessions[1]).toMatchObject({
            type: 'check_out',
            time: '17:00',
        });
    });

    it('returns 404 when the user does not exist', async () => {
        mockUser(null);

        const req = mockReq({ method: 'POST', body: { date: '2026-08-27' } });
        const res = mockRes();

        await applyAutoScheduleHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'EntryNotFound',
            details: { entry: 'User' },
        });
    });

    it('rejects future dates', async () => {
        mockUser({
            autoTimetable: [{ checkIn: '09:00', checkOut: '17:00' }],
        });

        const req = mockReq({
            method: 'POST',
            body: { date: '2099-01-01' },
        });
        const res = mockRes();

        await applyAutoScheduleHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IllegalAction',
            details: { illegalAction: 'FutureDate' },
        });
        expect(savedDocs).toHaveLength(0);
        expect(WorkDaySessions.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid stored timetable', async () => {
        mockUser({
            autoTimetable: [{ checkIn: '12:00', checkOut: '09:00' }],
        });

        const req = mockReq({
            method: 'POST',
            body: { date: '2026-08-27' },
        });
        const res = mockRes();

        await applyAutoScheduleHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IllegalAction',
            details: { illegalAction: 'InvalidTimetable' },
        });
        expect(savedDocs).toHaveLength(0);
    });
});