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

const leavesStore: any[] = [];

vi.mock('@/models', () => {
    const AuthorizedLeave: any = {
        find: vi.fn(() => ({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue(leavesStore),
            }),
        })),
        create: vi.fn((doc: any) => {
            const created = {
                _id: `leave-${leavesStore.length + 1}`,
                ...doc,
            };
            leavesStore.push(created);
            return created;
        }),
        updateOne: vi.fn().mockResolvedValue({}),
        deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
        findById: vi.fn((id: string) => ({
            lean: vi
                .fn()
                .mockResolvedValue(
                    leavesStore.find(
                        (l: any) => l._id === id
                    ) ?? null
                ),
        })),
    };
    const User: any = {
        findById: vi.fn().mockResolvedValue({ _id: 'u1', deleted: false }),
    };
    return { AuthorizedLeave, User, AuditEvent: { create: vi.fn() } };
});

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

import { AuthorizedLeave, User } from '@/models';
import { recomputeWorkDayRecordsForRange } from '@/lib/work-day-records';
import authorizedLeavesHandler from '@/pages/api/admin/authorized-leaves';
import authorizedLeaveIdHandler from '@/pages/api/admin/authorized-leaves/[leaveId]';

describe('admin authorized leaves', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        leavesStore.length = 0;
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('POST creates a leave interval and re-judges its days', async () => {
        const req = mockReq({
            method: 'POST',
            body: {
                userId: 'u1',
                startDate: '2025-06-09',
                endDate: '2025-06-10',
                notes: 'permís retribuït',
            },
        });
        const res = mockRes();

        await authorizedLeavesHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(AuthorizedLeave.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'u1',
                startDate: '2025-06-09',
                endDate: '2025-06-10',
                notes: 'permís retribuït',
                createdBy: 'admin-123',
            })
        );
        expect(recomputeWorkDayRecordsForRange).toHaveBeenCalledWith(
            'u1',
            '2025-06-09',
            '2025-06-10'
        );
    });

    it('schema rejects intervals ending before they start', async () => {
        const { AdminAuthorizedLeaveRequestSchema } =
            await import('shared/src/schemas/api');
        const result = AdminAuthorizedLeaveRequestSchema.safeParse({
            userId: 'u1',
            startDate: '2025-06-10',
            endDate: '2025-06-09',
        });
        expect(result.success).toBe(false);
    });

    it('GET lists leaves filtered by user', async () => {
        const req = mockReq({
            method: 'GET',
            query: { userId: 'u1' },
        });
        const res = mockRes();

        await authorizedLeavesHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
        expect(AuthorizedLeave.find).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'u1' })
        );
    });

    it('PUT updates the interval and re-judges old and new coverage', async () => {
        leavesStore.push({
            _id: 'l1',
            userId: 'u1',
            startDate: '2025-06-09',
            endDate: '2025-06-09',
            notes: '',
        });

        const req = mockReq({
            method: 'PUT',
            query: { leaveId: 'l1' },
            body: { endDate: '2025-06-11' },
        });
        const res = mockRes();

        await authorizedLeaveIdHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(AuthorizedLeave.updateOne).toHaveBeenCalledWith(
            { _id: 'l1' },
            expect.objectContaining({
                $set: expect.objectContaining({ endDate: '2025-06-11' }),
            })
        );
        expect(recomputeWorkDayRecordsForRange).toHaveBeenCalledWith(
            'u1',
            '2025-06-09',
            '2025-06-11'
        );
    });

    it('DELETE removes the leave and re-judges its days', async () => {
        leavesStore.push({
            _id: 'l1',
            userId: 'u1',
            startDate: '2025-06-09',
            endDate: '2025-06-09',
            notes: '',
        });

        const req = mockReq({
            method: 'DELETE',
            query: { leaveId: 'l1' },
        });
        const res = mockRes();

        await authorizedLeaveIdHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(AuthorizedLeave.deleteOne).toHaveBeenCalledWith({ _id: 'l1' });
        expect(recomputeWorkDayRecordsForRange).toHaveBeenCalledWith(
            'u1',
            '2025-06-09',
            '2025-06-09'
        );
    });

    it('returns 404 when the leave does not exist', async () => {
        const req = mockReq({
            method: 'DELETE',
            query: { leaveId: 'missing' },
        });
        const res = mockRes();

        await authorizedLeaveIdHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: false, error: 'EntryNotFound' })
        );
    });

    it('returns 404 when the user does not exist on POST', async () => {
        vi.mocked(User.findById).mockResolvedValue(null as any);
        const req = mockReq({
            method: 'POST',
            body: {
                userId: 'ghost',
                startDate: '2025-06-09',
                endDate: '2025-06-09',
            },
        });
        const res = mockRes();

        await authorizedLeavesHandler(req, res);

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
