// Company-wide default values. These back the Zod schema defaults
// (shared/src/schemas/database.ts) and are reused wherever the app needs a
// fallback before settings/state are loaded.
export const DEFAULT_EXPECTED_WORK_HOURS = 8;
export const DEFAULT_BENEVOLENCE_HOURS = 1;
export const DEFAULT_END_OF_DAY_HOUR = 20;
export const DEFAULT_NON_WORKING_DAYS: number[] = [6, 0];
export const DEFAULT_ELECTIVE_VACATION_DAYS = 22;
export const DEFAULT_CHECK_IN_TIME = '09:00';
export const DEFAULT_CHECK_OUT_TIME = '17:00';
// Hour components of the default timetable times, used by admin editors to
// prefill a new check-in/check-out row.
export const DEFAULT_CHECK_IN_HOUR = 9;
export const DEFAULT_CHECK_OUT_HOUR = 17;
// Fallback base URL of the frontend (used to build registration / reset links).
export const DEFAULT_FRONTEND_URL = 'http://localhost:3000';
// Validity window (hours) for password-reset tokens.
export const RESET_TOKEN_TTL_HOURS = 1;