import { z } from 'zod';
import { ElectiveVacationSchema, UserSchema, WorkSessionSchema, WorkSessionTypeSchema, YearlyVacationDaysSchema } from './database';

export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegisterRequestSchema = z.object({
  registrationToken: z.string().min(1, 'Registration token is required'),
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const CreateUserRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email format'),
  role: z.enum(['employee', 'admin']).default('employee'),
});
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

export const GroupIdParamSchema = z.object({
  groupId: z.string().min(1, 'Group id is required').max(100, 'Group id too long'),
});
export type GroupIdParam = z.infer<typeof GroupIdParamSchema>;

export const CreateGroupRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().optional(),
  members: z.array(z.string()),
});
export type CreateGroupRequest = z.infer<typeof CreateGroupRequestSchema>;

export const WorkSessionRequestSchema = z.object({
  type: WorkSessionTypeSchema,
  reason: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});
export type WorkSessionRequest = z.infer<typeof WorkSessionRequestSchema>;

export const ElectiveVacationRequestSchema = z.object({
  date: z.string().transform(str => new Date(str)), // Convert string to Date
  reason: z.string().max(1000).optional(),
});
export type ElectiveVacationRequest = z.infer<typeof ElectiveVacationRequestSchema>;

export const YearlyVacationAdminRequestSchema = z.object({
  year: z.number().int().gte(2000).lte(2100),
  obligatoryDays: z.array(z.string().transform(str => new Date(str))),
  electiveDaysTotalCount: z.number().gte(0),
});
export type YearlyVacationAdminRequest = z.infer<typeof YearlyVacationAdminRequestSchema>;

// Query Parameter Schemas
export const UserIdParamSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});
export type UserIdParam = z.infer<typeof UserIdParamSchema>;

export const DateParamSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  date: z.coerce.date(),
});
export type DateParam = z.infer<typeof DateParamSchema>;

export const YearMonthParamSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  year: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val) && val >= 2000 && val <= 2100, 'Invalid year'),
  month: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val) && val >= 1 && val <= 12, 'Invalid month'),
});
export type YearMonthParam = z.infer<typeof YearMonthParamSchema>;

export const UserYearParamSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  year: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val) && val >= 2000 && val <= 2100, 'Invalid year'),
});
export type UserYearParam = z.infer<typeof UserYearParamSchema>;

export const UserLoginResponseSchema = z.object({
  user: UserSchema,
  token: z.string(),
});
export type UserLoginResponse = z.infer<typeof UserLoginResponseSchema>;

export const YearlyVacationsResponseSchema = z.object({
  year: z.number().int().gte(2000).lte(2100),
  electives: z.array(ElectiveVacationSchema.extend({_id: z.string()})),
  yearlyVacationDays: YearlyVacationDaysSchema.extend({_id: z.string()}),
});
export type YearlyVacationResponse = z.infer<typeof YearlyVacationsResponseSchema>;

export const MonthlyWorkRecordResponseSchema = z.object({
  userId: z.string(),
  year: z.number().int().gte(2000).lte(2100),
  month: z.number().int().gte(1).lte(12),
  sessionsByDay: z.array(z.array(WorkSessionSchema.extend({_id: z.string()}))), // index is day of the month, position 0 is empty
  summary: z.object({
    totalSessions: z.number().int().gte(0),
    totalHoursWorked: z.number().gte(0),
    daysWithSessions: z.number().int().gte(0),
    dailyStats: z.array(z.object({ // index is day of the month, position 0 is empty
      hoursWorked: z.number().gte(0), 
      sessions: z.number().int().gte(0),
    })),
  }),
});
export type MonthlyWorkRecordResponse = z.infer<typeof MonthlyWorkRecordResponseSchema>;

