import { withApi } from '@/lib/api-handler';
import { Group } from '@/models';
import { listActive } from '@/repositories/user-repository';
import {
    responseErrorEntryNotFound,
} from '@/lib/response-error-generator';
import { GroupIdParamSchema } from 'shared/src/schemas/api';

export default withApi(
    { method: 'GET', guard: 'inGroupOrAdmin', query: GroupIdParamSchema },
    async (_req, res, { query }) => {
        const groupId = query.groupId;

        const group = (await Group.findById(
            groupId
        ).lean()) as Record<string, unknown> | null;

        if (!group) {
            return responseErrorEntryNotFound(res, 'Group');
        }

        // GroupSchema.members stores plain user id strings (no mongoose ref),
        // so the member docs are resolved manually. Blocked and soft-deleted
        // users are excluded; the stored order is preserved.
        const memberIds = (group.members as string[]) ?? [];
        const memberDocs = memberIds.length
            ? await listActive({
                  _id: { $in: memberIds },
                  blocked: { $ne: true },
              })
                  .select('name email role registered avatar')
                  .lean()
            : [];
        const byId = new Map(
            memberDocs.map((m) => [String(m._id), m as Record<string, unknown>])
        );
        const members = memberIds
            .map((id) => byId.get(String(id)))
            .filter((m) => m !== undefined);

        res.status(200).json({
            success: true,
            data: { group: { ...group, members } },
        });
    }
);
