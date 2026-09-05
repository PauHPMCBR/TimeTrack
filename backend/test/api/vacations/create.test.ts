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

vi.mock('@/lib/settings', () => ({
    getAppSettings: vi.fn().mockResolvedValue({ nonWorkingDays: [6, 0] }),
    // Day bounds resolve through the company timezone; use the runner's own
    // timezone so the "local midnight" dates in the bodies align with keys.
    getConfiguredTimezone: vi
        .fn()
        .mockReturnValue(Intl.DateTimeFormat().resolvedOptions().timeZone),
}));

vi.mock('@/models', () => ({
    ElectiveVacation: {
        find: vi.fn(),
        findOne: vi.fn(),
        create: vi.fn(),
    },
    YearlyVacationDays: {
        findOne: vi.fn(),
        create: vi.fn(),
    },
}));

import { ElectiveVacation, YearlyVacationDays } from '@/models';
import vacationCreateHandler from '@/pages/api/vacations/create';

// 2024-06-12 is a Wednesday, 2024-06-13 a Thursday, 2024-06-14 a Friday.
const WED = '2024-06-12';
const THU = '2024-06-13';
const FRI = '2024-06-14';
const MON = '2024-06-17';

const mockUserConfig = (overrides: Record<string, unknown> = {}) => ({
    year: 2024,
    userId: 'user-123',
    obligatoryDays: [],
    electiveDaysTotalCount: 10,
    ...overrides,
});

