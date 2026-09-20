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

    it('returns plain timetable entries when the stored value is Mongoose subdocuments', async () => {
        class Subdocument {
            $__ = { internal: true };
            _doc = { checkIn: '09:00', checkOut: '17:00' };
            get checkIn() {
                return '09:00';
            }
            get checkOut() {
                return '17:00';
            }
        }
        vi.mocked(AppSettings.findOne).mockResolvedValue({
            defaultTimetable: [[new Subdocument()]],
        } as any);

        const settings = await getAppSettings();

        expect(settings.defaultTimetable[0]).toEqual([
            { checkIn: '09:00', checkOut: '17:00' },
        ]);
    });
});
