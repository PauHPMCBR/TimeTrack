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

vi.mock('@/lib/user-lock', () => ({
    withUserLock: async (_userId: string, fn: () => unknown) => fn(),
}));

const { savedDocs, deleteMany } = vi.hoisted(() => {
    const savedDocs: any[] = [];
    const deleteMany = vi.fn().mockResolvedValue({});
    return { savedDocs, deleteMany };
});

vi.mock('@/models', () => {
    const WorkSession = vi.fn(function (doc: any) {
        savedDocs.push(doc);
        return { ...doc, save: vi.fn().mockResolvedValue(doc) };
    });
    (WorkSession as any).deleteMany = deleteMany;
    return {
        User: { findById: vi.fn() },
        WorkSession,
    };
});

import { User, WorkSession } from '@/models';
import applyAutoScheduleHandler from '@/pages/api/work-sessions/apply-auto-schedule';

function mockUser(user: any) {
    vi.mocked(User.findById).mockReturnValue({
        lean: vi.fn().mockResolvedValue(user),
    } as any);
}

describe('POST /api/work-sessions/apply-auto-schedule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        savedDocs.length = 0;
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

        expect((WorkSession as any).deleteMany).toHaveBeenCalledTimes(1);
        expect(savedDocs).toHaveLength(4);
        expect(savedDocs[0]).toMatchObject({
            userId: 'user-123',
            type: 'check_in',
            source: 'automatic',
            timestamp: new Date(2026, 7, 27, 8, 30, 0),
        });
        expect(savedDocs[1]).toMatchObject({
            userId: 'user-123',
            type: 'check_out',
            source: 'automatic',
            timestamp: new Date(2026, 7, 27, 12, 30, 0),
        });
        expect(savedDocs[2]).toMatchObject({
            userId: 'user-123',
            type: 'check_in',
            source: 'automatic',
            timestamp: new Date(2026, 7, 27, 14, 0, 0),
        });
        expect(savedDocs[3]).toMatchObject({
            userId: 'user-123',
            type: 'check_out',
            source: 'automatic',
            timestamp: new Date(2026, 7, 27, 18, 0, 0),
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    totalHours: 8,
                    anomalies: [],
                }),
            })
        );
    });

    it('falls back to the default 09:00-17:00 timetable when the user has none', async () => {
        mockUser({});

        const req = mockReq({
            method: 'POST',
            body: { date: '2026-08-27' },
        });
        const res = mockRes();

        await applyAutoScheduleHandler(req, res);

        expect(savedDocs).toHaveLength(2);
        expect(savedDocs[0].timestamp).toEqual(
            new Date(2026, 7, 27, 9, 0, 0)
        );
        expect(savedDocs[1].timestamp).toEqual(
            new Date(2026, 7, 27, 17, 0, 0)
        );
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
});