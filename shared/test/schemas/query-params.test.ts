import { describe, it, expect } from 'vitest';
import {
  GroupIdParamSchema,
  UserIdParamSchema,
  DateParamSchema,
  YearMonthParamSchema,
  UserYearParamSchema,
} from '../../src/schemas/api';

describe('Query Parameter Schemas', () => {
  describe('GroupIdParamSchema', () => {
    it('should validate correct groupId', () => {
      const result = GroupIdParamSchema.safeParse({
        groupId: 'group123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty groupId', () => {
      const result = GroupIdParamSchema.safeParse({
        groupId: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UserIdParamSchema', () => {
    it('should validate correct userId', () => {
      const result = UserIdParamSchema.safeParse({
        userId: 'user123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty userId', () => {
      const result = UserIdParamSchema.safeParse({
        userId: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('DateParamSchema', () => {
    it('should validate correct date params', () => {
      const result = DateParamSchema.safeParse({
        userId: 'user123',
        date: '2024-01-15',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing userId', () => {
      const result = DateParamSchema.safeParse({
        date: '2024-01-15',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('YearMonthParamSchema', () => {
    it('should validate correct year and month as strings', () => {
      const result = YearMonthParamSchema.safeParse({
        userId: 'user123',
        year: '2024',
        month: '6',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(2024);
        expect(result.data.month).toBe(6);
      }
    });

    it('should reject invalid year', () => {
      const result = YearMonthParamSchema.safeParse({
        userId: 'user123',
        year: 'invalid',
        month: '6',
      });
      expect(result.success).toBe(false);
    });

    it('should reject month out of range', () => {
      const result = YearMonthParamSchema.safeParse({
        userId: 'user123',
        year: '2024',
        month: '13',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UserYearParamSchema', () => {
    it('should validate correct year as string', () => {
      const result = UserYearParamSchema.safeParse({
        userId: 'user123',
        year: '2024',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(2024);
      }
    });

    it('should reject invalid year', () => {
      const result = UserYearParamSchema.safeParse({
        userId: 'user123',
        year: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject year below 2000', () => {
      const result = UserYearParamSchema.safeParse({
        userId: 'user123',
        year: '1999',
      });
      expect(result.success).toBe(false);
    });
  });
});
