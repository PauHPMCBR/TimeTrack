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
            date: { $gte: startDate, $lte: endDate },
        };

        const userIdsParam = req.query.userIds as string | undefined;
        if (userIdsParam) {
            const userIds = userIdsParam.split(',').filter(Boolean);
            filter.userId = { $in: userIds };
        }

        const [vacations, users] = (await Promise.all([
            ElectiveVacation.find(filter).sort({ date: 1 }).lean(),
            userIdsParam
                ? User.find(
                      { _id: { $in: userIdsParam.split(',').filter(Boolean) } },
                      'name email dni'
                  ).lean()
                : User.find({}, 'name email dni').lean(),
        ])) as unknown as [
            Array<{
                userId: string;
                date: Date;
                status: string;
                reason?: string;
                notes?: string;
            }>,
            Array<{ _id: { toString(): string }; name: string; email: string; dni: string }>,
        ];

        const userMap = new Map(users.map((u) => [u._id.toString(), u]));

        const headers = ['Name', 'DNI', 'Email', 'Date', 'Status', 'Reason', 'Notes'];
        const rows = vacations.map((v) => [
            userMap.get(v.userId)?.name ?? '',
            userMap.get(v.userId)?.dni ?? '',
            userMap.get(v.userId)?.email ?? '',
            new Date(v.date).toISOString().slice(0, 10),
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
