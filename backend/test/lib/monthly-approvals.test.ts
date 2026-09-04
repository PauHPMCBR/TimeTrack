import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/mail', () => ({
    sendAdminMonthlyReview: vi.fn().mockResolvedValue(undefined),
    sendMonthlyApprovalRequest: vi.fn().mockResolvedValue(undefined),
    sendMonthlyApprovalReminder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/settings', () => ({
    DEFAULT_TIMEZONE: 'Europe/Barcelona',
    getConfiguredTimezone: vi.fn().mockReturnValue('Europe/Barcelona'),
    getAppSettings: vi.fn().mockResolvedValue({
        defaultExpectedHours: 8,
        benevolenceHours: 1,
        toleranceHours: 1,
        endOfDayHour: 17,
        nonWorkingDays: [6, 0],
        monthlyApprovalReminderDays: 5,
    }),
    invalidateAppSettingsCache: vi.fn(),
}));

vi.mock('@/models', () => ({
    MonthlyApproval: {
        find: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
        }),
        findOne: vi.fn().mockResolvedValue(null),
        updateOne: vi.fn(),
    },
    User: {
        find: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
        }),
        findById: vi.fn(),
    },
    WorkSession: { find: vi.fn() },
    ElectiveVacation: { find: vi.fn() },
    YearlyVacationDays: { find: vi.fn() },
    AppSettings: { findOne: vi.fn(), updateOne: vi.fn() },
}));

import {
    sendAdminMonthlyReview,
    sendMonthlyApprovalReminder,
} from '@/lib/mail';
import {
    runMonthlyAdminReview,
    runMonthlyApprovalReminders,
    isMonthApproved,
    previousMonthOf,
    isPastMonth,
} from '@/lib/monthly-approvals';
import { AppSettings, User, MonthlyApproval } from '@/models';

describe('monthly approval jobs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('runMonthlyAdminReview', () => {
        it('mails the admins about the previous month and records the month key', async () => {
            vi.mocked(AppSettings.findOne).mockResolvedValue({
                lastMonthlyReviewReminder: '2026-06',
            } as any);
            vi.mocked(User.find).mockReturnValue({
                lean: vi.fn().mockResolvedValue([
                    { email: 'admin1@example.com' },
                    { email: 'admin2@example.com' },
                ]),
            } as any);
            // August 15th 2026 → reviews July 2026.
            const now = new Date(2026, 7, 15, 10, 0, 0);

            const count = await runMonthlyAdminReview(now);

            expect(count).toBe(2);
            expect(sendAdminMonthlyReview).toHaveBeenCalledTimes(2);
            expect(sendAdminMonthlyReview).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'admin1@example.com',
                    period: { year: 2026, month: 7 },
                    reviewUrl: expect.stringContaining(
                        '/admin/monthly-approvals?year=2026&month=7'
                    ),
                })
            );
            expect(AppSettings.updateOne).toHaveBeenCalledWith(
                {},
                expect.objectContaining({
                    $set: expect.objectContaining({
                        lastMonthlyReviewReminder: '2026-08',
                    }),
                }),
                { upsert: true }
            );
        });

        it('does nothing when the review mail was already sent this month', async () => {
            vi.mocked(AppSettings.findOne).mockResolvedValue({
                lastMonthlyReviewReminder: '2026-08',
            } as any);
            const now = new Date(2026, 7, 15, 10, 0, 0);

            const count = await runMonthlyAdminReview(now);

            expect(count).toBe(0);
            expect(sendAdminMonthlyReview).not.toHaveBeenCalled();
            expect(AppSettings.updateOne).not.toHaveBeenCalled();
        });
    });

    describe('runMonthlyApprovalReminders', () => {
        it('reminds workers with an overdue pending confirmation once', async () => {
            vi.mocked(MonthlyApproval.find).mockReturnValue({
                lean: vi.fn().mockResolvedValue([
                    {
                        _id: 'ma1',
                        userId: 'u1',
                        year: 2026,
                        month: 6,
                        status: 'pending',
                    },
                ]),
            } as any);
            vi.mocked(User.findById).mockResolvedValue({
                name: 'Anna',
                email: 'anna@example.com',
            } as any);
            const now = new Date(2026, 7, 15, 10, 0, 0);

            const sent = await runMonthlyApprovalReminders(now);

            expect(sent).toBe(1);
            // Cutoff = now - 5 days.
            expect(MonthlyApproval.find).toHaveBeenCalledWith({
                status: 'pending',
                reminderSentAt: null,
                requestedAt: {
                    $lte: new Date(
                        now.getTime() - 5 * 24 * 60 * 60 * 1000
                    ),
                },
            });
            expect(sendMonthlyApprovalReminder).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'anna@example.com',
                    name: 'Anna',
                    period: { year: 2026, month: 6 },
                })
            );
            expect(MonthlyApproval.updateOne).toHaveBeenCalledWith(
                { _id: 'ma1' },
                expect.objectContaining({
                    $set: expect.objectContaining({ reminderSentAt: expect.any(Date) }),
                })
            );
        });

        it('returns 0 when there is nothing overdue', async () => {
            vi.mocked(MonthlyApproval.find).mockReturnValue({
                lean: vi.fn().mockResolvedValue([]),
            } as any);

            const sent = await runMonthlyApprovalReminders(
                new Date(2026, 7, 15, 10, 0, 0)
            );

            expect(sent).toBe(0);
            expect(sendMonthlyApprovalReminder).not.toHaveBeenCalled();
        });
    });

    describe('isMonthApproved', () => {
        it('is true only when an approved document exists', async () => {
            vi.mocked(MonthlyApproval.findOne).mockResolvedValue({
                _id: 'ma1',
                status: 'approved',
            } as any);
            expect(await isMonthApproved('u1', 2025, 7)).toBe(true);
            // The lock only ever matches approved documents.
            expect(MonthlyApproval.findOne).toHaveBeenCalledWith({
                userId: 'u1',
                year: 2025,
                month: 7,
                status: 'approved',
            });

            vi.mocked(MonthlyApproval.findOne).mockResolvedValue(null as any);
            expect(await isMonthApproved('u1', 2025, 7)).toBe(false);
        });
    });

    describe('period helpers', () => {
        it('previousMonthOf crosses the year boundary', () => {
            expect(previousMonthOf(new Date(2026, 0, 15))).toEqual({
                year: 2025,
                month: 12,
            });
            expect(previousMonthOf(new Date(2026, 7, 15))).toEqual({
                year: 2026,
                month: 7,
            });
        });

        it('isPastMonth only accepts elapsed months', () => {
            const now = new Date(2026, 7, 15);
            expect(isPastMonth(2026, 7, now)).toBe(true);
            expect(isPastMonth(2026, 8, now)).toBe(false); // current month
            expect(isPastMonth(2026, 9, now)).toBe(false); // future
        });
    });
});
