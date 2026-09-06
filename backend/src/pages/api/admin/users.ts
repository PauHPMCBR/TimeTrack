import { withApi } from '@/lib/api-handler';
import { listActive } from '@/repositories/user-repository';
import { toPublicUser } from '@/lib/sanitize';

export default withApi(
    { method: 'GET', guard: 'admin' },
    async (_req, res) => {
        const users = await listActive({
            blocked: { $ne: true },
            registered: true,
        }).lean();
        // toPublicUser strips the password hash, registration tokens and lockout
        // state (failedLoginAttempts/blocked/blockedSince) before sending.
        res.status(200).json({
            success: true,
            data: {
                users: users.map((u) => toPublicUser(u)),
            },
        });
    }
);
