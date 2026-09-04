import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/settings', () => ({
    DEFAULT_TIMEZONE: 'Europe/Barcelona',
    getConfiguredTimezone: vi.fn().mockReturnValue('Europe/Barcelona'),
    getAppSettings: vi.fn().mockResolvedValue({
        defaultExpectedHours: 8,
        benevolenceHours: 1,
        endOfDayHour: 20,
        nonWorkingDays: [6, 0],
        inconsistencyReminderEnabled: true,
    }),
}));

vi.mock('@/lib/mail', () => ({
    sendInconsistencyReminder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models', () => ({
    User: {
        find: vi.fn(),
        updateOne: vi.fn(),
    },
    WorkSession: {
        find: vi.fn(),
    },
}));

vi.stubEnv('FRONTEND_URL', 'http://localhost:3000');

import { User, WorkSession } from '@/models';
import { sendInconsistencyReminder } from '@/lib/mail';
import { getAppSettings } from '@/lib/settings';
import { runDailyInconsistencyReminder } from '@/lib/reminders';

const DATE = '2026-08-27';

const openCheckInUser = {
    _id: 'u1',
    email: 'u1@example.com',
    name: 'User One',
    expectedWorkHours: 8,
    lastInconsistencyReminder: undefined,
};

const coherentUser = {
    _id: 'u2',
    email: 'u2@example.com',
    name: 'User Two',
    expectedWorkHours: 8,
    lastInconsistencyReminder: undefined,
};

function sessionsOf(type: 'open' | 'coherent') {
    if (type === 'open') {
        return [
            { type: 'check_in', timestamp: new Date(2026, 7, 27, 9, 0, 0) },
        ];
    }
    return [
        { type: 'check_in', timestamp: new Date(2026, 7, 27, 9, 0, 0) },
        { type: 'check_out', timestamp: new Date(2026, 7, 27, 17, 0, 0) },
    ];
}

function mockUsers(users: any[]) {
    vi.mocked(User.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue(users),
    } as any);
}

describe('runDailyInconsistencyReminder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUsers([openCheckInUser, coherentUser]);
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('emails only users whose day is inconsistent', async () => {
        let call = 0;
        vi.mocked(WorkSession.find).mockImplementation(() => {
            const sessions = sessionsOf(call === 0 ? 'open' : 'coherent');
            call += 1;
            return {
                sort: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue(sessions),
                }),
            } as any;
        });

        const summary = await runDailyInconsistencyReminder(DATE);

        expect(sendInconsistencyReminder).toHaveBeenCalledTimes(1);
        expect(sendInconsistencyReminder).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'u1@example.com',
                date: DATE,
                anomalies: ['forgot_check_out', 'hours_over'],
                times: [{ time: '09:00', type: 'check_in' }],
                autoTimetable: '09:00 – 17:00',
                applyAutoUrl: `http://localhost:3000/check-in?applyAuto=1&date=${DATE}`,
            })
        );
        expect(User.updateOne).toHaveBeenCalledWith(
            { _id: 'u1' },
            expect.objectContaining({
                lastInconsistencyReminder: DATE,
            })
        );
        expect(summary).toMatchObject({ date: DATE, sentEmails: 1 });
    });

    it('does not email a user already reminded that day', async () => {
        mockUsers([
            { ...openCheckInUser, lastInconsistencyReminder: DATE },
            coherentUser,
        ]);
        let call = 0;
        vi.mocked(WorkSession.find).mockImplementation(() => {
            const sessions = sessionsOf(call === 0 ? 'open' : 'coherent');
            call += 1;
            return {
                sort: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue(sessions),
                }),
            } as any;
        });

        const summary = await runDailyInconsistencyReminder(DATE);

        expect(sendInconsistencyReminder).not.toHaveBeenCalled();
        expect(summary.sentEmails).toBe(0);
    });

    it('does not email users with no sessions that day', async () => {
        mockUsers([openCheckInUser]);
        vi.mocked(WorkSession.find).mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([]),
            }),
        } as any);

        const summary = await runDailyInconsistencyReminder(DATE);

        expect(sendInconsistencyReminder).not.toHaveBeenCalled();
        expect(summary.scannedUsers).toBe(1);
    });

    it('is a no-op when the company toggle is off', async () => {
        vi.mocked(getAppSettings).mockResolvedValue({
            defaultExpectedHours: 8,
            benevolenceHours: 1,
            toleranceHours: 1,
            endOfDayHour: 20,
            nonWorkingDays: [6, 0],
            inconsistencyReminderEnabled: false,
            monthlyApprovalReminderDays: 5,
        });

        const summary = await runDailyInconsistencyReminder(DATE);

        expect(sendInconsistencyReminder).not.toHaveBeenCalled();
        expect(summary).toMatchObject({
            date: DATE,
            sentEmails: 0,
            disabled: true,
        });
    });
});