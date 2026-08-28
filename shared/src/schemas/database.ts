import { z } from 'zod';
import {
    DEFAULT_BENEVOLENCE_HOURS,
    DEFAULT_CHECK_IN_TIME,
    DEFAULT_CHECK_OUT_TIME,
    DEFAULT_END_OF_DAY_HOUR,
    DEFAULT_EXPECTED_WORK_HOURS,
    DEFAULT_NON_WORKING_DAYS,
} from '../lib/defaults';

// Automatic timetable: a list of check-in/check-out intervals (clock times
// "HH:MM"). A day can have more than one interval (e.g. split shifts). Every
// user has one from creation; DEFAULT_AUTO_TIMETABLE is applied on creation.
export const AutoScheduleEntrySchema = z.object({
    checkIn: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time, expected HH:MM'),
    checkOut: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time, expected HH:MM'),
});
export type AutoScheduleEntry = z.infer<typeof AutoScheduleEntrySchema>;

export const DEFAULT_AUTO_TIMETABLE: AutoScheduleEntry[] = [
    { checkIn: DEFAULT_CHECK_IN_TIME, checkOut: DEFAULT_CHECK_OUT_TIME },
];

export const UserRoleSchema = z.enum(['employee', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;
export const UserSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email format'),
    password: z
        .string()
        .min(6, 'Password must be at least 6 characters')
        .optional(),
    registrationToken: z.string(),
    registered: z.boolean().default(false),
    role: UserRoleSchema.default('employee'),
    groups: z.array(z.string()).default([]),
    dni: z.string().min(1, 'DNI is required').max(20),
    expectedWorkHours: z
        .number()
        .positive()
        .default(DEFAULT_EXPECTED_WORK_HOURS),
    workDays: z.array(z.number().int().min(0).max(6)).optional(),
    avatar: z.string().optional(),
    failedLoginAttempts: z.number().int().gte(0).default(0),
    blocked: z.boolean().default(false),
    blockedSince: z.date().optional(),
    // Password reset ("forgot password") token + expiry. Transient: they only
    // exist while a reset is pending, so they stay nullable.
    resetPasswordToken: z.string().optional(),
    resetPasswordExpires: z.date().optional(),
    // Automatic timetable: list of check-in/check-out intervals ("HH:MM").
    // Always present (default applied on user creation); used by the "set
    // automatic timetable" action and the end-of-day reminder email.
    autoTimetable: z
        .array(AutoScheduleEntrySchema)
        .default(DEFAULT_AUTO_TIMETABLE),
    // Date key (YYYY-MM-DD, local) of the last inconsistency-reminder email.
    // Empty string = never reminded yet. `.optional()` because zod-mongoose
    // compiles `z.string().default('')` to a `required: true` String path, and
    // Mongoose's required validator rejects empty strings — which would make
    // every `User.save()` fail. The default is still applied on creation.
    lastInconsistencyReminder: z.string().default('').optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

// Company-wide configuration. Stored as a single document (no _id filter).
export const AppSettingsSchema = z.object({
    defaultExpectedHours: z
        .number()
        .positive()
        .default(DEFAULT_EXPECTED_WORK_HOURS),
    benevolenceHours: z.number().gte(0).default(DEFAULT_BENEVOLENCE_HOURS),
    toleranceHours: z.number().gte(0).optional(),
    endOfDayHour: z.number().min(0).max(24).default(DEFAULT_END_OF_DAY_HOUR),
    nonWorkingDays: z
        .array(z.number().int().min(0).max(6))
        .default(DEFAULT_NON_WORKING_DAYS),
    // Send the end-of-day inconsistency-reminder email (on by default).
    inconsistencyReminderEnabled: z.boolean().default(true),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

export const GroupSchema = z.object({
    name: z.string().min(1, 'Group name is required'),
    description: z.string().max(500).optional(),
    members: z.array(z.string()).default([]),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

export const WorkSessionTypeSchema = z.enum(['check_in', 'check_out']);
export type WorkSessionType = z.infer<typeof WorkSessionTypeSchema>;
export const WorkSessionSourceSchema = z.enum(['user', 'admin', 'automatic']);
export const WorkSessionReasonSchema = z.object({
    type: WorkSessionTypeSchema,
    reasonId: z.string(),
    englishText: z.string(),
    spanishText: z.string(),
    catalanText: z.string(),
});
export const WorkSessionSchema = z.object({
    userId: z.string(),
    type: WorkSessionTypeSchema,
    timestamp: z.date().default(() => new Date()),
    source: WorkSessionSourceSchema.default('user'),
    notes: z.string().max(1000).optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

export const VacationStatusSchema = z.enum([
    'pending',
    'approved',
    'rejected',
    'cancelled',
]);
export const ElectiveVacationSchema = z.object({
    userId: z.string(),
    date: z.date(),
    status: VacationStatusSchema.default('pending'),
    reason: z.string().max(1000).optional(),
    approvedBy: z.string().optional(),
    approvedAt: z.date().optional(),
    notes: z.string().max(1000).optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

export const YearlyVacationDaysSchema = z.object({
    userId: z.string().optional(), // if userId is not set, it's the template for all users (and selectedElectiveDays should be empty)
    year: z.number(),
    obligatoryDays: z.array(z.date()),
    electiveDaysTotalCount: z.number().gte(0),
    selectedElectiveDays: z.array(z.date()),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});
