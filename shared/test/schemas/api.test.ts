import { describe, it, expect } from 'vitest';
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  CreateUserRequestSchema,
  WorkSessionRequestSchema,
  ElectiveVacationRequestSchema,
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
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing name', () => {
      const result = RegisterRequestSchema.safeParse({
        registrationToken: 'abc123',
        email: 'test@example.com',
        name: '',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CreateUserRequestSchema', () => {
    it('should validate correct create user request', () => {
      const result = CreateUserRequestSchema.safeParse({
        name: 'New User',
        email: 'new@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid role', () => {
      const result = CreateUserRequestSchema.safeParse({
        name: 'New User',
        email: 'new@example.com',
        role: 'admin',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid role', () => {
      const result = CreateUserRequestSchema.safeParse({
        name: 'New User',
        email: 'new@example.com',
        role: 'superadmin',
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

    it('should validate correct check_out with reason', () => {
      const result = WorkSessionRequestSchema.safeParse({
        type: 'check_out',
        reason: 'Doctor appointment',
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

  describe('ElectiveVacationRequestSchema', () => {
    it('should validate correct vacation request with string date', () => {
      const result = ElectiveVacationRequestSchema.safeParse({
        date: '2024-06-15',
        reason: 'Family event',
      });
      expect(result.success).toBe(true);
    });

    it('should accept vacation without reason', () => {
      const result = ElectiveVacationRequestSchema.safeParse({
        date: '2024-06-15',
      });
      expect(result.success).toBe(true);
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
});
