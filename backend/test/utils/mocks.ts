import { vi } from 'vitest';
import jwt from 'jsonwebtoken';

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
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        setHeader: vi.fn().mockReturnThis(),
        getHeader: vi.fn().mockReturnValue(undefined),
    };
    return res;
};

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

export const createAuthHeader = (payload: any = {}) => {
    return `Bearer ${createMockToken(payload)}`;
};
