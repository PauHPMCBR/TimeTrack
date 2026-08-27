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
  dni: z.string().min(1, 'DNI is required').max(20),
});
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

export const UpdateUserRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  email: z.string().email('Invalid email format').optional(),
  role: z.enum(['employee', 'admin']).optional(),
  dni: z.string().min(1, 'DNI is required').max(20),
  expectedWorkHours: z.number().positive().optional(),
  workDays: z.array(z.number().int().min(0).max(6)).optional(),
}).refine(data => Object.keys(data).length > 0, 'At least one field is required');
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;

export const CopyYearlyVacationRequestSchema = z.object({
  fromYear: z.number().int().gte(2000).lte(2100).optional(),
  toYear: z.number().int().gte(2000).lte(2100),
});
export type CopyYearlyVacationRequest = z.infer<typeof CopyYearlyVacationRequestSchema>;

export const AppSettingsRequestSchema = z.object({
  defaultExpectedHours: z.number().positive().optional(),
  benevolenceHours: z.number().gte(0).optional(),
  toleranceHours: z.number().gte(0).optional(),
  endOfDayHour: z.number().min(0).max(24).optional(),
  nonWorkingDays: z.array(z.number().int().min(0).max(6)).optional(),
}).refine(data => Object.keys(data).length > 0, 'At least one field is required');
export type AppSettingsRequest = z.infer<typeof AppSettingsRequestSchema>;

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

export const AvatarUploadRequestSchema = z.object({
  dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp|gif|avif|tiff|bmp|svg|svg\+xml);base64,/, 'Invalid avatar data url'),
});
export type AvatarUploadRequest = z.infer<typeof AvatarUploadRequestSchema>;

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

export const WorkSessionRangeQuerySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
});
export type WorkSessionRangeQuery = z.infer<typeof WorkSessionRangeQuerySchema>;

export const UserYearParamSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  year: z.string().transform(val => parseInt(val, 10)).refine(val => !isNaN(val) && val >= 2000 && val <= 2100, 'Invalid year'),
});
export type UserYearParam = z.infer<typeof UserYearParamSchema>;

export const AdminExportWorkSessionsQuerySchema = z.object({
  userIds: z.string().min(1, 'At least one user id is required'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
});
export type AdminExportWorkSessionsQuery = z.infer<typeof AdminExportWorkSessionsQuerySchema>;

export const WorkSessionAnomalySchema = z.enum([
  'forgot_check_out',
  'forgot_check_in',
  'hours_short',
  'hours_over',
]);
export type WorkSessionAnomaly = z.infer<typeof WorkSessionAnomalySchema>;

export const WorkSessionRowStatusSchema = z.enum(['vacation', 'ok', 'anomaly', 'nonWorkingDay']);
export type WorkSessionRowStatus = z.infer<typeof WorkSessionRowStatusSchema>;

export const AdminWorkSessionRowSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  date: z.string(), // YYYY-MM-DD (local)
  totalHours: z.number().gte(0),
  expectedHours: z.number().positive(),
  sessions: z.array(WorkSessionSchema.extend({ _id: z.string() })),
  status: WorkSessionRowStatusSchema,
  anomalies: z.array(WorkSessionAnomalySchema),
});
export type AdminWorkSessionRow = z.infer<typeof AdminWorkSessionRowSchema>;

function validateAdminWorkSessionsQuery(data: {
  period: string;
  date?: string;
  year?: number;
  month?: number;
}, ctx: z.RefinementCtx) {
  if ((data.period === 'day' || data.period === 'week') && !data.date) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date'], message: 'Date is required for day/week periods' });
  }
  if (data.period === 'month' && (data.year === undefined || data.month === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['year'], message: 'Year and month are required for month period' });
  }
  if (data.period === 'year' && data.year === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['year'], message: 'Year is required for year period' });
  }
}

export const AdminWorkSessionsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year']),
  date: z.string().optional(),
  year: z.coerce.number().int().gte(2000).lte(2100).optional(),
  month: z.coerce.number().int().gte(1).lte(12).optional(),
}).superRefine(validateAdminWorkSessionsQuery);
export type AdminWorkSessionsQuery = z.infer<typeof AdminWorkSessionsQuerySchema>;

export const AdminWorkSessionsQueryWithPaginationSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year']),
  date: z.string().optional(),
  year: z.coerce.number().int().gte(2000).lte(2100).optional(),
  month: z.coerce.number().int().gte(1).lte(12).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
}).superRefine(validateAdminWorkSessionsQuery);
export type AdminWorkSessionsQueryWithPagination = z.infer<typeof AdminWorkSessionsQueryWithPaginationSchema>;

export const AdminWorkSessionInputSchema = z.object({
  type: WorkSessionTypeSchema,
  timestamp: z.string().min(1, 'Timestamp is required'),
});
export type AdminWorkSessionInput = z.infer<typeof AdminWorkSessionInputSchema>;

export const AdminReplaceDayWorkSessionsRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  date: z.string().min(1, 'Date is required'),
  sessions: z.array(AdminWorkSessionInputSchema),
});
export type AdminReplaceDayWorkSessionsRequest = z.infer<typeof AdminReplaceDayWorkSessionsRequestSchema>;

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

