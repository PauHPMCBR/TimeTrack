import { z } from 'zod';
import {
    DEFAULT_CHECK_IN_TIME,
    DEFAULT_CHECK_OUT_TIME,
    DEFAULT_END_OF_DAY_HOUR,
    DEFAULT_MONTHLY_APPROVAL_REMINDER_DAYS,
    DEFAULT_TIMETABLE_TOLERANCE_MINUTES,
    DEFAULT_TIMEZONE,
    DEFAULT_TOLERANCE_MINUTES,
    DEFAULT_WEEKLY_EXPECTED_HOURS,
} from '../lib/defaults';
import { isValidDayTimetable } from '../lib/timetable-validation';

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
export const WeekTimetableSchema = z
    .array(z.array(AutoScheduleEntrySchema))
    .length(7);
export type WeekTimetable = z.infer<typeof WeekTimetableSchema>;
export type ScheduleMode = 'hours' | 'timetable';
export const ScheduleModeSchema = z.enum(['hours', 'timetable']);

export const ValidWeekTimetableSchema = WeekTimetableSchema.refine(
    (week) => week.every(isValidDayTimetable),
    'Invalid timetable intervals'
);

const DEFAULT_TIMETABLE_ENTRY: AutoScheduleEntry[] = [
    { checkIn: DEFAULT_CHECK_IN_TIME, checkOut: DEFAULT_CHECK_OUT_TIME },
];

export const DEFAULT_TIMETABLE: WeekTimetable = [
    [],
    DEFAULT_TIMETABLE_ENTRY,
    DEFAULT_TIMETABLE_ENTRY,
    DEFAULT_TIMETABLE_ENTRY,
    DEFAULT_TIMETABLE_ENTRY,
    DEFAULT_TIMETABLE_ENTRY,
    [],
];

export function defaultTimetable(): WeekTimetable {
    return DEFAULT_TIMETABLE.map((day) => day.map((entry) => ({ ...entry })));
}

