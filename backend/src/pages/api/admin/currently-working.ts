import { withApi } from '@/lib/api-handler';
import { CHECK_IN } from 'shared/src/lib/constants';
import { WorkDaySessions, User } from '@/models';
import { notReplaced } from '@/repositories/work-day-sessions-repository';
import { notDeleted } from '@/repositories/user-repository';
import { dateKey } from '@/lib/date-key';
import { responseErrorGet } from '@/lib/response-error-generator';
import type { DaySessionsRow, UserRow } from '@/lib/rows';

export default withApi(
    { method: 'GET', guard: 'admin' },
    async (_req, res) => {
        try {
            const todayKey = dateKey(new Date());

            const dayDocs = await WorkDaySessions.aggregate<
                Pick<DaySessionsRow, 'userId' | 'sessions'>
            >([
                {
                    $match: {
                        date: todayKey,
                        ...notReplaced,
                    },
                },
            ]);

            const activeUserIds = dayDocs
                .filter((d) => d.sessions.at(-1)?.type === CHECK_IN)
                .map((d) => d.userId);

            const activeUsers = await User.find(
                {
                    _id: { $in: activeUserIds },
                    blocked: { $ne: true },
                    registered: true,
                    ...notDeleted,
                },
                'name email emailEncrypted'
            ).lean<UserRow[]>();

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
