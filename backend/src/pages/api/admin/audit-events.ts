import { withApi } from '@/lib/api-handler';
import { AuditEvent, User } from '@/models';
import { responseErrorGet } from '@/lib/response-error-generator';
import {
    AdminAuditEventsQuery,
    AdminAuditEventsQuerySchema,
    AuditEventRow,
} from 'shared/src/schemas/api';

const DEFAULT_LIMIT = 50;

// Read-only, newest-first review of the append-only audit log. No update or
// delete path exists on purpose: the log's value is that nobody can rewrite
// it. Optional filters: action, actorId, timestamp range (from/to). Always
// paginated server-side: the log grows unboundedly, so an unbounded fetch is
// never offered.
export default withApi(
    { method: 'GET', guard: 'admin', query: AdminAuditEventsQuerySchema },
    async (req, res) => {
        try {
            const query = req.query as unknown as AdminAuditEventsQuery;
            const limit = query.limit ?? DEFAULT_LIMIT;
            const offset = query.offset ?? 0;

            const filter: Record<string, unknown> = {};
            if (query.action) filter.action = query.action;
            if (query.actorId) filter.actorId = query.actorId;
            if (query.from || query.to) {
                const timestamp: Record<string, Date> = {};
                if (query.from) timestamp.$gte = new Date(`${query.from}T00:00:00`);
                if (query.to) timestamp.$lte = new Date(`${query.to}T23:59:59.999`);
                filter.timestamp = timestamp;
            }

            const findQuery = AuditEvent.find(filter)
                .sort({ timestamp: -1 })
                .skip(offset)
                .limit(limit);
            const [events, total] = await Promise.all([
                findQuery.lean(),
                AuditEvent.countDocuments(filter),
            ]);

            // Resolve actors to display names for the review UI.
            const actorIds = Array.from(
                new Set(events.map((e) => e.actorId).filter(Boolean))
            );
            const actors = actorIds.length
                ? ((await User.find(
                      { _id: { $in: actorIds } },
                      'name'
                  ).lean()) as unknown as { _id: string; name: string }[])
                : [];
            const nameById = new Map(actors.map((u) => [u._id.toString(), u.name]));

            const rows: AuditEventRow[] = (
                events as unknown as (AuditEventRow & { actorId: string })[]
            ).map((e) => ({
                ...e,
                _id: String(e._id),
                actorName: nameById.get(e.actorId),
            }));

            res.status(200).json({
                success: true,
                data: { events: rows, total, limit, offset },
            });
        } catch (error) {
            console.error('Audit events error:', error);
            return responseErrorGet(res);
        }
    }
);
