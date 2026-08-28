import {
    UserRoleSchema,
    VacationStatusSchema,
    WorkSessionSourceSchema,
    WorkSessionStatusSchema,
    WorkSessionTypeSchema,
} from '../schemas/database';

// Canonical enum values derived from the shared Zod schemas (single source of
// truth). Use these instead of re-typing the raw strings in API routes, guards
// and UI code.
export const USER_ROLES = UserRoleSchema.enum;
export const WORK_SESSION_TYPES = WorkSessionTypeSchema.enum;
export const WORK_SESSION_SOURCES = WorkSessionSourceSchema.enum;
export const WORK_SESSION_STATUSES = WorkSessionStatusSchema.enum;
export const VACATION_STATUSES = VacationStatusSchema.enum;

export const EMPLOYEE_ROLE = USER_ROLES.employee;
export const ADMIN_ROLE = USER_ROLES.admin;

export const CHECK_IN = WORK_SESSION_TYPES.check_in;
export const CHECK_OUT = WORK_SESSION_TYPES.check_out;

export const SOURCE_USER = WORK_SESSION_SOURCES.user;
export const SOURCE_ADMIN = WORK_SESSION_SOURCES.admin;
export const SOURCE_AUTOMATIC = WORK_SESSION_SOURCES.automatic;

export const SESSION_ACTIVE = WORK_SESSION_STATUSES.active;
export const SESSION_REPLACED = WORK_SESSION_STATUSES.replaced;

export const VACATION_PENDING = VACATION_STATUSES.pending;
export const VACATION_APPROVED = VACATION_STATUSES.approved;
export const VACATION_REJECTED = VACATION_STATUSES.rejected;
export const VACATION_CANCELLED = VACATION_STATUSES.cancelled;

// Audit "why" recorded in `notes` on documents created by the replacement
// flows (kept as fixed, non-localized strings: they are part of the record).
export const SESSION_REASON_ADMIN_CORRECTION = 'Admin day correction';
export const SESSION_REASON_AUTO_TIMETABLE = 'Automatic timetable applied';

// Admin report periods, shared by the query schemas and the admin UI.
export const ADMIN_REPORT_PERIODS = ['day', 'week', 'month', 'year'] as const;
export type AdminReportPeriod = (typeof ADMIN_REPORT_PERIODS)[number];

// Time units (milliseconds).
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_DAY = 86_400_000;

// Avatar upload cap (bytes), enforced by both the API and the upload UI.
export const AVATAR_MAX_BYTES = 10 * 1024 * 1024;

// HTTP header used to return the re-issued JWT on refresh (rolling session).
export const REFRESH_TOKEN_HEADER = 'X-Auth-Token';

// Entropy (bytes) for registration / password-reset tokens.
export const TOKEN_BYTE_LENGTH = 32;

// Validation bounds / patterns shared by schemas and callers.
export const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const MIN_VALID_YEAR = 2000;
export const MAX_VALID_YEAR = 2100;