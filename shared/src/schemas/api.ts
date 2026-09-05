import { z } from 'zod';
import {
    AutoScheduleEntrySchema,
    ElectiveVacationSchema,
    MonthlyApprovalSchema,
    UserRoleSchema,
    UserSchema,
    WorkSessionSchema,
    WorkSessionTypeSchema,
    YearlyVacationDaysSchema,
} from './database';
import {
    ADMIN_REPORT_PERIODS,
    DATE_KEY_REGEX,
    EMPLOYEE_ROLE,
    MAX_VALID_YEAR,
    MIN_VALID_YEAR,
} from '../lib/constants';

export const LoginRequestSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
    // When true the session cookie persists (30d); otherwise it is a session
    // cookie cleared when the browser closes.
    remember: z.boolean().optional(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegisterRequestSchema = z.object({
    registrationToken: z.string().min(1, 'Registration token is required'),
    email: z.string().email('Invalid email format'),
    name: z.string().min(1, 'Name is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const ForgotPasswordRequestSchema = z.object({
    email: z.string().email('Invalid email format'),
});
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
    token: z.string().min(1, 'Reset token is required'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const CreateUserRequestSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    email: z.string().email('Invalid email format'),
    role: UserRoleSchema.default(EMPLOYEE_ROLE),
    dni: z.string().min(1, 'DNI is required').max(20),
});
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

export const UpdateUserRequestSchema = z
    .object({
        name: z
            .string()
            .min(1, 'Name is required')
            .max(100, 'Name too long')
            .optional(),
        email: z.string().email('Invalid email format').optional(),
        role: UserRoleSchema.optional(),
        dni: z.string().max(20).optional(),
        expectedWorkHours: z.number().positive().optional(),
        workDays: z.array(z.number().int().min(0).max(6)).optional(),
        // The day the user started time tracking (local "YYYY-MM-DD").
        trackingStartDate: z
            .string()
            .regex(DATE_KEY_REGEX, 'trackingStartDate must be YYYY-MM-DD')
            .optional(),
        // Forces forgot-password recovery; admins can never set a known password.
        invalidatePassword: z.boolean().optional(),
        // When true the user must check in/out daily; when false the system
        // does not flag missing sessions as anomalies.
        checkInRequired: z.boolean().optional(),
    })
    .refine(
        (data) => Object.keys(data).length > 0,
        'At least one field is required'
    );
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;

export const CopyYearlyVacationRequestSchema = z.object({
    fromYear: z.number().int().gte(MIN_VALID_YEAR).lte(MAX_VALID_YEAR).optional(),
    toYear: z.number().int().gte(MIN_VALID_YEAR).lte(MAX_VALID_YEAR),
});
export type CopyYearlyVacationRequest = z.infer<
    typeof CopyYearlyVacationRequestSchema
>;

export const AppSettingsRequestSchema = z
    .object({
        defaultExpectedHours: z.number().positive().optional(),
        benevolenceHours: z.number().gte(0).optional(),
        toleranceHours: z.number().gte(0).optional(),
        endOfDayHour: z.number().min(0).max(24).optional(),
        nonWorkingDays: z.array(z.number().int().min(0).max(6)).optional(),
        inconsistencyReminderEnabled: z.boolean().optional(),
        monthlyApprovalReminderDays: z.number().int().min(1).max(60).optional(),
        timezone: z.string().min(1, 'Timezone is required').optional(),
        privacyNoticeText: z.string().max(5000).optional(),
        workerConsultationAcknowledged: z.boolean().optional(),
    })
    .refine(
        (data) => Object.keys(data).length > 0,
        'At least one field is required'
    );
export type AppSettingsRequest = z.infer<typeof AppSettingsRequestSchema>;

export const GroupIdParamSchema = z.object({
    groupId: z
        .string()
        .min(1, 'Group id is required')
        .max(100, 'Group id too long'),
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
    notes: z.string().max(1000).optional(),
});
export type WorkSessionRequest = z.infer<typeof WorkSessionRequestSchema>;

export const ApplyAutoScheduleRequestSchema = z.object({
    date: z
        .string()
        .regex(DATE_KEY_REGEX, 'date must be YYYY-MM-DD')
        .optional(),
});
export type ApplyAutoScheduleRequest = z.infer<
    typeof ApplyAutoScheduleRequestSchema
>;

export const UpdateProfileRequestSchema = z.object({
    autoTimetable: z.array(AutoScheduleEntrySchema).optional(),
    // Self-service password change: both must be provided together.
    currentPassword: z.string().optional(),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const AvatarUploadRequestSchema = z.object({
    dataUrl: z
        .string()
        .regex(
            /^data:image\/(jpeg|png|webp|gif|avif|tiff|bmp);base64,/,
            'Invalid avatar data url'
        ),
});
export type AvatarUploadRequest = z.infer<typeof AvatarUploadRequestSchema>;

export const ElectiveVacationRequestSchema = z
    .object({
        // Plain "YYYY-MM-DD" keys: the client's calendar day travels intact
        // and the backend anchors it to local midnight (storage convention).
        // Instants must not be sent — re-normalizing them server-side shifts
        // the day when client and server timezones differ.
        startDate: z
            .string()
            .refine(isValidDateKey, 'Invalid date')
            .transform(dateKeyToLocalMidnight),
        endDate: z
            .string()
            .refine(isValidDateKey, 'Invalid date')
            .transform(dateKeyToLocalMidnight),
        reason: z.string().max(1000).optional(),
    })
    .refine((data) => data.endDate.getTime() >= data.startDate.getTime(), {
        message: 'endDate must be on or after startDate',
    });
export type ElectiveVacationRequest = z.input<
    typeof ElectiveVacationRequestSchema
>;

// True for a real calendar "YYYY-MM-DD" key (rejects e.g. 2024-02-30).
export function isValidDateKey(value: string): boolean {
    if (!DATE_KEY_REGEX.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d, 0, 0, 0, 0);
    return (
        date.getFullYear() === y &&
        date.getMonth() === m - 1 &&
        date.getDate() === d
    );
}

// Parses a "YYYY-MM-DD" key into the instant at local midnight of that
// calendar day — the app's storage convention for vacation dates. Note this
// uses the *server's* timezone; only ever apply it to timezone-free keys,
// never to instants sent by a client (which would shift the day).
export function dateKeyToLocalMidnight(value: string): Date {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export const YearlyVacationAdminRequestSchema = z.object({
    year: z.number().int().gte(MIN_VALID_YEAR).lte(MAX_VALID_YEAR),
    obligatoryDays: z.array(
        z
            .string()
            .refine(isValidDateKey, 'Invalid date')
            .transform(dateKeyToLocalMidnight)
    ),
    electiveDaysTotalCount: z.number().gte(0),
});
export type YearlyVacationAdminRequest = z.input<
    typeof YearlyVacationAdminRequestSchema
>;

export const UserIdParamSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
});
export type UserIdParam = z.infer<typeof UserIdParamSchema>;

export const DateParamSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    date: z.string().regex(DATE_KEY_REGEX, 'date must be YYYY-MM-DD'),
});
export type DateParam = z.infer<typeof DateParamSchema>;

