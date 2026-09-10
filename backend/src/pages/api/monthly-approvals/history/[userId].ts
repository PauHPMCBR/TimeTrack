import { withApi } from '@/lib/api-handler';
import { MonthlyApprovalEvent, User } from '@/models';
import { YearMonthParamSchema, MonthlyApprovalEventRow } from 'shared/src/schemas/api';

// Append-only history of a (user, month) approval cycle: opened / confirmed /
// revoked events with their actors, chronological.
export default withApi(
    { method: 'GET', guard: 'sameGroupOrAdmin', query: YearMonthParamSchema },
    async (_req, res, { query }) => {
        const events = (await MonthlyApprovalEvent.find({
            userId: query.userId,
            year: query.year,
            month: query.month,
        })
            .sort({ timestamp: 1 })
            .lean()) as unknown as (MonthlyApprovalEventRow & {
            userId: string;
        })[];

        // Resolve actors to display names (the worker themselves can appear
        // as the actor of a 'confirmed' event; admins of opened/revoked).
        const actorIds = Array.from(new Set(events.map((e) => e.actorId)));
        const actors = actorIds.length
            ? ((await User.find({ _id: { $in: actorIds } }, 'name').lean()) as unknown as {
                  _id: string;
                  name: string;
              }[])
            : [];
        const nameById = new Map(actors.map((u) => [u._id.toString(), u.name]));

        const rows: MonthlyApprovalEventRow[] = events.map((e) => ({
            ...e,
            _id: e._id.toString(),
            actorName: nameById.get(e.actorId),
        }));

        res.status(200).json({
            success: true,
            data: { events: rows },
        });
    }
);
