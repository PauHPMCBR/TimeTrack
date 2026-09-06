import { withApi } from '@/lib/api-handler';
import { Group, User } from '@/models';
import { notDeleted } from '@/repositories/user-repository';
import { CreateGroupRequestSchema } from 'shared/src/schemas/api';

export default withApi(
    { method: 'POST', guard: 'admin', body: CreateGroupRequestSchema },
    async (_req, res, { body }) => {
        const { name, description, members } = body;

        const group = await Group.create({
            name,
            description,
            members: members || [],
        });

        if (members && members.length > 0) {
            await User.updateMany(
                { _id: { $in: members }, ...notDeleted },
                { $addToSet: { groups: group._id } }
            );
        }

        res.status(201).json({ success: true, data: { group } });
    }
);