export const UserRoleSchema = z.enum(['employee', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;
export const InconsistencyReminderModeSchema = z.enum([
    'disabled',
    'user_choice',
    'forced',
]);
export type InconsistencyReminderMode = z.infer<
    typeof InconsistencyReminderModeSchema
>;
export const UserSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    // Decrypted views, hydrated by the backend read hooks; never persisted.
    email: z.string(),
    dni: z.string().min(1, 'DNI is required'),
    // AES-256-GCM ciphertext at rest (backend/src/lib/crypto.ts).
    emailEncrypted: z.string().default('').optional(),
    dniEncrypted: z.string().default('').optional(),
    // Deterministic HMAC lookups (find-by-email / uniqueness checks).
    emailHash: z.string().default('').optional(),
    dniHash: z.string().default('').optional(),
    password: z
        .string()
        .min(6, 'Password must be at least 6 characters')
        .optional(),
    registrationToken: z.string().default('').optional(),
    registered: z.boolean().default(false),
    role: UserRoleSchema.default('employee'),
    groups: z.array(z.string()).default([]),
    weeklyExpectedHours: z
        .array(z.number().min(0))
        .length(7)
        .default(DEFAULT_WEEKLY_EXPECTED_HOURS),
    scheduleMode: ScheduleModeSchema.default('hours'),
    timetable: WeekTimetableSchema.default(DEFAULT_TIMETABLE),
    avatar: z.string().optional(),
    failedLoginAttempts: z.number().int().gte(0).default(0),
    blocked: z.boolean().default(false),
    blockedSince: z.date().optional(),
    // Soft-delete: data stays in the DB, the user is just hidden and locked out.
    deleted: z.boolean().default(false),
    deletedAt: z.date().optional(),
    resetPasswordToken: z.string().optional(),
    resetPasswordExpires: z.date().optional(),
    autoTimetable: z
        .array(AutoScheduleEntrySchema)
        .default(DEFAULT_AUTO_TIMETABLE),
    notifyNewFile: z.boolean().default(true),
    // Employee preference for inconsistency-reminder emails, only effective
    // when the company mode is 'user_choice'.
    notifyInconsistency: z.boolean().default(true),
    // Date key (YYYY-MM-DD, local) of the last inconsistency-reminder email.
    // Empty string = never reminded yet.
    lastInconsistencyReminder: z.string().default('').optional(),
    checkInRequired: z.boolean().default(true),
    // When the user started time tracking (local date key "YYYY-MM-DD").
    trackingStartDate: z.date().default(() => new Date()),
    // When the worker acknowledged the privacy notice in-app (RGPD arts.
    // 13-14). Absent = not acknowledged yet.
    privacyNoticeAcknowledgedAt: z.date().optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

// Company-wide configuration. Stored as a single document (no _id filter).
export const AppSettingsSchema = z.object({
    defaultWeeklyExpectedHours: z
        .array(z.number().min(0))
        .length(7)
        .default(DEFAULT_WEEKLY_EXPECTED_HOURS),
    toleranceMinutes: z
        .number()
        .int()
        .gte(0)
        .default(DEFAULT_TOLERANCE_MINUTES),
    defaultScheduleMode: ScheduleModeSchema.default('hours'),
    defaultTimetable: WeekTimetableSchema.default(DEFAULT_TIMETABLE),
    timetableToleranceMinutes: z
        .number()
        .int()
        .gte(0)
        .default(DEFAULT_TIMETABLE_TOLERANCE_MINUTES),
    endOfDayHour: z.number().min(0).max(24).default(DEFAULT_END_OF_DAY_HOUR),
    inconsistencyReminderMode: InconsistencyReminderModeSchema.default(
        'forced'
    ),
    // Days to wait after an approval request before reminding the worker
    // (single reminder) about their pending monthly record confirmation.
    monthlyApprovalReminderDays: z
        .number()
        .int()
        .min(1)
        .max(60)
        .default(DEFAULT_MONTHLY_APPROVAL_REMINDER_DAYS),
    timezone: z
        .string()
        .min(1, 'Timezone is required')
        .default(DEFAULT_TIMEZONE),
    // Month key (YYYY-MM) of the last end-of-month "review the month's times"
    // mail sent to admins. Empty string = never sent.
    lastMonthlyReviewReminder: z.string().default('').optional(),
    // Privacy notice shown to workers (GDPR/art. 34.9). Empty = not
    // configured yet. The trailing .optional() matters: zod-mongoose maps
    // default('') to a required path, and Mongoose rejects '' as missing,
    // which breaks creation of the settings document (see
    // lastMonthlyReviewReminder for the same pattern).
    privacyNoticeText: z.string().max(5000).default('').optional(),
    // Acknowledgment that the company consulted worker representation before
    // establishing the time-registration system (art. 34.9 LT obligation).
    workerConsultationAcknowledged: z.boolean().default(false),
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
// How a (user, day) record was produced — one source per day, shared by all
// the day's sessions (later writes to the day override it wholesale).
export const SourceKindSchema = z.enum([
    // Live punch via the check-in/check-out button.
    'userClick',
    // Worker self-applied auto-timetable on a past day.
    'userAutomatic',
    // Worker self-edit of a past day in the day editor.
    'userManual',
    // Admin correction of a day.
    'adminManual',
]);
export type SourceKind = z.infer<typeof SourceKindSchema>;
// Day versioning: replacing a day's sessions never deletes the old ones — they
// are flagged as 'replaced' and kept for audit (registro de jornada requires a
// non-manipulable, traceable record; CT 101/2019).
export const WorkSessionStatusSchema = z.enum(['active', 'replaced']);
export type WorkSessionStatus = z.infer<typeof WorkSessionStatusSchema>;
// Per-(user, day) record. Days are derived from sessions, so this document
// only carries day-level metadata; `date` is the local "YYYY-MM-DD" key.
export const WorkDaySourceSchema = z.object({
    userId: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
    source: SourceKindSchema.default('userClick'),
});
export type WorkDaySource = z.infer<typeof WorkDaySourceSchema>;
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
    // Decrypted view of notesEncrypted, hydrated by the backend read hooks.
    notes: z.string().optional(),
    notesEncrypted: z.string().default('').optional(),
    // Why this version was produced by a manual day edit (admin correction or
    // worker self-edit). Decrypted view of editReasonEncrypted, hydrated by
    // the backend read hooks. Absent on punches and auto-timetable sessions.
    editReason: z.string().optional(),
    editReasonEncrypted: z.string().default('').optional(),
    overtime: z.boolean().default(false),
    // Version of the (user, day) sequence this document belongs to. Documents
    // created before versioning have no version field: treat them as v1.
    version: z.number().int().min(1).default(1),
    status: WorkSessionStatusSchema.default('active'),
    editedBy: z.string().default('').optional(),
    // Set on superseded documents: which version replaced them, and when.
    replacedByVersion: z.number().int().min(1).optional(),
    replacedAt: z.date().optional(),
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
    startDate: z.date(),
    endDate: z.date(),
    // Elective vacation days the request costs
    spentDays: z.number().int().gte(0).default(0),
    status: VacationStatusSchema.default('pending'),
    // Decrypted views (reasonEncrypted/notesEncrypted), never persisted.
    reason: z.string().optional(),
    reasonEncrypted: z.string().default('').optional(),
    approvedBy: z.string().optional(),
    approvedAt: z.date().optional(),
    notes: z.string().optional(),
    notesEncrypted: z.string().default('').optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

export const YearlyVacationDaysSchema = z.object({
    userId: z.string().optional(), // if userId is not set, it's the template for all users
    year: z.number(),
    obligatoryDays: z.array(z.date()),
    electiveDaysTotalCount: z.number().gte(0),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

// Monthly record confirmation (registro de jornada): a document per
// (user, year, month) exists only once the admin has opened that month for
// the worker's approval. 'approved' months are hard-locked: no writes to that
// user's work sessions in that month until the admin revokes the approval.
export const MonthlyApprovalStatusSchema = z.enum(['pending', 'approved']);
export type MonthlyApprovalStatus = z.infer<typeof MonthlyApprovalStatusSchema>;
export const MonthlyApprovalSchema = z.object({
    userId: z.string(),
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    status: MonthlyApprovalStatusSchema.default('pending'),
    // When the admin opened the month for approval.
    requestedAt: z.date().optional(),
    // Admin who opened the month for approval (empty string = legacy doc).
    openedBy: z.string().default(''),
    // When the worker confirmed the month in the app.
    approvedAt: z.date().optional(),
    // Set once the (single) X-days reminder has been sent.
    reminderSentAt: z.date().optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

export const MonthlyApprovalEventActionSchema = z.enum([
    'opened',
    'confirmed',
    'revoked',
]);
export type MonthlyApprovalEventAction = z.infer<
    typeof MonthlyApprovalEventActionSchema
>;
export const MonthlyApprovalEventSchema = z.object({
    userId: z.string(),
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    action: MonthlyApprovalEventActionSchema,
    // Actor: the admin for opened/revoked, the worker themself for confirmed.
    actorId: z.string(),
    timestamp: z.date().default(() => new Date()),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

// Append-only security/audit log (RGPD art. 32 accountability + LISOS
// defence): who did what, from where, when. Insert-only by design — no
// update/delete path may ever exist for these documents.
export const AuditActionSchema = z.enum([
    'login_success',
    'login_failed',
    'account_locked',
    'login_blocked',
    'export_work_sessions',
    'user_created',
    'user_updated',
    'user_deleted',
    'user_restored',
    'settings_updated',
    'file_downloaded',
    'file_updated',
    'file_deleted',
    'work_sessions_replaced',
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;
export const AuditEventSchema = z.object({
    // Actor: the authenticated user id, empty for unauthenticated events.
    actorId: z.string().default(''),
    action: AuditActionSchema,
    // What the action touched (e.g. 'user', 'settings', 'file', 'work_session_day').
    targetType: z.string().default('').optional(),
    targetId: z.string().default('').optional(),
    ip: z.string().default('').optional(),
    // JSON-encoded context (e.g. exported row count) — a string keeps the
    // schema storage-friendly; readers parse it on demand.
    metadata: z.string().default('').optional(),
    timestamp: z.date().default(() => new Date()),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});

export const UserFileSchema = z.object({
    userId: z.string(),
    filename: z.string().min(1),
    originalName: z.string().min(1).max(255),
    description: z.string().max(1000).default('').optional(),
    mimeType: z.string().min(1).default('application/octet-stream'),
    size: z.number().int().gte(0),
    uploadedBy: z.string(),
    uploadedAt: z.date().default(() => new Date()),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});
