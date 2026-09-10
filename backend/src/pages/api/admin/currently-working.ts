import { withApi } from '@/lib/api-handler';
import { CHECK_IN } from 'shared/src/lib/constants';
import { WorkSession, User } from '@/models';
import { notReplaced } from '@/repositories/work-session-repository';
import { notDeleted } from '@/repositories/user-repository';
import { startOfDay } from '@/lib/date-range';
import { responseErrorGet } from '@/lib/response-error-generator';

export default withApi(
    { method: 'GET', guard: 'admin' },
    async (_req, res) => {
        try {
            const today = startOfDay(new Date());

            const latestSessions = await WorkSession.aggregate([
                {
                    $match: {
                        timestamp: { $gte: today },
                        ...notReplaced,
                    },
                },
                {
                    $sort: { timestamp: -1 },
                },
                {
                    $group: {
                        _id: '$userId',
                        latestSession: { $first: '$$ROOT' },
                    },
                },
            ]);

            const activeUserIds = latestSessions
                .filter((s) => s.latestSession.type === CHECK_IN)
                .map((s) => s._id);

            const activeUsers = await User.find(
                {
                    _id: { $in: activeUserIds },
                    blocked: { $ne: true },
                    registered: true,
                    ...notDeleted,
                },
                'name email emailEncrypted'
            ).lean();

            res.status(200).json({
                success: true,
                data: {
                    count: activeUsers.length,
                    users: activeUsers,
                },
            });
        } catch (error) {
            console.error('Currently working error:', error);
            return responseErrorGet(res);
        }
    }
);
