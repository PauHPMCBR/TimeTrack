import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { ElectiveVacation, User } from '@/models';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { runValidation, validateQueryParams } from '@/lib/validation';
import { AdminExportVacationsQuerySchema } from 'shared/src/schemas/api';

function escapeCsvField(value: unknown): string {
    const str = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(
            validateQueryParams(AdminExportVacationsQuerySchema),
            req,
            res
        ))
    )
        return;

    try {
        await dbConnect();

        const year = parseInt(req.query.year as string);

        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

        const filter: Record<string, unknown> = {
            // Intervals overlapping the requested year.
            startDate: { $lte: endDate },
            endDate: { $gte: startDate },
        };

        const userIdsParam = req.query.userIds as string | undefined;
        if (userIdsParam) {
            const userIds = userIdsParam.split(',').filter(Boolean);
            filter.userId = { $in: userIds };
        }

        const [vacations, users, allActiveUsers] = (await Promise.all([
            ElectiveVacation.find(filter).sort({ startDate: 1 }).lean(),
            userIdsParam
                ? User.find(
                      { _id: { $in: userIdsParam.split(',').filter(Boolean) } },
                      'name email dni'
                  ).lean()
                : [],
            User.find(
                {
                    blocked: { $ne: true },
                    registered: true,
                    deleted: { $ne: true },
                },
                'name email dni'
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

        const csv = [headers, ...rows]
            .map((line) => line.map(escapeCsvField).join(','))
            .join('\r\n');

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

export default requireRole([ADMIN_ROLE], handler);
