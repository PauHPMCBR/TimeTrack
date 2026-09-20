import { z } from 'zod';
import {
    AutoScheduleEntrySchema,
    DaySessionSchema,
    DateKeyIntervalSchema,
    ElectiveVacationSchema,
    GroupSchema,
    MonthlyApprovalSchema,
    MonthlyApprovalEventSchema,
    AuditEventSchema,
    ScheduleModeSchema,
    UserRoleSchema,
    UserSchema,
    UserFileSchema,
    ValidWeekTimetableSchema,
    SourceKindSchema,
    YearlyVacationDaysSchema,
    AuthorizedLeaveSchema,
    WorkDayClassificationSchema,
    WorkDayCheckModeSchema,
    WorkSessionAnomalySchema,
    AppSettingsSchema,
} from './database';
import {
    ADMIN_REPORT_PERIODS,
    EMPLOYEE_ROLE,
    MAX_VALID_YEAR,
    MIN_VALID_YEAR,
} from '../lib/constants';
import { DateKeySchema } from '../lib/day-key';
import { TimeKeySchema } from '../lib/time-key';

const userIdField = () => z.string().min(1, 'User ID is required');

const yearQueryField = () =>
    z
        .string()
        .transform((val) => parseInt(val, 10))
        .refine(
            (val) => !isNaN(val) && val >= MIN_VALID_YEAR && val <= MAX_VALID_YEAR,
            'Invalid year'
        );

const monthQueryField = () =>
    z
        .string()
        .transform((val) => parseInt(val, 10))
        .refine((val) => !isNaN(val) && val >= 1 && val <= 12, 'Invalid month');

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
        weeklyExpectedHours: z
            .array(z.number().min(0))
            .length(7)
            .optional(),        scheduleMode: ScheduleModeSchema.optional(),
        timetable: ValidWeekTimetableSchema.optional(),
        // The day the user started time tracking (local "YYYY-MM-DD").
        trackingStartDate: DateKeySchema.optional(),
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

