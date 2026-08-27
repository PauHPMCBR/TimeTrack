import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../../utils/mocks';

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
    ElectiveVacation: {
        find: vi.fn(),
    },
    YearlyVacationDays: {
        findOne: vi.fn(),
    },
}));

import { ElectiveVacation, YearlyVacationDays } from '@/models';
import adminVacationsYearHandler from '@/pages/api/admin/vacations/[year]';

describe('GET /api/admin/vacations/[year]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({ method: 'POST', query: { year: '2024' } });
        const res = mockRes();

        await adminVacationsYearHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return 200 with vacations and yearly config on successful GET', async () => {
        const mockVacations = [
            {
                _id: 'vacation-1',
                userId: 'user-1',
                date: new Date('2024-06-15'),
                status: 'pending',
            },
        ];

        const mockYearlyVacation = {
            year: 2024,
            obligatoryDays: ['2024-01-01'],
            electiveDaysTotalCount: 22,
        };

        vi.mocked(ElectiveVacation.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue(mockVacations),
            }),
        } as any);

        vi.mocked(YearlyVacationDays.findOne).mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockYearlyVacation),
        } as any);

        const req = mockReq({ method: 'GET', query: { year: '2024' } });
        const res = mockRes();

        await adminVacationsYearHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                year: 2024,
                electives: mockVacations,
                yearlyVacationDays: mockYearlyVacation,
            },
        });
    });

    it('should return 500 on database error', async () => {
        vi.mocked(ElectiveVacation.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockRejectedValue(new Error('DB Error')),
            }),
        } as any);

        const req = mockReq({ method: 'GET', query: { year: '2024' } });
        const res = mockRes();

        await adminVacationsYearHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });
});
