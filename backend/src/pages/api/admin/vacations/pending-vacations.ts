import { withApi } from '@/lib/api-handler';
import { ElectiveVacation, User } from '@/models';
import { notDeleted } from '@/repositories/user-repository';
import { VACATION_PENDING } from 'shared/src/lib/constants';

export default withApi(
    { method: 'GET', guard: 'admin' },
    async (_req, res) => {
        const activeUsers = await User.find(notDeleted, '_id').lean();
        const activeUserIds = activeUsers.map((u) => u._id);

        const vacations = await ElectiveVacation.find({
            status: VACATION_PENDING,
            userId: { $in: activeUserIds },
        })
            .sort({ startDate: 1 })
            .lean();

        res.status(200).json({ success: true, data: { vacations } });
    }
);
