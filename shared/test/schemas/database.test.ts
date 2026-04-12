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
      });
      expect(result.success).toBe(true);
    });

    it('should accept default values', () => {
      const result = UserSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        registrationToken: 'token123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.registered).toBe(false);
        expect(result.data.role).toBe('employee');
        expect(result.data.groups).toEqual([]);
      }
    });

    it('should reject invalid role', () => {
      const result = UserSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        role: 'superuser',
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

    it('should accept optional reason and notes', () => {
      const result = WorkSessionSchema.safeParse({
        userId: 'user123',
        type: 'check_in',
        timestamp: new Date(),
        reason: 'Working remotely',
        notes: 'Feeling productive',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('VacationStatusSchema', () => {
    it('should accept all valid statuses', () => {
      expect(VacationStatusSchema.safeParse('pending').success).toBe(true);
      expect(VacationStatusSchema.safeParse('approved').success).toBe(true);
      expect(VacationStatusSchema.safeParse('rejected').success).toBe(true);
      expect(VacationStatusSchema.safeParse('cancelled').success).toBe(true);
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
