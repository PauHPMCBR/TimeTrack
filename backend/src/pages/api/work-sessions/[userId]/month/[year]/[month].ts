import { withApi } from '@/lib/api-handler';
import { findActiveInRange } from '@/repositories/work-session-repository';
import { monthRange } from 'shared/src/lib/date-ranges';
import {
    MonthlyWorkRecordResponse,
    YearMonthParamSchema,
} from 'shared/src/schemas/api';
import {
    computeDayHours,
    countCompletedSessions,
} from 'shared/src/lib/work-hours';
import { WorkSessionRow } from '@/lib/rows';

export default withApi(
    { method: 'GET', guard: 'selfOrAdmin', query: YearMonthParamSchema },
    async (req, res, { query }) => {
        const userId = query.userId;
        // Tests stub validateQueryParams as a passthrough, so parse here
        // instead of trusting the schema transform.
        const year = parseInt(String(req.query.year));
        const month = parseInt(String(req.query.month));

        const { start: startOfMonth, end: nextMonth } = monthRange(year, month);

        const sessions = (await findActiveInRange(startOfMonth, nextMonth, {
            userId,
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
    }
);
