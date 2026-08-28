import { describe, it, expect } from 'vitest';
import {
    UserSchema,
    GroupSchema,
    WorkSessionSchema,
    WorkSessionTypeSchema,
    ElectiveVacationSchema,
    VacationStatusSchema,
    YearlyVacationDaysSchema,
    UserRoleSchema,
    WorkSessionReasonSchema,
    AppSettingsSchema,
    MonthlyApprovalSchema,
} from '../../src/schemas/database';

describe('Database Schemas', () => {
    describe('UserSchema', () => {
        it('should validate correct user data', () => {
            const result = UserSchema.safeParse({
                name: 'John Doe',
                email: 'john@example.com',
                password: 'password123',
                registrationToken: 'token123',
                role: 'employee',
                groups: [],
                dni: '12345678A',
            });
            expect(result.success).toBe(true);
        });

        it('should accept default values', () => {
            const result = UserSchema.safeParse({
                name: 'John Doe',
                email: 'john@example.com',
                registrationToken: 'token123',
                dni: '12345678A',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.registered).toBe(false);
                expect(result.data.role).toBe('employee');
                expect(result.data.groups).toEqual([]);
                expect(result.data.expectedWorkHours).toBe(8);
            }
        });

        it('should accept dni and expectedWorkHours', () => {
            const result = UserSchema.safeParse({
                name: 'John Doe',
                email: 'john@example.com',
                registrationToken: 'token123',
                dni: '12345678A',
                expectedWorkHours: 7.5,
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.dni).toBe('12345678A');
                expect(result.data.expectedWorkHours).toBe(7.5);
            }
        });

        it('should accept workDays', () => {
            const result = UserSchema.safeParse({
                name: 'John Doe',
                email: 'john@example.com',
                registrationToken: 'token123',
                dni: '12345678A',
                workDays: [1, 2, 3, 4, 5],
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.workDays).toEqual([1, 2, 3, 4, 5]);
            }
        });

        it('should reject missing dni', () => {
            const result = UserSchema.safeParse({
                name: 'John Doe',
                email: 'john@example.com',
                registrationToken: 'token123',
            });
            expect(result.success).toBe(false);
        });

        it('should reject non-positive expectedWorkHours', () => {
            const result = UserSchema.safeParse({
                name: 'John Doe',
                email: 'john@example.com',
                registrationToken: 'token123',
                dni: '12345678A',
                expectedWorkHours: 0,
            });
            expect(result.success).toBe(false);
        });

        it('should reject invalid role', () => {
            const result = UserSchema.safeParse({
                name: 'John Doe',
                email: 'john@example.com',
                role: 'superuser',
                dni: '12345678A',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('AppSettingsSchema', () => {
        it('should validate correct settings', () => {
            const result = AppSettingsSchema.safeParse({
                defaultExpectedHours: 8,
                benevolenceHours: 1,
                endOfDayHour: 17,
            });
            expect(result.success).toBe(true);
        });

        it('should accept defaults', () => {
            const result = AppSettingsSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.defaultExpectedHours).toBe(8);
                expect(result.data.benevolenceHours).toBe(1);
                expect(result.data.endOfDayHour).toBe(20);
                expect(result.data.nonWorkingDays).toEqual([6, 0]);
            }
        });

        it('should accept nonWorkingDays and toleranceHours', () => {
            const result = AppSettingsSchema.safeParse({
                nonWorkingDays: [5, 6],
                toleranceHours: 2,
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.nonWorkingDays).toEqual([5, 6]);
                expect(result.data.toleranceHours).toBe(2);
            }
        });

        it('should reject an invalid nonWorkingDays value', () => {
            const result = AppSettingsSchema.safeParse({ nonWorkingDays: [7] });
            expect(result.success).toBe(false);
        });

        it('should reject negative benevolence', () => {
            const result = AppSettingsSchema.safeParse({
                benevolenceHours: -1,
            });
            expect(result.success).toBe(false);
        });
    });

    describe('GroupSchema', () => {
        it('should validate correct group data', () => {
            const result = GroupSchema.safeParse({
                name: 'Engineering Team',
                description: 'Backend developers',
                members: ['user1', 'user2'],
            });
            expect(result.success).toBe(true);
        });

        it('should accept optional description', () => {
            const result = GroupSchema.safeParse({
                name: 'Engineering Team',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('WorkSessionTypeSchema', () => {
        it('should accept check_in', () => {
            const result = WorkSessionTypeSchema.safeParse('check_in');
            expect(result.success).toBe(true);
        });

        it('should accept check_out', () => {
            const result = WorkSessionTypeSchema.safeParse('check_out');
            expect(result.success).toBe(true);
        });

        it('should reject invalid type', () => {
            const result = WorkSessionTypeSchema.safeParse('invalid');
            expect(result.success).toBe(false);
        });
    });

    describe('WorkSessionSchema', () => {
        it('should validate correct work session', () => {
            const result = WorkSessionSchema.safeParse({
                userId: 'user123',
                type: 'check_in',
                timestamp: new Date(),
            });
            expect(result.success).toBe(true);
        });

        it('should accept optional notes', () => {
            const result = WorkSessionSchema.safeParse({
                userId: 'user123',
                type: 'check_in',
                timestamp: new Date(),
                notes: 'Feeling productive',
            });
            expect(result.success).toBe(true);
        });

        it('should default source to user', () => {
            const result = WorkSessionSchema.safeParse({
                userId: 'user123',
                type: 'check_in',
                timestamp: new Date(),
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.source).toBe('user');
            }
        });

        it('should accept user, admin and automatic sources', () => {
            for (const source of ['user', 'admin', 'automatic']) {
                const result = WorkSessionSchema.safeParse({
                    userId: 'user123',
                    type: 'check_out',
                    timestamp: new Date(),
                    source,
                });
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.source).toBe(source);
                }
            }
        });

        it('should reject an invalid source', () => {
            const result = WorkSessionSchema.safeParse({
                userId: 'user123',
                type: 'check_in',
                timestamp: new Date(),
                source: 'system',
            });
            expect(result.success).toBe(false);
        });

        it('should default version to 1 and status to active', () => {
            const result = WorkSessionSchema.safeParse({
                userId: 'user123',
                type: 'check_in',
                timestamp: new Date(),
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.version).toBe(1);
                expect(result.data.status).toBe('active');
                expect(result.data.replacedByVersion).toBeUndefined();
                expect(result.data.replacedAt).toBeUndefined();
            }
        });

        it('should accept a replaced document with audit fields', () => {
            const result = WorkSessionSchema.safeParse({
                userId: 'user123',
                type: 'check_in',
                timestamp: new Date(),
                version: 3,
                status: 'replaced',
                replacedByVersion: 4,
                replacedAt: new Date(),
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.version).toBe(3);
                expect(result.data.status).toBe('replaced');
                expect(result.data.replacedByVersion).toBe(4);
            }
        });

        it('should reject an invalid status', () => {
            const result = WorkSessionSchema.safeParse({
                userId: 'user123',
                type: 'check_in',
                timestamp: new Date(),
                status: 'deleted',
            });
            expect(result.success).toBe(false);
        });

        it('should reject a version below 1', () => {
            const result = WorkSessionSchema.safeParse({
                userId: 'user123',
                type: 'check_in',
                timestamp: new Date(),
                version: 0,
            });
            expect(result.success).toBe(false);
        });
    });

    describe('MonthlyApprovalSchema', () => {
        it('should validate a pending approval', () => {
            const result = MonthlyApprovalSchema.safeParse({
                userId: 'user123',
                year: 2025,
                month: 7,
                requestedAt: new Date(),
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('pending');
                expect(result.data.approvedAt).toBeUndefined();
                expect(result.data.reminderSentAt).toBeUndefined();
            }
        });

        it('should accept an approved approval with audit fields', () => {
            const result = MonthlyApprovalSchema.safeParse({
                userId: 'user123',
                year: 2025,
                month: 7,
                status: 'approved',
                requestedAt: new Date(),
                approvedAt: new Date(),
                reminderSentAt: new Date(),
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('approved');
            }
        });

        it('should reject months outside 1-12', () => {
            const result = MonthlyApprovalSchema.safeParse({
                userId: 'user123',
                year: 2025,
                month: 13,
            });
            expect(result.success).toBe(false);
        });

        it('should reject an invalid status', () => {
            const result = MonthlyApprovalSchema.safeParse({
                userId: 'user123',
                year: 2025,
                month: 7,
                status: 'rejected',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('VacationStatusSchema', () => {
        it('should accept all valid statuses', () => {
            expect(VacationStatusSchema.safeParse('pending').success).toBe(
                true
            );
            expect(VacationStatusSchema.safeParse('approved').success).toBe(
                true
            );
            expect(VacationStatusSchema.safeParse('rejected').success).toBe(
                true
            );
            expect(VacationStatusSchema.safeParse('cancelled').success).toBe(
                true
            );
        });

        it('should reject invalid status', () => {
            const result = VacationStatusSchema.safeParse('invalid');
            expect(result.success).toBe(false);
        });
    });

    describe('ElectiveVacationSchema', () => {
        it('should validate correct vacation', () => {
            const result = ElectiveVacationSchema.safeParse({
                userId: 'user123',
                date: new Date('2024-06-15'),
                status: 'pending',
            });
            expect(result.success).toBe(true);
        });

        it('should default status to pending', () => {
            const result = ElectiveVacationSchema.safeParse({
                userId: 'user123',
                date: new Date('2024-06-15'),
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('pending');
            }
        });
    });

    describe('YearlyVacationDaysSchema', () => {
        it('should validate correct yearly vacation', () => {
            const result = YearlyVacationDaysSchema.safeParse({
                year: 2024,
                obligatoryDays: [new Date('2024-01-01')],
                electiveDaysTotalCount: 22,
                selectedElectiveDays: [new Date('2024-06-15')],
            });
            expect(result.success).toBe(true);
        });

        it('should accept optional userId for global template', () => {
            const result = YearlyVacationDaysSchema.safeParse({
                userId: undefined,
                year: 2024,
                obligatoryDays: [],
                electiveDaysTotalCount: 22,
                selectedElectiveDays: [],
            });
            expect(result.success).toBe(true);
        });
    });

    describe('WorkSessionReasonSchema', () => {
        it('should validate correct work session reason', () => {
            const result = WorkSessionReasonSchema.safeParse({
                type: 'check_in',
                reasonId: 'reason-1',
                englishText: 'Working from home',
                spanishText: 'Trabajo desde casa',
                catalanText: 'Treballo des de casa',
            });
            expect(result.success).toBe(true);
        });
    });
});
