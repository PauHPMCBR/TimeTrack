import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { WorkSession, User } from '@/models';
import {
    responseErrorGet,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { validateQueryParams } from '@/lib/validation';
import { AdminExportWorkSessionsQuerySchema } from 'shared/src/schemas/api';

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

    const validationMiddleware = validateQueryParams(
        AdminExportWorkSessionsQuerySchema
    );
    await new Promise((resolve) => {
        validationMiddleware(req, res, () => resolve(true));
    });
    if (res.headersSent) return;

    try {
        await dbConnect();

        const userIds = (req.query.userIds as string)
            .split(',')
            .filter(Boolean);

        // Optional date range (inclusive, local day bounds).
        const timestampFilter: Record<string, Date> = {};
        if (req.query.from) {
            const from = new Date(`${req.query.from}T00:00:00`);
            if (isNaN(from.getTime())) {
                return responseErrorIncorrectParameter(res, 'date', [
                    'InvalidTimestamp',
                ]);
            }
            timestampFilter.$gte = from;
        }
        if (req.query.to) {
            const to = new Date(`${req.query.to}T23:59:59.999`);
            if (isNaN(to.getTime())) {
                return responseErrorIncorrectParameter(res, 'date', [
                    'InvalidTimestamp',
                ]);
            }
            timestampFilter.$lte = to;
        }
        const filter =
            Object.keys(timestampFilter).length > 0
                ? { userId: { $in: userIds }, timestamp: timestampFilter }
                : { userId: { $in: userIds } };

        const [users, sessions] = (await Promise.all([
            User.find({ _id: { $in: userIds } }, 'name email dni').lean(),
            WorkSession.find(filter)
                .select('userId timestamp type source reason notes')
                .sort({ timestamp: 1 })
                .lean(),
        ])) as [any[], any[]];
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));

        const headers = [
            'Name',
            'DNI',
            'Email',
            'Timestamp',
            'Type',
            'Source',
            'Reason',
            'Notes',
        ];
        const rows = sessions.map((s) => [
            userMap.get(s.userId.toString())?.name ?? '',
            userMap.get(s.userId.toString())?.dni ?? '',
            userMap.get(s.userId.toString())?.email ?? '',
            new Date(s.timestamp).toISOString(),
            s.type,
            s.source ?? 'user',
            s.reason ?? '',
            s.notes ?? '',
        ]);

        const csv = [headers, ...rows]
            .map((line) => line.map(escapeCsvField).join(','))
            .join('\r\n');

        const filename = `work_sessions_${new Date().toISOString().slice(0, 10)}.csv`;

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

export default requireRole(['admin'], handler);
