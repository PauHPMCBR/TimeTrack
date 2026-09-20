import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/settings', () => ({
    DEFAULT_TIMEZONE: 'Europe/Madrid',
    getConfiguredTimezone: vi.fn().mockReturnValue('Europe/Madrid'),
    getAppSettings: vi.fn().mockResolvedValue({
        defaultWeeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0],
        toleranceMinutes: 60,
        defaultScheduleMode: 'hours',
        defaultTimetable: [[], [{ checkIn: '09:00', checkOut: '17:00' }], [{ checkIn: '09:00', checkOut: '17:00' }], [{ checkIn: '09:00', checkOut: '17:00' }], [{ checkIn: '09:00', checkOut: '17:00' }], [{ checkIn: '09:00', checkOut: '17:00' }], []],
        timetableToleranceMinutes: 10,
        endOfDayHour: 20,
        inconsistencyReminderMode: 'forced',
        monthlyApprovalReminderDays: 5,
    }),
}));

vi.mock('@/lib/mail', () => ({
    sendInconsistencyReminder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/work-day-records', () => ({
    ensureWorkDayRecordsForDay: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/repositories/work-day-record-repository', () => ({
    findOneWorkDayRecord: vi.fn(),
}));

vi.mock('@/models', () => ({
    User: {
        find: vi.fn(),
        updateOne: vi.fn(),
    },
    WorkDaySessions: {
        find: vi.fn(),
    },
}));

vi.stubEnv('FRONTEND_URL', 'http://localhost:3000');

import { User, WorkDaySessions } from '@/models';
import { findOneWorkDayRecord } from '@/repositories/work-day-record-repository';
import { sendInconsistencyReminder } from '@/lib/mail';
import { getAppSettings } from '@/lib/settings';
import type { DateKey } from 'shared/src/lib/day-key';
import { runDailyInconsistencyReminder } from '@/lib/reminders';
import { createMockAppSettings } from '../utils/mocks';

const DATE = '2026-08-27';

const openCheckInUser = {
    _id: 'u1',
    email: 'u1@example.com',
    name: 'User One',
    lastInconsistencyReminder: undefined,
};

const coherentUser = {
    _id: 'u2',
    email: 'u2@example.com',
    name: 'User Two',
    lastInconsistencyReminder: undefined,
};

function mockRecords(
    byUser: Record<string, string[]>
) {
    vi.mocked(findOneWorkDayRecord).mockImplementation(
        (userId: string) =>
            ({
                lean: vi.fn().mockResolvedValue({
                    userId,
                    date: DATE,
                    anomalies: byUser[userId] ?? [],
                }),
            }) as any
    );
}

function mockUsers(users: any[]) {
    vi.mocked(User.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue(users),
    } as any);
}

function mockSessions(sessions: any[]) {
    vi.mocked(WorkDaySessions.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue(sessions),
    } as any);
}

describe('runDailyInconsistencyReminder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUsers([openCheckInUser, coherentUser]);
        mockSessions([
            {
                date: DATE,
                sessions: [{ time: '09:00', type: 'check_in' }],
            },
        ]);
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('emails only users whose record carries anomalies', async () => {
        mockRecords({
            u1: ['forgot_check_out', 'hours_over'],
            u2: [],
        });

        const summary = await runDailyInconsistencyReminder(DATE as DateKey);

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

    it('emails users who worked on a non-working day (cached code)', async () => {
        mockRecords({ u1: ['work_on_non_working_day'] });

        const summary = await runDailyInconsistencyReminder(DATE as DateKey);

        expect(sendInconsistencyReminder).toHaveBeenCalledTimes(1);
        expect(sendInconsistencyReminder).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'u1@example.com',
                anomalies: ['work_on_non_working_day'],
            })
        );
        expect(summary.sentEmails).toBe(1);
    });

    it('does not email a user already reminded that day', async () => {
        mockUsers([{ ...openCheckInUser, lastInconsistencyReminder: DATE }]);
        mockRecords({ u1: ['forgot_check_out'] });

        const summary = await runDailyInconsistencyReminder(DATE as DateKey);

        expect(sendInconsistencyReminder).not.toHaveBeenCalled();
        expect(summary.sentEmails).toBe(0);
    });

    it('does not email users whose record is clean', async () => {
        mockUsers([openCheckInUser]);
        mockRecords({ u1: [] });

        const summary = await runDailyInconsistencyReminder(DATE as DateKey);

        expect(sendInconsistencyReminder).not.toHaveBeenCalled();
        expect(summary.scannedUsers).toBe(1);
    });

    it('is a no-op when the company mode is disabled', async () => {
        vi.mocked(getAppSettings).mockResolvedValue(createMockAppSettings({
            defaultWeeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0],
            toleranceMinutes: 60,
            endOfDayHour: 20,
            inconsistencyReminderMode: 'disabled',
            monthlyApprovalReminderDays: 5,
        }));

        const summary = await runDailyInconsistencyReminder(DATE as DateKey);

        expect(sendInconsistencyReminder).not.toHaveBeenCalled();
        expect(summary).toMatchObject({
            date: DATE,
            sentEmails: 0,
            disabled: true,
        });
    });

    it('skips users who opted out in user_choice mode', async () => {
        vi.mocked(getAppSettings).mockResolvedValue(createMockAppSettings({
            defaultWeeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0],
            toleranceMinutes: 60,
            endOfDayHour: 20,
            inconsistencyReminderMode: 'user_choice',
            monthlyApprovalReminderDays: 5,
        }));
        mockUsers([{ ...openCheckInUser, notifyInconsistency: false }]);
        mockRecords({ u1: ['forgot_check_out'] });

        const summary = await runDailyInconsistencyReminder(DATE as DateKey);

        expect(sendInconsistencyReminder).not.toHaveBeenCalled();
        expect(summary.sentEmails).toBe(0);
    });

    it('emails opted-in users in user_choice mode', async () => {
        vi.mocked(getAppSettings).mockResolvedValue(createMockAppSettings({
            defaultWeeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0],
            toleranceMinutes: 60,
            endOfDayHour: 20,
            inconsistencyReminderMode: 'user_choice',
            monthlyApprovalReminderDays: 5,
        }));
        mockUsers([{ ...openCheckInUser, notifyInconsistency: true }]);
        mockRecords({ u1: ['forgot_check_out'] });

        const summary = await runDailyInconsistencyReminder(DATE as DateKey);

        expect(sendInconsistencyReminder).toHaveBeenCalledTimes(1);
        expect(summary.sentEmails).toBe(1);
    });

    it('emails everyone in forced mode regardless of preference', async () => {
        vi.mocked(getAppSettings).mockResolvedValue(createMockAppSettings({
            defaultWeeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0],
            toleranceMinutes: 60,
            endOfDayHour: 20,
            inconsistencyReminderMode: 'forced',
            monthlyApprovalReminderDays: 5,
        }));
        mockUsers([{ ...openCheckInUser, notifyInconsistency: false }]);
        mockRecords({ u1: ['forgot_check_out'] });

        const summary = await runDailyInconsistencyReminder(DATE as DateKey);

        expect(sendInconsistencyReminder).toHaveBeenCalledTimes(1);
        expect(summary.sentEmails).toBe(1);
    });
});
