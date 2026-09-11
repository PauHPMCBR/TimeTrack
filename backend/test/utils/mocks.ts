import { vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { defaultTimetable } from 'shared/src/schemas/database';
import { defaultWeeklyExpectedHours } from 'shared/src/lib/defaults';
import type { AppSettingsValues } from '@/lib/settings';

// Field-encryption keys for tests (real values come from the environment in
// production; the backend fails fast without them). Deterministic hex keys
// keep HMAC lookups comparable across test files.
if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
}
if (!process.env.HASH_KEY) {
    process.env.HASH_KEY = 'cd'.repeat(32);
}

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

export const mockReq = (overrides: any = {}): any => ({
    method: 'GET',
    headers: {},
    query: {},
    body: {},
    ...overrides,
});

export const mockRes = (): any => {
    const res: any = {
        // Next's res.status(code) sets statusCode; the withApi audit hook
        // reads it, so the mock mirrors that behaviour.
        statusCode: undefined,
        status: vi.fn(function (this: any, code: number) {
            this.statusCode = code;
            return this;
        }),
        json: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        setHeader: vi.fn().mockReturnThis(),
        getHeader: vi.fn().mockReturnValue(undefined),
    };
    return res;
};

export const createMockAppSettings = (
    overrides: Partial<AppSettingsValues> = {}
): AppSettingsValues => ({
    defaultWeeklyExpectedHours: defaultWeeklyExpectedHours(),
    toleranceMinutes: 60,
    defaultScheduleMode: 'hours',
    defaultTimetable: defaultTimetable(),
    timetableToleranceMinutes: 10,
    endOfDayHour: 20,
    inconsistencyReminderMode: 'forced',
    monthlyApprovalReminderDays: 5,
    ...overrides,
});

export const createMockUser = (overrides: any = {}) => ({
    _id: 'user-id-123',
    email: 'test@example.com',
    password: 'hashedpassword',
    role: 'employee',
    blocked: false,
    blockedSince: null,
    failedLoginAttempts: 0,
    groups: [],
    comparePassword: vi.fn().mockResolvedValue(true),
    ...overrides,
});

export const createMockToken = (payload: Record<string, unknown> = {}) => {
    return jwt.sign(
        payload,
        process.env.JWT_SECRET || 'fallback-secret-change-in-production',
        { expiresIn: '24h' }
    );
};

export const createAuthCookie = (payload: Record<string, unknown> = {}) => {
    return `auth_token=${createMockToken(payload)}`;
};
