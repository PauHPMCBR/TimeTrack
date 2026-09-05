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

vi.mock('@/models', () => ({
    YearlyVacationDays: {
        distinct: vi.fn(),
    },
}));

import { YearlyVacationDays } from '@/models';
import vacationYearsHandler from '@/pages/api/vacations/years';

describe('GET /api/vacations/years', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({ method: 'POST' });
        const res = mockRes();

        await vacationYearsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return years with a global plan, most recent first', async () => {
        vi.mocked(YearlyVacationDays.distinct).mockResolvedValue([
            2024, 2026, 2025,
        ] as any);

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await vacationYearsHandler(req, res);

        expect(YearlyVacationDays.distinct).toHaveBeenCalledWith('year', {
            userId: { $exists: false },
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { years: [2026, 2025, 2024] },
        });
    });

    it('should return an empty list when no plan exists', async () => {
        vi.mocked(YearlyVacationDays.distinct).mockResolvedValue([] as any);

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await vacationYearsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { years: [] },
        });
    });

    it('should return 500 on database error', async () => {
        vi.mocked(YearlyVacationDays.distinct).mockRejectedValue(
            new Error('DB Error')
        );

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await vacationYearsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });
});
