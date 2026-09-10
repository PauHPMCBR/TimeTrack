import { withApi } from '@/lib/api-handler';
import { toCsv } from 'shared/src/lib/csv';
import { yearRange } from 'shared/src/lib/date-ranges';
import { User } from '@/models';
import { findOverlapping } from '@/repositories/vacation-repository';
import { responseErrorGet } from '@/lib/response-error-generator';
import { notDeleted } from '@/repositories/user-repository';
import { AdminExportVacationsQuerySchema } from 'shared/src/schemas/api';


export default withApi(
    { method: 'GET', guard: 'admin', query: AdminExportVacationsQuerySchema },
    async (_req, res) => {
    try {
        const year = parseInt(String(_req.query.year));

        const { start: startDate, end: endDate } = yearRange(year);

        const userIdsParam = _req.query.userIds as string | undefined;
        const userIds = userIdsParam?.split(',').filter(Boolean);

        const [vacations, users, allActiveUsers] = (await Promise.all([
            findOverlapping(
                startDate,
                endDate,
                userIds ? { userId: { $in: userIds } } : {}
            )
                .sort({ startDate: 1 })
                .lean(),
            userIds
                ? User.find({ _id: { $in: userIds } }, 'name email emailEncrypted dni dniEncrypted').lean()
                : [],
            User.find(
                {
                    blocked: { $ne: true },
                    registered: true,
                    ...notDeleted,
                },
                'name email emailEncrypted dni dniEncrypted'
            ).lean(),
        ])) as unknown as [
            Array<{
                userId: string;
                startDate: Date;
                endDate: Date;
                spentDays: number;
                status: string;
                reason?: string;
                notes?: string;
            }>,
            Array<{ _id: { toString(): string }; name: string; email: string; dni: string }>,
            Array<{ _id: { toString(): string }; name: string; email: string; dni: string }>,
        ];

        // When exporting every employee (no explicit selection) only include
        // active (registered, non-blocked) users' vacations.
        const activeUserIds = new Set(
            allActiveUsers.map((u) => u._id.toString())
        );
        const visibleVacations = vacations.filter(
            (v) =>
                userIdsParam ||
                activeUserIds.has(v.userId?.toString() ?? '')
        );

        const userMap = new Map(
            (userIdsParam ? users : allActiveUsers).map((u) => [
                u._id.toString(),
                u,
            ])
        );

        const headers = [
            'Name',
            'DNI',
            'Email',
            'Start Date',
            'End Date',
            'Spent Days',
            'Status',
            'Reason',
            'Notes',
        ];
        const rows = visibleVacations.map((v) => [
            userMap.get(v.userId)?.name ?? '',
            userMap.get(v.userId)?.dni ?? '',
            userMap.get(v.userId)?.email ?? '',
            new Date(v.startDate).toISOString().slice(0, 10),
            new Date(v.endDate).toISOString().slice(0, 10),
            v.spentDays,
            v.status,
            v.reason ?? '',
            v.notes ?? '',
        ]);

        const csv = toCsv(headers, rows);

        const filename = `vacations_${year}_${new Date().toISOString().slice(0, 10)}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}"`
        );
        res.status(200).send('\uFEFF' + csv);
    } catch (error) {
        console.error('Admin export vacations error:', error);
        return responseErrorGet(res);
    }
    }
);
