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
    validateQueryParams:
        () => (req: any, res: any, next: (err?: unknown) => void) => next(),
    validateRequestBody:
        () => (req: any, res: any, next: (err?: unknown) => void) => next(),
}));

vi.mock('@/models', () => ({
    WorkDaySessions: {
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue([{ _id: 'day-1' }]),
        updateOne: vi.fn().mockResolvedValue({}),
    },
    MonthlyApproval: {
        findOne: vi.fn().mockResolvedValue(null),
    },
}));

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

import { WorkDaySessions, MonthlyApproval } from '@/models';
import selfEditHandler from '@/pages/api/me/work-sessions';

// The self-edit endpoint only accepts past days; use a fixed past date.
const validBody = {
    date: '2025-06-09',
    reason: 'Forgot to check out',
    sessions: [
        { type: 'check_in', time: '09:00' },
        { type: 'check_out', time: '17:00' },
    ],
};

describe('PUT /api/me/work-sessions (worker self-edit)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should replace the day with source manual, attributed to the worker', async () => {
        const req = mockReq({ method: 'PUT', body: validBody });
        const res = mockRes();

        await selfEditHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(MonthlyApproval.findOne).toHaveBeenCalled();
        expect(WorkDaySessions.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    userId: 'user-123',
                    date: '2025-06-09',
                    source: 'userManual',
                    version: 1,
                    status: 'active',
                    editedBy: 'user-123',
                    editReason: 'Forgot to check out',
                    sessions: [
                        expect.objectContaining({
                            type: 'check_in',
                            time: '09:00',
                            overtime: false,
                        }),
                        expect.objectContaining({
                            type: 'check_out',
                            time: '17:00',
                            overtime: false,
                        }),
                    ],
                }),
            ],
            undefined
        );
    });

    it('should persist the overtime flag on the flagged sessions', async () => {
        const req = mockReq({
            method: 'PUT',
            body: {
                ...validBody,
                sessions: [
                    {
                        type: 'check_in',
                        time: '09:00',
                        overtime: true,
                    },
                    { type: 'check_out', time: '17:00' },
                ],
            },
        });
        const res = mockRes();

        await selfEditHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(WorkDaySessions.create).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    sessions: [
                        expect.objectContaining({
                            type: 'check_in',
                            overtime: true,
                        }),
                        expect.objectContaining({
                            type: 'check_out',
                            overtime: false,
                        }),
                    ],
                }),
            ],
            undefined
        );
    });

    it('should refuse a future day', async () => {
        const future = new Date();
        future.setDate(future.getDate() + 7);
        const dayKey = future.toISOString().slice(0, 10);

        const req = mockReq({
            method: 'PUT',
            body: {
                ...validBody,
                date: dayKey,
                sessions: [
                    {
                        type: 'check_in',
                        time: '09:00',
                    },
                    {
                        type: 'check_out',
                        time: '17:00',
                    },
                ],
            },
        });
        const res = mockRes();

        await selfEditHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'IllegalAction',
                details: { illegalAction: 'FutureDate' },
            })
        );
        expect(WorkDaySessions.create).not.toHaveBeenCalled();
    });

    it('should refuse while the month is approved (hard lock)', async () => {
        vi.mocked(MonthlyApproval.findOne).mockResolvedValue({
            _id: 'ma1',
            userId: 'user-123',
            year: 2025,
            month: 6,
            status: 'approved',
        } as any);

        const req = mockReq({ method: 'PUT', body: validBody });
        const res = mockRes();

        await selfEditHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'IllegalAction',
                details: { illegalAction: 'MonthApprovedLocked' },
            })
        );
        expect(WorkDaySessions.create).not.toHaveBeenCalled();
    });

    it('should reject an incoherent sequence', async () => {
        vi.mocked(MonthlyApproval.findOne).mockResolvedValue(null as any);
        const req = mockReq({
            method: 'PUT',
            body: {
                ...validBody,
                sessions: [
                    {
                        type: 'check_out',
                        time: '09:00',
                    },
                ],
            },
        });
        const res = mockRes();

        await selfEditHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'IncorrectParameter',
            })
        );
        expect(WorkDaySessions.create).not.toHaveBeenCalled();
    });
});
