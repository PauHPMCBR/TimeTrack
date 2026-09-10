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
    WorkSession: {
        find: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({}),
        insertMany: vi.fn().mockResolvedValue([]),
    },
    MonthlyApproval: {
        findOne: vi.fn().mockResolvedValue(null),
    },
}));

import { WorkSession, MonthlyApproval } from '@/models';
import selfEditHandler from '@/pages/api/me/work-sessions';

const at = (h: number, m = 0, day = '2025-06-09') =>
    new Date(
        `${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
    );

// The self-edit endpoint only accepts past days; use a fixed past date.
const validBody = {
    date: '2025-06-09',
    reason: 'Forgot to check out',
    sessions: [
        { type: 'check_in', timestamp: at(9).toISOString() },
        { type: 'check_out', timestamp: at(17).toISOString() },
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
        vi.mocked(WorkSession.find).mockResolvedValue([] as any);

        const req = mockReq({ method: 'PUT', body: validBody });
        const res = mockRes();

        await selfEditHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(MonthlyApproval.findOne).toHaveBeenCalled();
        expect(WorkSession.insertMany).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    userId: 'user-123',
                    type: 'check_in',
                    source: 'userManual',
                    editedBy: 'user-123',
                    overtime: false,
                    editReason: 'Forgot to check out',
                    version: 1,
                    status: 'active',
                }),
                expect.objectContaining({
                    userId: 'user-123',
                    type: 'check_out',
                    source: 'userManual',
                    editedBy: 'user-123',
                }),
            ])
        );
    });

    it('should persist the overtime flag on the flagged sessions', async () => {
        vi.mocked(WorkSession.find).mockResolvedValue([] as any);

        const req = mockReq({
            method: 'PUT',
            body: {
                ...validBody,
                sessions: [
                    {
                        type: 'check_in',
                        timestamp: at(9).toISOString(),
                        overtime: true,
                    },
                    { type: 'check_out', timestamp: at(17).toISOString() },
                ],
            },
        });
        const res = mockRes();

        await selfEditHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(WorkSession.insertMany).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'check_in',
                    overtime: true,
                }),
                expect.objectContaining({
                    type: 'check_out',
                    overtime: false,
                }),
            ])
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
                        timestamp: `${dayKey}T09:00:00.000Z`,
                    },
                    {
                        type: 'check_out',
                        timestamp: `${dayKey}T17:00:00.000Z`,
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
        expect(WorkSession.insertMany).not.toHaveBeenCalled();
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
        expect(WorkSession.insertMany).not.toHaveBeenCalled();
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
                        timestamp: at(9).toISOString(),
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
        expect(WorkSession.insertMany).not.toHaveBeenCalled();
    });
});
