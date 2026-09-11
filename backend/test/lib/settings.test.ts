import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppSettings } from '@/models';
import {
    getAppSettings,
    invalidateAppSettingsCache,
} from '@/lib/settings';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/models', () => ({
    AppSettings: {
        findOne: vi.fn(),
        create: vi.fn(),
    },
}));

describe('getAppSettings toleranceMinutes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invalidateAppSettingsCache();
    });

    it('prefers an explicitly saved toleranceMinutes value', async () => {
        vi.mocked(AppSettings.findOne).mockResolvedValue({
            toleranceMinutes: 45,
        } as any);

        const settings = await getAppSettings();

        expect(settings.toleranceMinutes).toBe(45);
    });

    it('uses the default minutes tolerance on a fresh document', async () => {
        vi.mocked(AppSettings.findOne).mockResolvedValue({} as any);

        const settings = await getAppSettings();

        expect(settings.toleranceMinutes).toBe(60);
    });
});