describe('POST /api/vacations/create', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Overlap check: no overlapping interval by default.
        vi.mocked(ElectiveVacation.findOne).mockResolvedValue(null);
        // Balance query: no existing requests by default.
        vi.mocked(ElectiveVacation.find).mockResolvedValue([]);
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not POST', async () => {
        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await vacationCreateHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return 400 if the period crosses a year boundary', async () => {
        const req = mockReq({
            method: 'POST',
            body: { startDate: '2024-12-30', endDate: '2025-01-02' },
        });
        const res = mockRes();

        await vacationCreateHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IllegalAction',
            details: { illegalAction: 'VacationCrossYear' },
        });
    });

    it('should return 400 if an overlapping request exists', async () => {
        vi.mocked(YearlyVacationDays.findOne).mockResolvedValue(
            mockUserConfig()
        );
        vi.mocked(ElectiveVacation.findOne).mockResolvedValue({
            _id: 'existing-vacation',
        } as any);

        const req = mockReq({
            method: 'POST',
            body: { startDate: WED, endDate: THU },
        });
        const res = mockRes();

        await vacationCreateHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IllegalAction',
            details: { illegalAction: 'VacationOverlap' },
        });
    });

    it('should discount weekends when computing spent days', async () => {
        vi.mocked(YearlyVacationDays.findOne).mockResolvedValue(
            mockUserConfig()
        );
        vi.mocked(ElectiveVacation.create as any).mockResolvedValue({
            _id: 'vacation-123',
        });

        // Fri → Mon spans a weekend: 4 calendar days, 2 spent days.
        const req = mockReq({
            method: 'POST',
            body: { startDate: FRI, endDate: MON },
        });
        const res = mockRes();

        await vacationCreateHandler(req, res);

        expect(ElectiveVacation.create).toHaveBeenCalledWith(
            expect.objectContaining({ spentDays: 2 })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should not discount obligatory days when computing spent days', async () => {
        vi.mocked(YearlyVacationDays.findOne).mockResolvedValue(
            mockUserConfig({ obligatoryDays: [THU] })
        );
        vi.mocked(ElectiveVacation.create as any).mockResolvedValue({
            _id: 'vacation-123',
        });

        const req = mockReq({
            method: 'POST',
            body: { startDate: WED, endDate: THU },
        });
        const res = mockRes();

        await vacationCreateHandler(req, res);

        expect(ElectiveVacation.create).toHaveBeenCalledWith(
            expect.objectContaining({ spentDays: 1 })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 if the period costs no elective days', async () => {
        vi.mocked(YearlyVacationDays.findOne).mockResolvedValue(
            mockUserConfig()
        );

        // Sat → Sun: only non-working days.
        const req = mockReq({
            method: 'POST',
            body: { startDate: '2024-06-15', endDate: '2024-06-16' },
        });
        const res = mockRes();

        await vacationCreateHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IllegalAction',
            details: { illegalAction: 'VacationZeroDays' },
        });
    });

    it('should return 400 if the balance would be exceeded', async () => {
        vi.mocked(YearlyVacationDays.findOne).mockResolvedValue(
            mockUserConfig({ electiveDaysTotalCount: 0 })
        );

        const req = mockReq({
            method: 'POST',
            body: { startDate: WED, endDate: THU },
        });
        const res = mockRes();

        await vacationCreateHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IllegalAction',
            details: { illegalAction: 'AllVacationsUsed' },
        });
    });

    it('should account for the spent days of existing requests in the balance', async () => {
        vi.mocked(YearlyVacationDays.findOne).mockResolvedValue(
            mockUserConfig({ electiveDaysTotalCount: 3 })
        );
        vi.mocked(ElectiveVacation.find).mockResolvedValue([
            { spentDays: 2 },
        ] as any);

        const req = mockReq({
            method: 'POST',
            body: { startDate: WED, endDate: THU },
        });
        const res = mockRes();

        await vacationCreateHandler(req, res);

        // 2 used + 2 new > 3 total.
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IllegalAction',
            details: { illegalAction: 'AllVacationsUsed' },
        });
    });

    it('should return 201 with vacation on successful creation', async () => {
        vi.mocked(YearlyVacationDays.findOne).mockResolvedValue(
            mockUserConfig()
        );
        const mockVacation = {
            _id: 'vacation-123',
            userId: 'user-123',
            startDate: new Date(WED),
            endDate: new Date(THU),
            spentDays: 2,
            reason: 'Doctor appointment',
            status: 'pending',
        };
        vi.mocked(ElectiveVacation.create as any).mockResolvedValue(
            mockVacation
        );

        const req = mockReq({
            method: 'POST',
            body: { startDate: WED, endDate: THU, reason: 'Doctor appointment' },
        });
        const res = mockRes();

        await vacationCreateHandler(req, res);

        expect(ElectiveVacation.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-123',
                spentDays: 2,
                reason: 'Doctor appointment',
            })
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { vacation: mockVacation },
        });
    });

    it('should return 500 on database error', async () => {
        vi.mocked(YearlyVacationDays.findOne).mockRejectedValue(
            new Error('DB Error')
        );

        const req = mockReq({
            method: 'POST',
            body: { startDate: WED, endDate: THU },
        });
        const res = mockRes();

        await vacationCreateHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'PostError',
            details: {},
        });
    });

    it('should return 400 if no vacation config exists for the year', async () => {
        vi.mocked(YearlyVacationDays.findOne)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);

        const req = mockReq({
            method: 'POST',
            body: { startDate: WED, endDate: THU },
        });
        const res = mockRes();

        await vacationCreateHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IllegalAction',
            details: { illegalAction: 'NoVacationConfig' },
        });
    });

    it('should create user config from global config if user config does not exist', async () => {
        vi.mocked(YearlyVacationDays.findOne)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                year: 2024,
                userId: undefined,
                obligatoryDays: [],
                electiveDaysTotalCount: 22,
            } as any);

        vi.mocked(YearlyVacationDays.create as any).mockResolvedValue(
            mockUserConfig({ electiveDaysTotalCount: 22 })
        );
        vi.mocked(ElectiveVacation.create as any).mockResolvedValue({
            _id: 'vacation-123',
        });

        const req = mockReq({
            method: 'POST',
            body: { startDate: WED, endDate: THU },
        });
        const res = mockRes();

        await vacationCreateHandler(req, res);

        expect(YearlyVacationDays.create).toHaveBeenCalledWith({
            userId: 'user-123',
            year: 2024,
            obligatoryDays: [],
            electiveDaysTotalCount: 22,
        });
        expect(res.status).toHaveBeenCalledWith(201);
    });
});