export const YearMonthParamSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    year: z
        .string()
        .transform((val) => parseInt(val, 10))
        .refine(
            (val) => !isNaN(val) && val >= MIN_VALID_YEAR && val <= MAX_VALID_YEAR,
            'Invalid year'
        ),
    month: z
        .string()
        .transform((val) => parseInt(val, 10))
        .refine((val) => !isNaN(val) && val >= 1 && val <= 12, 'Invalid month'),
});
export type YearMonthParam = z.infer<typeof YearMonthParamSchema>;

export const WorkSessionRangeQuerySchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    from: z.string().regex(DATE_KEY_REGEX, 'from must be YYYY-MM-DD'),
    to: z.string().regex(DATE_KEY_REGEX, 'to must be YYYY-MM-DD'),
});
export type WorkSessionRangeQuery = z.infer<typeof WorkSessionRangeQuerySchema>;

export const UserYearParamSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    year: z
        .string()
        .transform((val) => parseInt(val, 10))
        .refine(
            (val) => !isNaN(val) && val >= MIN_VALID_YEAR && val <= MAX_VALID_YEAR,
            'Invalid year'
        ),
});
export type UserYearParam = z.infer<typeof UserYearParamSchema>;

export const AdminExportWorkSessionsQuerySchema = z.object({
    userIds: z.string().min(1, 'At least one user id is required'),
    from: z
        .string()
        .regex(DATE_KEY_REGEX, 'from must be YYYY-MM-DD')
        .optional(),
    to: z
        .string()
        .regex(DATE_KEY_REGEX, 'to must be YYYY-MM-DD')
        .optional(),
});
export type AdminExportWorkSessionsQuery = z.infer<
    typeof AdminExportWorkSessionsQuerySchema
