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
    getAppSettings: vi.fn(),
    invalidateAppSettingsCache: vi.fn(),
}));

vi.mock('@/models', () => ({
    AppSettings: {
        findOne: vi.fn(),
        findByIdAndUpdate: vi.fn(),
        create: vi.fn(),
    },
}));

import { AppSettings } from '@/models';
import { getAppSettings } from '@/lib/settings';
import settingsHandler from '@/pages/api/admin/settings';

describe('/api/admin/settings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not GET or PUT', async () => {
        const req = mockReq({ method: 'DELETE' });
        const res = mockRes();

        await settingsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return settings on GET', async () => {
        vi.mocked(getAppSettings).mockResolvedValue({
            defaultExpectedHours: 8,
            benevolenceHours: 1,
            endOfDayHour: 17,
            toleranceHours: 1,
            nonWorkingDays: [6, 0],
        });

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await settingsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                settings: {
                    defaultExpectedHours: 8,
                    benevolenceHours: 1,
                    endOfDayHour: 17,
                    toleranceHours: 1,
                    nonWorkingDays: [6, 0],
                },
            },
        });
    });

    it('should update existing settings on PUT', async () => {
        vi.mocked(AppSettings.findOne).mockResolvedValue({ _id: 'settings-1' });
        vi.mocked(getAppSettings).mockResolvedValue({
            defaultExpectedHours: 9,
            benevolenceHours: 2,
            endOfDayHour: 18,
            toleranceHours: 1,
            nonWorkingDays: [6, 0],
        });

        const req = mockReq({
            method: 'PUT',
            body: {
                defaultExpectedHours: 9,
                benevolenceHours: 2,
                endOfDayHour: 18,
            },
        });
        const res = mockRes();

        await settingsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(AppSettings.findByIdAndUpdate).toHaveBeenCalledWith(
            'settings-1',
            expect.objectContaining({
                defaultExpectedHours: 9,
                benevolenceHours: 2,
                endOfDayHour: 18,
            }),
            { new: true }
        );
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                settings: {
                    defaultExpectedHours: 9,
                    benevolenceHours: 2,
                    endOfDayHour: 18,
                    toleranceHours: 1,
                    nonWorkingDays: [6, 0],
                },
            },
        });
    });

    it('should create settings when none exist on PUT', async () => {
        vi.mocked(AppSettings.findOne).mockResolvedValue(null);
        vi.mocked(getAppSettings).mockResolvedValue({
            defaultExpectedHours: 8,
            benevolenceHours: 1,
            endOfDayHour: 17,
            toleranceHours: 1,
            nonWorkingDays: [6, 0],
        });

        const req = mockReq({
            method: 'PUT',
            body: { defaultExpectedHours: 8 },
        });
        const res = mockRes();

        await settingsHandler(req, res);

        expect(AppSettings.create).toHaveBeenCalledWith(
            expect.objectContaining({ defaultExpectedHours: 8 })
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 500 on GET database error', async () => {
        vi.mocked(getAppSettings).mockRejectedValue(new Error('DB Error'));

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await settingsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });
});
