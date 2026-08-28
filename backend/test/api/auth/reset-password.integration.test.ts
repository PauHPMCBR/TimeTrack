import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { User } from '@/models';

const TEST_EMAIL = 'reset-int@example.com';
const hasMongo = Boolean(process.env.TEST_MONGO_URI);

const mockReq = (body: Record<string, unknown>) => ({
    method: 'POST',
    headers: {},
    query: {},
    body,
});
const mockRes = () => {
    const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        setHeader: vi.fn().mockReturnThis(),
    };
    return res;
};

// Runs against a real MongoDB only when TEST_MONGO_URI is provided (locally /
// in a deploy check). Skipped in CI. The handler is imported dynamically after
// the env vars are set because @/lib/mongodb reads MONGODB_URI at import time.
describe.skipIf(!hasMongo)('reset-password integration', () => {
    beforeAll(async () => {
        process.env.MONGODB_URI = process.env.TEST_MONGO_URI;
        process.env.JWT_SECRET = 'integration-test-jwt-secret';
        await mongoose.connect(process.env.TEST_MONGO_URI!);
        await User.deleteMany({ email: TEST_EMAIL });
    });

    afterAll(async () => {
        await User.deleteMany({ email: TEST_EMAIL });
        await mongoose.disconnect();
    });

    it('resets the password end-to-end and clears the token', async () => {
        await User.create({
            name: 'Reset Int',
            email: TEST_EMAIL,
            registrationToken: 'rt',
            registered: true,
            dni: '00000000R',
            lastInconsistencyReminder: '',
            password: 'OldPass123!',
            resetPasswordToken: 'reset-token-123',
            resetPasswordExpires: new Date(Date.now() + 3600_000),
        });

        const { default: resetPasswordHandler } = await import(
            '@/pages/api/auth/reset-password'
        );
        const res = mockRes();
        await resetPasswordHandler(
            mockReq({
                token: 'reset-token-123',
                email: TEST_EMAIL,
                password: 'NewPass123!',
            }) as any,
            res as any
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );

        const reloaded: any = await User.findOne({ email: TEST_EMAIL }).lean();
        expect(reloaded.resetPasswordToken).toBeUndefined();
        expect(reloaded.resetPasswordExpires).toBeUndefined();
        const matches = await bcrypt.compare('NewPass123!', reloaded.password);
        expect(matches).toBe(true);
    });

    it('does not let a reused token work after the reset', async () => {
        const res = mockRes();
        const { default: resetPasswordHandler } = await import(
            '@/pages/api/auth/reset-password'
        );
        await resetPasswordHandler(
            mockReq({
                token: 'reset-token-123',
                email: TEST_EMAIL,
                password: 'AnotherPass123!',
            }) as any,
            res as any
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'InvalidResetToken' })
        );
    });
});