>;

export const AdminExportVacationsQuerySchema = z.object({
    year: z.string().regex(/^\d{4}$/, 'year must be YYYY'),
    userIds: z.string().optional(),
});
export type AdminExportVacationsQuery = z.infer<
    typeof AdminExportVacationsQuerySchema
>;

export const WorkSessionAnomalySchema = z.enum([
    'forgot_check_out',
    'forgot_check_in',
    'hours_short',
    'hours_over',
]);
export type WorkSessionAnomaly = z.infer<typeof WorkSessionAnomalySchema>;

export const WorkSessionRowStatusSchema = z.enum([
    'vacation',
    'ok',
    'anomaly',
    'nonWorkingDay',
]);
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

function validateAdminWorkSessionsQuery(
    data: {
        period: string;
        date?: string;
        year?: number;
        month?: number;
    },
    ctx: z.RefinementCtx
) {
    if ((data.period === 'day' || data.period === 'week') && !data.date) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['date'],
            message: 'Date is required for day/week periods',
        });
    }
    if (
        data.period === 'month' &&
        (data.year === undefined || data.month === undefined)
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['year'],
            message: 'Year and month are required for month period',
        });
    }
    if (data.period === 'year' && data.year === undefined) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['year'],
            message: 'Year is required for year period',
        });
    }
}

export const AdminWorkSessionsQuerySchema = z
    .object({
        period: z.enum(ADMIN_REPORT_PERIODS),
        date: z.string().optional(),
        year: z.coerce.number().int().gte(MIN_VALID_YEAR).lte(MAX_VALID_YEAR).optional(),
        month: z.coerce.number().int().gte(1).lte(12).optional(),
    })
    .superRefine(validateAdminWorkSessionsQuery);
export type AdminWorkSessionsQuery = z.infer<
    typeof AdminWorkSessionsQuerySchema
>;

export const AdminWorkSessionsQueryWithPaginationSchema = z
    .object({
        period: z.enum(ADMIN_REPORT_PERIODS),
        date: z.string().optional(),
        year: z.coerce.number().int().gte(MIN_VALID_YEAR).lte(MAX_VALID_YEAR).optional(),
        month: z.coerce.number().int().gte(1).lte(12).optional(),
        limit: z.coerce.number().int().min(1).max(1000).optional(),
        offset: z.coerce.number().int().min(0).optional(),
    })
    .superRefine(validateAdminWorkSessionsQuery);
export type AdminWorkSessionsQueryWithPagination = z.infer<
    typeof AdminWorkSessionsQueryWithPaginationSchema
>;

export const AdminWorkSessionInputSchema = z.object({
    type: WorkSessionTypeSchema,
    timestamp: z.string().min(1, 'Timestamp is required'),
});
export type AdminWorkSessionInput = z.infer<typeof AdminWorkSessionInputSchema>;

export const AdminReplaceDayWorkSessionsRequestSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    date: z.string().min(1, 'Date is required'),
    sessions: z.array(AdminWorkSessionInputSchema),
    // Audit note: why the day is being corrected. Stored on the new version.
    reason: z.string().max(500).optional(),
});
export type AdminReplaceDayWorkSessionsRequest = z.infer<
    typeof AdminReplaceDayWorkSessionsRequestSchema
>;

export const UserLoginResponseSchema = z.object({
    user: UserSchema,
    token: z.string(),
});
export type UserLoginResponse = z.infer<typeof UserLoginResponseSchema>;

