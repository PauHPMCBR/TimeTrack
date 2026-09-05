import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { ADMIN_ROLE, SOURCE_USER, SESSION_REPLACED, APPROVAL_APPROVED } from 'shared/src/lib/constants';
import { WorkSession, User, MonthlyApproval } from '@/models';
import {
    responseErrorGet,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { runValidation, validateQueryParams } from '@/lib/validation';
import { UserRow, WorkSessionRow } from '@/lib/rows';
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

    if (
        !(await runValidation(
            validateQueryParams(AdminExportWorkSessionsQuerySchema),
            req,
            res
        ))
    )
        return;

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
                ? {
                      userId: { $in: userIds },
                      timestamp: timestampFilter,
                      status: { $ne: SESSION_REPLACED },
                  }
                : {
                      userId: { $in: userIds },
                      status: { $ne: SESSION_REPLACED },
                  };

        const [users, sessions, approvalDocs] = (await Promise.all([
            User.find(
                {
                    _id: { $in: userIds },
                    deleted: { $ne: true },
                },
                'name email dni'
            ).lean(),
            WorkSession.find(filter)
                .select('userId timestamp type source notes')
                .sort({ timestamp: 1 })
                .lean(),
            MonthlyApproval.find({
                userId: { $in: userIds },
                status: APPROVAL_APPROVED,
            })
                .select('userId year month')
                .lean(),
        ])) as unknown as [UserRow[], WorkSessionRow[], { userId: string; year: number; month: number }[]];
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));
        // Drops rows of deleted or unknown users.
        const allowedUserIds = new Set(userMap.keys());
        const visibleSessions = sessions.filter((s) =>
            allowedUserIds.has(s.userId.toString())
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
            'Timestamp',
            'Type',
            'Source',
            'Notes',
            'Confirmed',
        ];
        const rows = visibleSessions.map((s) => {
            const monthKey = new Date(s.timestamp).toISOString().slice(0, 7);
            const userMonthKey = `${s.userId.toString()}:${monthKey}`;
            const isConfirmed = approvedMonths.has(userMonthKey) ? 'Yes' : 'No';
            return [
                userMap.get(s.userId.toString())?.name ?? '',
                userMap.get(s.userId.toString())?.dni ?? '',
                userMap.get(s.userId.toString())?.email ?? '',
                new Date(s.timestamp).toISOString(),
                s.type,
                s.source ?? SOURCE_USER,
                s.notes ?? '',
                isConfirmed,
            ];
        });

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

export default requireRole([ADMIN_ROLE], handler);
