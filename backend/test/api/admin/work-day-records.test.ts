import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
    requireRole: (
        _roles: string[],
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

vi.mock('@/lib/settings', () => ({
    DEFAULT_TIMEZONE: 'Europe/Madrid',
    getConfiguredTimezone: vi.fn().mockReturnValue('Europe/Madrid'),
    getAppSettings: vi.fn(),
}));

vi.mock('@/lib/date-key', () => ({
    dateKey: vi.fn().mockReturnValue('2025-06-09'),
}));

vi.mock('@/models', () => ({
    User: {
        findById: vi.fn().mockResolvedValue({ _id: 'u1', deleted: false }),
    },
    MonthlyApproval: {
        findOne: vi.fn().mockResolvedValue(null),
    },
    AuditEvent: { create: vi.fn() },
}));

vi.mock('@/lib/work-day-records', () => ({
    recomputeWorkDayRecords: vi.fn().mockResolvedValue(undefined),
    lastClosedDayKey: vi.fn().mockResolvedValue('2025-06-09'),
}));

import { User, MonthlyApproval } from '@/models';
import { recomputeWorkDayRecords, lastClosedDayKey } from '@/lib/work-day-records';
import { dateKey } from '@/lib/date-key';
import workDayRecordsHandler from '@/pages/api/admin/work-day-records';

describe('PUT /api/admin/work-day-records', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(MonthlyApproval.findOne).mockResolvedValue(null as any);
        vi.mocked(lastClosedDayKey).mockResolvedValue('2025-06-09' as any);
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('recomputes the record with the admin override', async () => {
        const req = mockReq({
            method: 'PUT',
            body: {
                userId: 'u1',
                date: '2025-06-09',
                classification: 'authorizedLeave',
                reason: 'Baixa mèdica',
            },
        });
        const res = mockRes();

        await workDayRecordsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(recomputeWorkDayRecords).toHaveBeenCalledWith(
            'u1',
            ['2025-06-09'],
            expect.objectContaining({
                actorId: 'admin-123',
                reason: 'Baixa mèdica',
                overrides: expect.objectContaining({
                    classification: 'authorizedLeave',
                }),
            })
        );
    });

    it('refuses future days (they are still in the planned view)', async () => {
        vi.mocked(dateKey).mockReturnValue('2025-06-01' as any);

        const req = mockReq({
            method: 'PUT',
            body: {
                userId: 'u1',
                date: '2025-06-09',
                classification: 'workday',
            },
        });
        const res = mockRes();

        await workDayRecordsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(recomputeWorkDayRecords).not.toHaveBeenCalled();
    });

    it('refuses to edit a day in an approved (locked) month', async () => {
        vi.mocked(MonthlyApproval.findOne).mockResolvedValue({
            status: 'approved',
        } as any);

        const req = mockReq({
            method: 'PUT',
            body: {
                userId: 'u1',
                date: '2025-06-09',
                classification: 'workday',
            },
        });
        const res = mockRes();

        await workDayRecordsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(recomputeWorkDayRecords).not.toHaveBeenCalled();
    });

    it('returns 404 when the user does not exist', async () => {
        vi.mocked(User.findById).mockResolvedValue(null as any);

        const req = mockReq({
            method: 'PUT',
            body: {
                userId: 'ghost',
                date: '2025-06-09',
                classification: 'workday',
            },
        });
        const res = mockRes();

        await workDayRecordsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'EntryNotFound',
                details: { entry: 'User' },
            })
        );
    });
});
