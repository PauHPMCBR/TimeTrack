import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
    requireRole: (
        roles: string[],
        handler: (req: unknown, res: unknown) => unknown
    ) => {
        return async (req: any, res: any) => {
            req.user = {
                userId: 'admin-123',
                email: 'admin@example.com',
                role: 'admin',
            };
            return handler(req, res);
        };
    },
    authenticateToken: (handler: (req: unknown, res: unknown) => unknown) => {
        return async (req: any, res: any) => {
            req.user = {
                userId: 'user-123',
                email: 'worker@example.com',
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

vi.mock('@/lib/settings', () => ({
    DEFAULT_TIMEZONE: 'Europe/Barcelona',
    getConfiguredTimezone: vi.fn().mockReturnValue('Europe/Barcelona'),
    getAppSettings: vi.fn().mockResolvedValue({
        defaultExpectedHours: 8,
        benevolenceHours: 1,
        toleranceHours: 1,
        endOfDayHour: 17,
        nonWorkingDays: [6, 0],
        monthlyApprovalReminderDays: 5,
    }),
    invalidateAppSettingsCache: vi.fn(),
}));

const { findOne } = vi.hoisted(() => ({
    findOne: vi.fn(),
}));

vi.mock('@/models', () => ({
    User: { find: vi.fn(), findById: vi.fn() },
    WorkSession: { find: vi.fn(), updateMany: vi.fn(), insertMany: vi.fn() },
    ElectiveVacation: { find: vi.fn() },
    YearlyVacationDays: { find: vi.fn() },
    MonthlyApproval: { findOne, deleteOne: vi.fn(), updateOne: vi.fn() },
    AppSettings: { findOne: vi.fn(), updateOne: vi.fn() },
}));

import { User, WorkSession, MonthlyApproval } from '@/models';
import adminWorkSessionsHandler from '@/pages/api/admin/work-sessions';
import applyAutoScheduleHandler from '@/pages/api/work-sessions/apply-auto-schedule';

const at = (h: number, m = 0, day = '2025-07-10') =>
    new Date(
        `${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
    );

describe('monthly approval hard lock', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: no approval documents anywhere.
        findOne.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('admin replace-day is refused while the month is approved', async () => {
        vi.mocked(User.findById).mockResolvedValue({ _id: 'u1' } as any);
        // July 2025 is approved for u1.
        findOne.mockResolvedValue({ _id: 'ma1', status: 'approved' });

        const req = mockReq({
            method: 'PUT',
            body: {
                userId: 'u1',
                date: '2025-07-10',
                sessions: [
                    { type: 'check_in', timestamp: at(9).toISOString() },
                    { type: 'check_out', timestamp: at(17).toISOString() },
                ],
            },
        });
        const res = mockRes();

        await adminWorkSessionsHandler(req, res);

        expect(MonthlyApproval.findOne).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'u1', year: 2025, month: 7 })
        );
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'IllegalAction',
                details: { illegalAction: 'MonthApprovedLocked' },
            })
        );
        // Nothing was written.
        expect(WorkSession.insertMany).not.toHaveBeenCalled();
        expect(WorkSession.updateMany).not.toHaveBeenCalled();
    });

    it('apply-auto-schedule is refused while the month is approved', async () => {
        vi.mocked(User.findById).mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                autoTimetable: [{ checkIn: '09:00', checkOut: '17:00' }],
            }),
        } as any);
        findOne.mockResolvedValue({ _id: 'ma1', status: 'approved' });

        const req = mockReq({
            method: 'POST',
            body: { date: '2025-07-10' },
        });
        const res = mockRes();

        await applyAutoScheduleHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'IllegalAction',
                details: { illegalAction: 'MonthApprovedLocked' },
            })
        );
        // The lock check happens before any day work: no sessions were read
        // or written.
        expect(vi.mocked(WorkSession.find)).not.toHaveBeenCalled();
    });
});