export const YearlyVacationsResponseSchema = z.object({
    year: z.number().int().gte(MIN_VALID_YEAR).lte(MAX_VALID_YEAR),
    electives: z.array(
        ElectiveVacationSchema.extend({
            _id: z.string(),
            // Resolved server-side: display name of the admin who approved.
            approvedByName: z.string().optional(),
        })
    ),
    yearlyVacationDays: YearlyVacationDaysSchema.extend({
        _id: z.string(),
    }).nullable(),
});
export type YearlyVacationResponse = z.infer<
    typeof YearlyVacationsResponseSchema
>;

export const MonthlyWorkRecordResponseSchema = z.object({
    userId: z.string(),
    year: z.number().int().gte(MIN_VALID_YEAR).lte(MAX_VALID_YEAR),
    month: z.number().int().gte(1).lte(12),
    sessionsByDay: z.array(
        z.array(WorkSessionSchema.extend({ _id: z.string() }))
    ), // index is day of the month, position 0 is empty
    summary: z.object({
        totalSessions: z.number().int().gte(0),
        totalHoursWorked: z.number().gte(0),
        daysWithSessions: z.number().int().gte(0),
        dailyStats: z.array(
            z.object({
                // index is day of the month, position 0 is empty
                hoursWorked: z.number().gte(0),
                sessions: z.number().int().gte(0),
            })
        ),
    }),
});
export type MonthlyWorkRecordResponse = z.infer<
    typeof MonthlyWorkRecordResponseSchema
>;

// ---------------------------------------------------------------------------
// Monthly record confirmation (registro de jornada)
// ---------------------------------------------------------------------------

export const MonthlyApprovalOpenRequestSchema = z.object({
    year: z.number().int().gte(MIN_VALID_YEAR).lte(MAX_VALID_YEAR),
    month: z.number().int().gte(1).lte(12),
    // Users to open the month for. Omitted = all registered employees.
    userIds: z.array(z.string()).optional(),
    // Force opening even for users whose month still has pending anomalies.
    force: z.boolean().optional().default(false),
});
export type MonthlyApprovalOpenRequest = z.infer<
    typeof MonthlyApprovalOpenRequestSchema
>;

export const MonthlyApprovalRevokeRequestSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    year: z.number().int().gte(MIN_VALID_YEAR).lte(MAX_VALID_YEAR),
    month: z.number().int().gte(1).lte(12),
});
export type MonthlyApprovalRevokeRequest = z.infer<
    typeof MonthlyApprovalRevokeRequestSchema
>;

export const MonthlyApprovalRowSchema = MonthlyApprovalSchema.extend({
    _id: z.string(),
    userName: z.string().optional(),
});
export type MonthlyApprovalRow = z.infer<typeof MonthlyApprovalRowSchema>;

// POST /api/admin/monthly-approvals/open — per-user outcome.
export const MonthlyApprovalOpenResultSchema = z.object({
    // Users whose request email was sent successfully just now.
    notified: z.array(MonthlyApprovalRowSchema),
    // Users opened but whose request email could not be sent (mail failure or
    // the user has no email address). Their doc is pending; revoke + re-open
    // to try notifying them again.
    emailFailed: z.array(
        z.object({
            userId: z.string(),
            userName: z.string().optional(),
        })
    ),
    // Users that could not be opened: their month still has anomalies.
    blocked: z.array(
        z.object({
            userId: z.string(),
            userName: z.string().optional(),
            anomalies: z.array(WorkSessionAnomalySchema),
        })
    ),
    // Users already asked (an existing pending request) that were skipped to
    // avoid re-notifying them.
    skipped: z.array(
        z.object({
            userId: z.string(),
            userName: z.string().optional(),
        })
    ),
    // Users excluded because their tracking had not started by the month.
    notTracking: z.array(
        z.object({
            userId: z.string(),
            userName: z.string().optional(),
        })
    ),
});
export type MonthlyApprovalOpenResult = z.infer<
    typeof MonthlyApprovalOpenResultSchema
>;

// GET /api/admin/work-sessions and GET /api/me/history response envelope.
export const WorkSessionsResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        rows: z.array(AdminWorkSessionRowSchema),
        total: z.number().int().optional(),
        limit: z.number().int().optional(),
        offset: z.number().int().optional(),
        approvedMonths: z.array(z.string()).optional(),
    }),
});

export type WorkSessionsResponse = z.infer<typeof WorkSessionsResponseSchema>;
