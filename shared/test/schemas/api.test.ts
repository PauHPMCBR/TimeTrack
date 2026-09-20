import { describe, it, expect } from 'vitest';
import {
    AdminReplaceDayWorkSessionsRequestSchema,
    AppSettingsRequestSchema,
    CreateGroupRequestSchema,
    LoginRequestSchema,
    RegisterRequestSchema,
    CreateUserRequestSchema,
    UpdateProfileRequestSchema,
    WorkSessionRequestSchema,
    ElectiveVacationRequestSchema,
    WorkSessionRangeQuerySchema,
    YearlyVacationAdminRequestSchema,
} from '../../src/schemas/api';

describe('API Schemas', () => {
    describe('LoginRequestSchema', () => {
        it('should validate correct login request', () => {
            const result = LoginRequestSchema.safeParse({
                email: 'test@example.com',
                password: 'password123',
            });
            expect(result.success).toBe(true);
        });

        it('should reject invalid email format', () => {
            const result = LoginRequestSchema.safeParse({
                email: 'not-an-email',
                password: 'password123',
            });
            expect(result.success).toBe(false);
        });

        it('should reject missing password', () => {
            const result = LoginRequestSchema.safeParse({
                email: 'test@example.com',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('RegisterRequestSchema', () => {
        it('should validate correct register request', () => {
            const result = RegisterRequestSchema.safeParse({
                registrationToken: 'abc123',
                email: 'test@example.com',
                name: 'Test User',
                password: 'SecurePass123!',
            });
            expect(result.success).toBe(true);
        });

        it('should reject missing name', () => {
            const result = RegisterRequestSchema.safeParse({
                registrationToken: 'abc123',
                email: 'test@example.com',
                name: '',
                password: 'SecurePass123!',
            });
            expect(result.success).toBe(false);
        });

        it('should reject password shorter than 8 characters', () => {
            const result = RegisterRequestSchema.safeParse({
                registrationToken: 'abc123',
                email: 'test@example.com',
                name: 'Test User',
                password: 'short1!',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('CreateUserRequestSchema', () => {
        it('should validate correct create user request', () => {
            const result = CreateUserRequestSchema.safeParse({
                name: 'New User',
                email: 'new@example.com',
                dni: '12345678A',
            });
            expect(result.success).toBe(true);
        });

        it('should accept valid role', () => {
            const result = CreateUserRequestSchema.safeParse({
                name: 'New User',
                email: 'new@example.com',
                role: 'admin',
                dni: '12345678A',
            });
            expect(result.success).toBe(true);
        });

        it('should reject missing dni', () => {
            const result = CreateUserRequestSchema.safeParse({
                name: 'New User',
                email: 'new@example.com',
                role: 'admin',
            });
            expect(result.success).toBe(false);
        });

        it('should reject invalid role', () => {
            const result = CreateUserRequestSchema.safeParse({
                name: 'New User',
                email: 'new@example.com',
                role: 'superadmin',
                dni: '12345678A',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('WorkSessionRequestSchema', () => {
        it('should validate correct check_in request', () => {
            const result = WorkSessionRequestSchema.safeParse({
                type: 'check_in',
            });
            expect(result.success).toBe(true);
        });

        it('should validate correct check_out with notes', () => {
            const result = WorkSessionRequestSchema.safeParse({
                type: 'check_out',
                notes: 'Some notes',
            });
            expect(result.success).toBe(true);
        });

        it('should reject invalid type', () => {
            const result = WorkSessionRequestSchema.safeParse({
                type: 'check',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('WorkSessionRangeQuerySchema', () => {
        it('accepts real calendar dates and rejects impossible ones', () => {
            expect(
                WorkSessionRangeQuerySchema.safeParse({
                    userId: 'u1',
                    from: '2024-02-29',
                    to: '2024-06-30',
                }).success
            ).toBe(true);
            expect(
                WorkSessionRangeQuerySchema.safeParse({
                    userId: 'u1',
                    from: '2023-02-29',
                    to: '2024-06-30',
                }).success
            ).toBe(false);
            expect(
                WorkSessionRangeQuerySchema.safeParse({
                    userId: 'u1',
                    from: '2024-01-01',
                    to: 'nope',
                }).success
            ).toBe(false);
        });
    });

    describe('ElectiveVacationRequestSchema', () => {
        it('should validate correct vacation request with string dates', () => {
            const result = ElectiveVacationRequestSchema.safeParse({
                startDate: '2024-06-15',
                endDate: '2024-06-16',
                reason: 'Family event',
            });
            expect(result.success).toBe(true);
        });

        it('should accept vacation without reason', () => {
            const result = ElectiveVacationRequestSchema.safeParse({
                startDate: '2024-06-15',
                endDate: '2024-06-15',
            });
            expect(result.success).toBe(true);
        });

        it('should reject an impossible calendar date', () => {
            const result = ElectiveVacationRequestSchema.safeParse({
                startDate: '2024-02-30',
                endDate: '2024-02-30',
            });
            expect(result.success).toBe(false);
        });

        it('should reject an unparseable date', () => {
            const result = ElectiveVacationRequestSchema.safeParse({
                startDate: 'garbage',
                endDate: '2024-06-15',
            });
            expect(result.success).toBe(false);
        });

        it('should reject endDate before startDate', () => {
            const result = ElectiveVacationRequestSchema.safeParse({
                startDate: '2024-06-16',
                endDate: '2024-06-15',
            });
            expect(result.success).toBe(false);
        });

        it('should keep the day keys intact', () => {
            const result = ElectiveVacationRequestSchema.safeParse({
                startDate: '2024-06-15',
                endDate: '2024-06-16',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startDate).toBe('2024-06-15');
                expect(result.data.endDate).toBe('2024-06-16');
            }
        });

        it('should reject non-key date strings (instants shift days server-side)', () => {
            const result = ElectiveVacationRequestSchema.safeParse({
                startDate: '2024-06-15T10:30:00.000Z',
                endDate: '2024-06-16',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('YearlyVacationAdminRequestSchema', () => {
        it('should validate correct yearly vacation config', () => {
            const result = YearlyVacationAdminRequestSchema.safeParse({
                year: 2024,
                obligatoryDays: ['2024-01-01', '2024-12-25'],
                electiveDaysTotalCount: 22,
            });
            expect(result.success).toBe(true);
        });

        it('should reject year outside valid range', () => {
            const result = YearlyVacationAdminRequestSchema.safeParse({
                year: 1999,
                obligatoryDays: [],
                electiveDaysTotalCount: 22,
            });
            expect(result.success).toBe(false);
        });

        it('should reject negative elective days', () => {
            const result = YearlyVacationAdminRequestSchema.safeParse({
                year: 2024,
                obligatoryDays: [],
                electiveDaysTotalCount: -1,
            });
            expect(result.success).toBe(false);
        });
    });

    // Payloads below mirror the exact shapes the frontend builds, so a change
    // to the derived schemas that breaks the wire contract fails here.
    describe('frontend payload contracts', () => {
        it('accepts the punch payload built by the check-in page', () => {
            expect(
                WorkSessionRequestSchema.safeParse({
                    type: 'check_in',
                    notes: undefined,
                    overtime: true,
                }).success
            ).toBe(true);
            expect(
                WorkSessionRequestSchema.safeParse({
                    type: 'check_out',
                    notes: 'Remote',
                    overtime: false,
                }).success
            ).toBe(true);
        });

        it('accepts the day-editor payload (sessions without ids)', () => {
            const result = AdminReplaceDayWorkSessionsRequestSchema.safeParse({
                userId: 'u1',
                date: '2024-06-10',
                sessions: [
                    { type: 'check_in', time: '09:00', overtime: false },
                    {
                        type: 'check_out',
                        time: '17:00',
                        overtime: true,
                        notes: 'extra',
                    },
                ],
                reason: 'Correction',
            });
            expect(result.success).toBe(true);
        });

        it('rejects an out-of-order or malformed time in the day editor', () => {
            expect(
                AdminReplaceDayWorkSessionsRequestSchema.safeParse({
                    userId: 'u1',
                    date: '2024-06-10',
                    sessions: [{ type: 'check_in', time: '9:00' }],
                }).success
            ).toBe(false);
            expect(
                AdminReplaceDayWorkSessionsRequestSchema.safeParse({
                    userId: 'u1',
                    date: '2024-06-10',
                    sessions: [{ type: 'check_in', time: '25:00' }],
                }).success
            ).toBe(false);
        });

        it('accepts each profile-update payload the profile page sends', () => {
            expect(
                UpdateProfileRequestSchema.safeParse({ notifyNewFile: true })
                    .success
            ).toBe(true);
            expect(
                UpdateProfileRequestSchema.safeParse({
                    notifyInconsistency: false,
                }).success
            ).toBe(true);
            expect(
                UpdateProfileRequestSchema.safeParse({
                    autoTimetable: [{ checkIn: '09:00', checkOut: '17:00' }],
                }).success
            ).toBe(true);
            const password = UpdateProfileRequestSchema.safeParse({
                currentPassword: 'old-secret',
                password: 'new-secret',
            });
            expect(password.success).toBe(true);
            if (password.success) {
                expect(password.data.autoTimetable).toBeUndefined();
                expect(password.data.notifyNewFile).toBeUndefined();
            }
        });

        it('rejects a short password in the profile payload', () => {
            expect(
                UpdateProfileRequestSchema.safeParse({
                    currentPassword: 'old-secret',
                    password: 'short',
                }).success
            ).toBe(false);
        });

        it('accepts the settings payload sent by the admin settings page', () => {
            expect(
                AppSettingsRequestSchema.safeParse({
                    defaultWeeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0],
                    toleranceMinutes: 60,
                    defaultScheduleMode: 'hours',
                    defaultTimetable: [
                        [],
                        [{ checkIn: '09:00', checkOut: '17:00' }],
                        [{ checkIn: '09:00', checkOut: '17:00' }],
                        [{ checkIn: '09:00', checkOut: '17:00' }],
                        [{ checkIn: '09:00', checkOut: '17:00' }],
                        [{ checkIn: '09:00', checkOut: '17:00' }],
                        [],
                    ],
                    timetableToleranceMinutes: 10,
                    endOfDayHour: 20,
                    inconsistencyReminderMode: 'forced',
                    monthlyApprovalReminderDays: 5,
                    timezone: 'Europe/Madrid',
                    privacyNoticeText: 'Notice',
                    workerConsultationAcknowledged: true,
                }).success
            ).toBe(true);
        });

        it('rejects an empty settings patch and an invalid timetable', () => {
            expect(AppSettingsRequestSchema.safeParse({}).success).toBe(false);
            expect(
                AppSettingsRequestSchema.safeParse({
                    defaultTimetable: [
                        [{ checkIn: '17:00', checkOut: '09:00' }],
                    ],
                }).success
            ).toBe(false);
        });

        it('accepts the group payload and rejects one without members', () => {
            expect(
                CreateGroupRequestSchema.safeParse({
                    name: 'Team',
                    description: 'Ops',
                    members: ['u1', 'u2'],
                }).success
            ).toBe(true);
            expect(
                CreateGroupRequestSchema.safeParse({ name: 'Team' }).success
            ).toBe(false);
        });

        it('accepts the vacation payload built by the vacations page', () => {
            expect(
                ElectiveVacationRequestSchema.safeParse({
                    startDate: '2024-07-01',
                    endDate: '2024-07-05',
                    reason: undefined,
                }).success
            ).toBe(true);
        });
    });
});
