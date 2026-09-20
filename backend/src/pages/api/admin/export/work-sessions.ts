import { withApi } from '@/lib/api-handler';
import { toCsv } from 'shared/src/lib/csv';
import { SOURCE_USER_CLICK, APPROVAL_APPROVED } from 'shared/src/lib/constants';
import { WorkDaySessions, User, MonthlyApproval } from '@/models';
import { notReplaced } from '@/repositories/work-day-sessions-repository';
import { notDeleted } from '@/repositories/user-repository';
import { responseErrorGet } from '@/lib/response-error-generator';
import { UserRow, DaySessionsRow } from '@/lib/rows';
import { AdminExportWorkSessionsQuerySchema, MonthlyApprovalRow } from 'shared/src/schemas/api';
import { dateKey } from '@/lib/date-key';


export default withApi(
    {
        method: 'GET',
        guard: 'admin',
        query: AdminExportWorkSessionsQuerySchema,
        audit: {
            action: 'export_work_sessions',
            targetType: 'work_session_export',
            metadata: (req, ctx) => ({
                users: (req.query.userIds as string).split(',').filter(Boolean).length,
                from: (req.query.from as string) ?? '',
                to: (req.query.to as string) ?? '',
                rows: ctx.auditExtra.rows,
            }),
        },
    },
    async (req, res, ctx) => {
    try {
        const userIds = (req.query.userIds as string)
            .split(',')
            .filter(Boolean);

        // Optional date range (inclusive day keys on the session's own `date`).
        const dateFilter: Record<string, string> = {};
        if (req.query.from) {
            dateFilter.$gte = req.query.from as string;
        }
        if (req.query.to) {
            dateFilter.$lte = req.query.to as string;
        }
        const filter =
            Object.keys(dateFilter).length > 0
                ? {
                      userId: { $in: userIds },
                      date: dateFilter,
                      ...notReplaced,
                  }
                : {
                      userId: { $in: userIds },
                      ...notReplaced,
                  };

        const [users, dayDocs, approvalDocs] = await Promise.all([
            User.find(
                {
                    _id: { $in: userIds },
                    ...notDeleted,
                },
                'name email emailEncrypted dni dniEncrypted'
            ).lean<UserRow[]>(),
            WorkDaySessions.find(filter)
                .sort({ date: 1 })
                .lean<DaySessionsRow[]>(),
            MonthlyApproval.find({
                userId: { $in: userIds },
                status: APPROVAL_APPROVED,
            })
                .select('userId year month')
                .lean<Pick<MonthlyApprovalRow, 'userId' | 'year' | 'month'>[]>(),
        ]);
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));
        // Drops rows of deleted or unknown users.
        const allowedUserIds = new Set(userMap.keys());
        const visibleDayDocs = dayDocs.filter((d) =>
            allowedUserIds.has(d.userId.toString())
        );
        const visibleApprovals = approvalDocs.filter((doc) =>
            allowedUserIds.has(doc.userId.toString())
        );

        // Build approvedMonths set: userId:YYYY-MM format
        const approvedMonths = new Set<string>();
        for (const doc of visibleApprovals) {
            const key = `${doc.userId}:${doc.year}-${String(doc.month).padStart(2, '0')}`;
            approvedMonths.add(key);
        }

        const headers = [
            'Name',
            'DNI',
            'Email',
            'Date',
            'Time',
            'Type',
            'Source',
            'Notes',
            'Overtime',
            'Confirmed',
        ];
        const rows = visibleDayDocs.flatMap((dayDoc) =>
            dayDoc.sessions.map((s) => {
                const monthKey = dayDoc.date.slice(0, 7);
                const userMonthKey = `${dayDoc.userId.toString()}:${monthKey}`;
                const isConfirmed = approvedMonths.has(userMonthKey)
                    ? 'Yes'
                    : 'No';
                return [
                    userMap.get(dayDoc.userId.toString())?.name ?? '',
                    userMap.get(dayDoc.userId.toString())?.dni ?? '',
                    userMap.get(dayDoc.userId.toString())?.email ?? '',
                    dayDoc.date,
                    s.time,
                    s.type,
                    dayDoc.source ?? SOURCE_USER_CLICK,
                    s.notes ?? '',
                    s.overtime ? 'Yes' : 'No',
                    isConfirmed,
                ];
            })
        );

        const csv = toCsv(headers, rows);

        ctx.auditExtra.rows = rows.length;

        const filename = `work_sessions_${dateKey(new Date())}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}"`
        );
        res.status(200).send('\uFEFF' + csv);
    } catch (error) {
        console.error('Admin export work sessions error:', error);
        return responseErrorGet(res);
    }
    }
);
