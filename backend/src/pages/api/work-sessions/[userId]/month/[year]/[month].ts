import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireSameGroupOrAdmin, AuthRequest } from '@/lib/auth';
import { WorkSession } from '@/models';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { runValidation, validateQueryParams } from '@/lib/validation';
import {
    MonthlyWorkRecordResponse,
    YearMonthParamSchema,
} from 'shared/src/schemas/api';
import {
    computeDayHours,
    countCompletedSessions,
} from 'shared/src/lib/work-hours';
import { WorkSessionRow } from '@/lib/rows';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(
            validateQueryParams(YearMonthParamSchema),
            req,
            res
        ))
    )
        return;

    try {
        await dbConnect();

        const userId = req.query.userId as string;
        const year = parseInt(req.query.year as string);
        const month = parseInt(req.query.month as string);

        const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0); // Note: month is 0-indexed in Date constructor
        const nextMonth =
            month == 12
                ? new Date(startOfMonth.getFullYear() + 1, 0, 1)
                : new Date(startOfMonth.getFullYear(), month, 1, 0, 0, 0);

        const sessions = (await WorkSession.find({
            userId: userId,
            timestamp: {
                $gte: startOfMonth,
                $lt: nextMonth,
            },
        })
            .sort({ timestamp: 1 })
            .lean()) as unknown as WorkSessionRow[];

        // Initialize arrays with 32 elements (index 0 unused, 1-31 for days)
        const sessionsByDay: WorkSessionRow[][] = Array(32)
            .fill(null)
            .map(() => []);
        const dailyStats = Array(32)
            .fill(null)
            .map(() => ({
                hoursWorked: 0,
                sessions: 0,
            }));

        let totalHoursWorked = 0;
        let totalSessions = 0;
        const daysWithSessionsSet = new Set<number>();

        sessions.forEach((session) => {
            const dayOfMonth = new Date(session.timestamp).getDate();
            sessionsByDay[dayOfMonth].push(session);
            daysWithSessionsSet.add(dayOfMonth);
        });

        for (let day = 1; day <= 31; day++) {
            const daySessions = sessionsByDay[day];
            if (daySessions.length === 0) continue;

            // Sessions arrive globally sorted by timestamp, and grouping preserves
            // that order per day, so no re-sort is needed here.

            // An unmatched trailing check-in counts until end of day so forgotten
            // check-outs don't undercount the day.
            const endOfDay = new Date(
                new Date(daySessions[0].timestamp).setHours(23, 59, 59, 999)
            );
            const dayHours = computeDayHours(daySessions, {
                countOpenUntil: endOfDay,
                round: false,
            }).totalHours;

            // A "session" is a completed check-in/check-out pair; isolated
            // check-ins/outs (forgot check-out/in) are anomalies, not sessions.
            const completedSessions = countCompletedSessions(daySessions);

            dailyStats[day] = {
                hoursWorked: Math.round(dayHours * 100) / 100,
                sessions: completedSessions,
            };

            totalSessions += completedSessions;
            totalHoursWorked += dayHours;
        }

        const response: MonthlyWorkRecordResponse = {
            userId,
            year,
            month,
            sessionsByDay,
            summary: {
                totalSessions,
                totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
                daysWithSessions: daysWithSessionsSet.size,
                dailyStats,
            },
        };

        res.status(200).json({
            success: true,
            data: response,
        });
    } catch (error) {
        console.error('Get user month sessions error:', error);
        return responseErrorGet(res);
    }
}

export default requireSameGroupOrAdmin(handler);
