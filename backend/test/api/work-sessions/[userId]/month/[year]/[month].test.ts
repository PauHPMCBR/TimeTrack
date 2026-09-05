import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
    requireSelfOrAdmin: (
        handler: (req: unknown, res: unknown) => unknown
    ) => {
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
        () => (req: any, res: any, next: (err?: unknown) => void) =>
            next(),
}));

vi.mock('@/models', () => ({
    WorkSession: {
        find: vi.fn(),
    },
}));

import { WorkSession } from '@/models';
import workSessionMonthHandler from '@/pages/api/work-sessions/[userId]/month/[year]/[month]';

describe('GET /api/work-sessions/[userId]/month/[year]/[month]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({
            method: 'POST',
            query: { userId: 'user-456', year: '2024', month: '1' },
        });
        const res = mockRes();

        await workSessionMonthHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return 200 with monthly sessions on successful GET', async () => {
        const mockSessions = [
            {
                _id: 'session-1',
                type: 'check_in',
                timestamp: new Date('2024-01-15T08:00:00'),
            },
            {
                _id: 'session-2',
                type: 'check_out',
                timestamp: new Date('2024-01-15T17:00:00'),
            },
        ];

        vi.mocked(WorkSession.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue(mockSessions),
            }),
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { userId: 'user-456', year: '2024', month: '1' },
        });
        const res = mockRes();

        await workSessionMonthHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    userId: 'user-456',
                    year: 2024,
                    month: 1,
                    sessionsByDay: expect.any(Array),
                    summary: expect.objectContaining({
                        totalSessions: 1,
                        totalHoursWorked: expect.any(Number),
                        daysWithSessions: expect.any(Number),
                    }),
                }),
            })
        );
    });

    it('should count only completed sessions, not isolated check-ins/outs', async () => {
        const mockSessions = [
            {
                _id: 'session-1',
                type: 'check_in',
                timestamp: new Date('2024-01-15T08:00:00'),
            },
            {
                _id: 'session-2',
                type: 'check_in',
                timestamp: new Date('2024-01-16T09:00:00'),
            },
            {
                _id: 'session-3',
                type: 'check_out',
                timestamp: new Date('2024-01-16T17:00:00'),
            },
            {
                _id: 'session-4',
                type: 'check_out',
                timestamp: new Date('2024-01-17T17:00:00'),
            },
        ];

        vi.mocked(WorkSession.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue(mockSessions),
            }),
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { userId: 'user-456', year: '2024', month: '1' },
        });
        const res = mockRes();

        await workSessionMonthHandler(req, res);

        const data = res.json.mock.calls[0][0].data;
        // Jan 15: isolated check-in (forgot check-out) -> 0 completed sessions.
        // Jan 16: check-in + check-out -> 1 completed session.
        // Jan 17: isolated check-out (forgot check-in) -> 0 completed sessions.
        expect(data.summary.totalSessions).toBe(1);
        expect(data.summary.dailyStats[15].sessions).toBe(0);
        expect(data.summary.dailyStats[16].sessions).toBe(1);
        expect(data.summary.dailyStats[17].sessions).toBe(0);
        expect(data.summary.daysWithSessions).toBe(3);
    });

    it('should return 500 on database error', async () => {
        vi.mocked(WorkSession.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockRejectedValue(new Error('DB Error')),
            }),
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { userId: 'user-456', year: '2024', month: '1' },
        });
        const res = mockRes();

        await workSessionMonthHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });
});
