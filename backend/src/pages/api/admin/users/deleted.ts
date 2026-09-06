import { withApi } from '@/lib/api-handler';
import { User } from '@/models';
import type { UserRow } from '@/lib/rows';
import { toPublicUser } from '@/lib/sanitize';

// Admin list of soft-deleted users (edit to resolve conflicts, or restore).
export default withApi(
    { method: 'GET', guard: 'admin' },
    async (_req, res) => {
        const users = (await User.find({ deleted: true })
            .sort({ deletedAt: -1 })
            .lean()) as unknown as UserRow[];

        res.status(200).json({
            success: true,
            data: {
                users: users.map((u) => ({
                    ...toPublicUser(u),
                    _id: u._id.toString(),
                    // toPublicUser strips `deleted`; restore it for the client.
                    deleted: true,
                    deletedAt: u.deletedAt
                        ? u.deletedAt.toISOString()
                        : new Date(0).toISOString(),
                })),
            },
        });
    }
);
