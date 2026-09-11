import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes, createMockAppSettings } from '../../utils/mocks';

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
        const settings = createMockAppSettings({ endOfDayHour: 17 });
        vi.mocked(getAppSettings).mockResolvedValue(settings);

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await settingsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { settings },
        });
    });

    it('should update the inconsistency reminder mode on PUT', async () => {
        vi.mocked(AppSettings.findOne).mockResolvedValue({ _id: 'settings-1' });
        vi.mocked(getAppSettings).mockResolvedValue(
            createMockAppSettings({ inconsistencyReminderMode: 'disabled' })
        );

        const req = mockReq({
            method: 'PUT',
            body: { inconsistencyReminderMode: 'disabled' },
        });
        const res = mockRes();

        await settingsHandler(req, res);

        expect(AppSettings.findByIdAndUpdate).toHaveBeenCalledWith(
            'settings-1',
            expect.objectContaining({
                inconsistencyReminderMode: 'disabled',
            }),
            { new: true }
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update existing settings on PUT', async () => {
        vi.mocked(AppSettings.findOne).mockResolvedValue({ _id: 'settings-1' });
        vi.mocked(getAppSettings).mockResolvedValue(
            createMockAppSettings({
                defaultWeeklyExpectedHours: [0, 9, 9, 9, 9, 9, 0],
                endOfDayHour: 18,
            })
        );

        const req = mockReq({
            method: 'PUT',
            body: {
                defaultWeeklyExpectedHours: [0, 9, 9, 9, 9, 9, 0],
                endOfDayHour: 18,
            },
        });
        const res = mockRes();

        await settingsHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(AppSettings.findByIdAndUpdate).toHaveBeenCalledWith(
            'settings-1',
            expect.objectContaining({
                defaultWeeklyExpectedHours: [0, 9, 9, 9, 9, 9, 0],
                endOfDayHour: 18,
            }),
            { new: true }
        );
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                settings: createMockAppSettings({
                    defaultWeeklyExpectedHours: [0, 9, 9, 9, 9, 9, 0],
                    endOfDayHour: 18,
                }),
            },
        });
    });

    it('should create settings when none exist on PUT', async () => {
        vi.mocked(AppSettings.findOne).mockResolvedValue(null);
        vi.mocked(getAppSettings).mockResolvedValue(createMockAppSettings());

        const req = mockReq({
            method: 'PUT',
            body: { defaultWeeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0] },
        });
        const res = mockRes();

        await settingsHandler(req, res);

        expect(AppSettings.create).toHaveBeenCalledWith(
            expect.objectContaining({ defaultWeeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0] })
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