export const AppSettingsRequestSchema = AppSettingsSchema.pick({
    defaultWeeklyExpectedHours: true,
    toleranceMinutes: true,
    defaultScheduleMode: true,
    defaultTimetable: true,
    timetableToleranceMinutes: true,
    endOfDayHour: true,
    inconsistencyReminderMode: true,
    monthlyApprovalReminderDays: true,
    timezone: true,
    privacyNoticeText: true,
    workerConsultationAcknowledged: true,
})
    .partial()
    .extend({
        defaultTimetable: ValidWeekTimetableSchema.optional(),
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

export const CreateGroupRequestSchema = GroupSchema.pick({
    name: true,
    description: true,
    members: true,
}).extend({
    members: z.array(z.string()),
});
export type CreateGroupRequest = z.infer<typeof CreateGroupRequestSchema>;

export const WorkSessionRequestSchema = DaySessionSchema.pick({
    type: true,
    notes: true,
    overtime: true,
}).extend({
    overtime: z.boolean().optional(),
});
export type WorkSessionRequest = z.infer<typeof WorkSessionRequestSchema>;

export const ApplyAutoScheduleRequestSchema = z.object({
    date: DateKeySchema.optional(),
});
export type ApplyAutoScheduleRequest = z.infer<
    typeof ApplyAutoScheduleRequestSchema
>;

export const UpdateProfileRequestSchema = UserSchema.pick({
    autoTimetable: true,
    notifyNewFile: true,
    notifyInconsistency: true,
})
    .partial()
    .extend({
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

export const ElectiveVacationRequestSchema = DateKeyIntervalSchema.pick({
    startDate: true,
    endDate: true,
})
    .extend({
        startDate: DateKeySchema,
        endDate: DateKeySchema,
        reason: z.string().max(1000).optional(),
    })
    .refine((data) => data.endDate >= data.startDate, {
        message: 'endDate must be on or after startDate',
    });
export type ElectiveVacationRequest = z.infer<
    typeof ElectiveVacationRequestSchema
>;

export const YearlyVacationAdminRequestSchema = z.object({
    year: z.number().int().gte(MIN_VALID_YEAR).lte(MAX_VALID_YEAR),
    obligatoryDays: z.array(DateKeySchema),
    electiveDaysTotalCount: z.number().gte(0),
});
export type YearlyVacationAdminRequest = z.infer<
    typeof YearlyVacationAdminRequestSchema
>;

export const UserIdParamSchema = z.object({
    userId: userIdField(),
});
export type UserIdParam = z.infer<typeof UserIdParamSchema>;

export const DateParamSchema = z.object({
    userId: userIdField(),
    date: DateKeySchema,
});
export type DateParam = z.infer<typeof DateParamSchema>;

export const YearMonthParamSchema = z.object({
    userId: userIdField(),
    year: yearQueryField(),
    month: monthQueryField(),
});
export type YearMonthParam = z.infer<typeof YearMonthParamSchema>;

export const WorkSessionRangeQuerySchema = z.object({
    userId: userIdField(),
    from: DateKeySchema,
    to: DateKeySchema,
});
export type WorkSessionRangeQuery = z.infer<typeof WorkSessionRangeQuerySchema>;

export const UserYearParamSchema = z.object({
    userId: userIdField(),
    year: yearQueryField(),
});
export type UserYearParam = z.infer<typeof UserYearParamSchema>;

export const AdminExportWorkSessionsQuerySchema = z.object({
    userIds: z.string().min(1, 'At least one user id is required'),
    from: DateKeySchema.optional(),
    to: DateKeySchema.optional(),
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

export { WorkSessionAnomalySchema };
export type { WorkSessionAnomaly } from './database';

export const WorkSessionRowStatusSchema = z.enum([
    'ok',
    'anomaly',
    'nonWorkingDay',
    'electiveVacation',
    'obligatoryVacation',
    'authorizedLeave',
    'planned',
]);
export type WorkSessionRowStatus = z.infer<typeof WorkSessionRowStatusSchema>;

export const DaySessionRowSchema = DaySessionSchema.extend({
    time: TimeKeySchema,
});
export type DaySessionRow = z.infer<typeof DaySessionRowSchema>;

export const AdminWorkSessionRowSchema = z.object({
    userId: z.string(),
    userName: z.string(),
    date: DateKeySchema,
    totalHours: z.number().gte(0),
    overtimeHours: z.number().gte(0),
    expectedHours: z.number().gte(0),
    timetable: z.array(AutoScheduleEntrySchema).optional(),
    source: SourceKindSchema.optional(),
    sessions: z.array(DaySessionRowSchema),
    editedBy: z.string().optional(),
    editReason: z.string().optional(),
    createdAt: z.date().optional(),
    status: WorkSessionRowStatusSchema,
    dayClassification: WorkDayClassificationSchema,
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
        date: DateKeySchema.optional(),
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
        date: DateKeySchema.optional(),
        year: z.coerce.number().int().gte(MIN_VALID_YEAR).lte(MAX_VALID_YEAR).optional(),
        month: z.coerce.number().int().gte(1).lte(12).optional(),
        limit: z.coerce.number().int().min(1).max(1000).optional(),
        offset: z.coerce.number().int().min(0).optional(),
    })
    .superRefine(validateAdminWorkSessionsQuery);
export type AdminWorkSessionsQueryWithPagination = z.infer<
    typeof AdminWorkSessionsQueryWithPaginationSchema
>;

export const AdminWorkSessionInputSchema = DaySessionSchema.pick({
    type: true,
    time: true,
    notes: true,
    overtime: true,
}).extend({
    time: TimeKeySchema,
    overtime: z.boolean().optional(),
});
export type AdminWorkSessionInput = z.infer<typeof AdminWorkSessionInputSchema>;

export const AdminReplaceDayWorkSessionsRequestSchema = z.object({
    userId: userIdField(),
    date: DateKeySchema,
    sessions: z.array(AdminWorkSessionInputSchema),
    // Why the day is being corrected. Stored as editReason on the new version.
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
            .extend({ startDate: DateKeySchema, endDate: DateKeySchema })
    ),
    yearlyVacationDays: YearlyVacationDaysSchema.extend({
        _id: z.string(),
        obligatoryDays: z.array(DateKeySchema),
    }).nullable(),
});
export type YearlyVacationResponse = z.infer<
    typeof YearlyVacationsResponseSchema
>;

export const MonthlyWorkRecordResponseSchema = z.object({
    userId: z.string(),
    year: z.number().int().gte(MIN_VALID_YEAR).lte(MAX_VALID_YEAR),
    month: z.number().int().gte(1).lte(12),
    sessionsByDay: z.array(z.array(DaySessionRowSchema)), // index is day of the month, position 0 is empty
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
    userId: userIdField(),
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

export const MonthlyApprovalEventRowSchema = MonthlyApprovalEventSchema.extend({
    _id: z.string(),
    actorName: z.string().optional(),
});
export type MonthlyApprovalEventRow = z.infer<
    typeof MonthlyApprovalEventRowSchema
>;

export const AuditEventRowSchema = AuditEventSchema.extend({
    _id: z.string(),
    actorName: z.string().optional(),
});
export type AuditEventRow = z.infer<typeof AuditEventRowSchema>;

export const AdminAuditEventsQuerySchema = z.object({
    action: z.string().optional(),
    actorId: z.string().optional(),
    from: DateKeySchema.optional(),
    to: DateKeySchema.optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    offset: z.coerce.number().int().min(0).optional(),
});
export type AdminAuditEventsQuery = z.infer<typeof AdminAuditEventsQuerySchema>;

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
        timetableToleranceMinutes: z.number().int().gte(0).optional(),
    }),
});

export type WorkSessionsResponse = z.infer<typeof WorkSessionsResponseSchema>;

// ---------------------------------------------------------------------------
// Admin-shared employee files
// ---------------------------------------------------------------------------

export const FileSortFieldSchema = z.enum(['uploadedAt', 'originalName']);
export type FileSortField = z.infer<typeof FileSortFieldSchema>;

export const FileSortOrderSchema = z.enum(['asc', 'desc']);
export type FileSortOrder = z.infer<typeof FileSortOrderSchema>;

// GET /api/admin/files (query). userId filters by employee; sortBy/order drive
// the list ordering. All fields optional (defaults: everyone, uploadedAt desc).
export const AdminFilesQuerySchema = z.object({
    userId: z.string().min(1).optional(),
    sortBy: FileSortFieldSchema.optional(),
    order: FileSortOrderSchema.optional(),
});
export type AdminFilesQuery = z.infer<typeof AdminFilesQuerySchema>;

// GET /api/files (own list): same sorting options, no employee filter.
export const MyFilesQuerySchema = AdminFilesQuerySchema.omit({ userId: true });
export type MyFilesQuery = z.infer<typeof MyFilesQuerySchema>;

// PUT /api/admin/files/[fileId] (edit metadata: display name and/or
// description; at least one field). Editing also refreshes the upload date.
export const FileUpdateRequestSchema = z
    .object({
        originalName: z.string().min(1, 'File name is required').max(255).optional(),
        description: z.string().max(1000).optional(),
    })
    .refine(
        (data) => Object.keys(data).length > 0,
        'At least one field is required'
    );
export type FileUpdateRequest = z.infer<typeof FileUpdateRequestSchema>;

// POST /api/admin/files (upload). The file travels as a base64 data URL in the
// JSON body (same transport as avatar uploads); the binary must fit within
// FILE_MAX_BYTES after decoding.
export const FileUploadRequestSchema = z.object({
    userId: userIdField(),
    originalName: z.string().min(1, 'File name is required').max(255),
    description: z.string().max(1000).optional(),
    dataUrl: z
        .string()
        .regex(/^data:[\w.+-]+\/[\w.+-]+;base64,/, 'Invalid file data url'),
});
export type FileUploadRequest = z.infer<typeof FileUploadRequestSchema>;

export const FileIdParamSchema = z.object({
    fileId: z.string().min(1, 'File ID is required'),
});
export type FileIdParam = z.infer<typeof FileIdParamSchema>;

// A file entry as returned by the list/upload endpoints.
export const FileRowSchema = UserFileSchema.extend({
    _id: z.string(),
    // Resolved server-side: display name of the employee the file belongs to.
    userName: z.string().optional(),
});
export type FileRow = z.infer<typeof FileRowSchema>;

// Response of the file-list endpoints (admin and self). totalSize is the
// storage used by all employee files and quotaBytes the configured cap (null
// when no quota could be determined).
export const FilesResponseSchema = z.object({
    files: z.array(FileRowSchema),
    totalSize: z.number().int().gte(0),
    quotaBytes: z.number().int().gte(0).nullable(),
});
export type FilesResponse = z.infer<typeof FilesResponseSchema>;

export const AdminAuthorizedLeaveRequestSchema = z
    .object({
        userId: userIdField(),
        startDate: DateKeySchema,
        endDate: DateKeySchema,
        notes: z.string().max(2000).optional(),
    })
    .refine((data) => data.endDate >= data.startDate, {
        message: 'endDate must be on or after startDate',
    });
export type AdminAuthorizedLeaveRequest = z.infer<
    typeof AdminAuthorizedLeaveRequestSchema
>;

export const AdminAuthorizedLeaveUpdateRequestSchema = z
    .object({
        startDate: DateKeySchema.optional(),
        endDate: DateKeySchema.optional(),
        notes: z.string().max(2000).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: 'At least one field is required',
    });
export type AdminAuthorizedLeaveUpdateRequest = z.infer<
    typeof AdminAuthorizedLeaveUpdateRequestSchema
>;

export const AuthorizedLeaveRowSchema = AuthorizedLeaveSchema.extend({
    _id: z.string(),
    startDate: DateKeySchema,
    endDate: DateKeySchema,
    createdByName: z.string().optional(),
});
export type AuthorizedLeaveRow = z.infer<typeof AuthorizedLeaveRowSchema>;

export const AdminAuthorizedLeavesQuerySchema = z.object({
    userId: z.string().min(1).optional(),
    from: DateKeySchema.optional(),
    to: DateKeySchema.optional(),
});
export type AdminAuthorizedLeavesQuery = z.infer<
    typeof AdminAuthorizedLeavesQuerySchema
>;

export const AuthorizedLeavesResponseSchema = z.object({
    leaves: z.array(AuthorizedLeaveRowSchema),
});
export type AuthorizedLeavesResponse = z.infer<
    typeof AuthorizedLeavesResponseSchema
>;

export const AdminWorkDayRecordUpdateRequestSchema = z.object({
    userId: userIdField(),
    date: DateKeySchema,
    classification: WorkDayClassificationSchema,
    checkMode: WorkDayCheckModeSchema.optional(),
    timetableIntervals: z.array(AutoScheduleEntrySchema).optional(),
    expectedHours: z.number().min(0).optional(),
    reason: z.string().max(500).optional(),
});
export type AdminWorkDayRecordUpdateRequest = z.infer<
    typeof AdminWorkDayRecordUpdateRequestSchema
>;
