import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { User } from '@/models';

const MONGODB_URI = process.env.TEST_MONGO_URI || '';
const TEST_EMAIL = 'reset-int@example.com';

const hasMongo = Boolean(MONGODB_URI);

describe.skipIf(!hasMongo)('reset-password integration', () => {
    beforeAll(async () => {
        await mongoose.connect(MONGODB_URI);
        await User.deleteMany({ email: TEST_EMAIL });
    });

    afterAll(async () => {
        await User.deleteMany({ email: TEST_EMAIL });
        await mongoose.disconnect();
    });

    it('persists the password change and clears the token via null', async () => {
        const u = new User({
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
        await u.save();

        u.password = 'NewPass123!';
        u.resetPasswordToken = null;
        u.resetPasswordExpires = null;
        u.failedLoginAttempts = 0;
        u.blocked = false;
        u.blockedSince = null;
        u.updatedAt = new Date();
        await u.save();

        const reloaded: any = await User.findById(u._id).lean();
        // Cleared fields are persisted as null (Mongoose stores null, drops
        // undefined). The reset token must no longer match anything.
        expect(reloaded?.resetPasswordToken).toBeNull();
        expect(reloaded?.resetPasswordExpires).toBeNull();
        expect(reloaded?.blockedSince).toBeNull();

        const matches = await bcrypt.compare('NewPass123!', reloaded?.password);
        expect(matches).toBe(true);
    });
});