import { withApi } from '@/lib/api-handler';
import { findActiveDaySessions } from '@/repositories/work-day-sessions-repository';
import {
    addDaysToKey,
    dateKeyFromParts,
    daysInMonth,
} from 'shared/src/lib/day-key';
import type { DateKey } from 'shared/src/lib/day-key';
import {
    MonthlyWorkRecordResponse,
    YearMonthParamSchema,
} from 'shared/src/schemas/api';
import {
    computeDayHours,
    countCompletedSessions,
} from 'shared/src/lib/work-hours';
import type { DaySessionRow } from '@/lib/rows';

export default withApi(
    { method: 'GET', guard: 'selfOrAdmin', query: YearMonthParamSchema },
    async (req, res, { query }) => {
        const userId = query.userId;
        // Tests stub validateQueryParams as a passthrough, so parse here
        // instead of trusting the schema transform.
        const year = parseInt(String(req.query.year));
        const month = parseInt(String(req.query.month));

        const firstKey = dateKeyFromParts(year, month, 1);
        const lastKey = addDaysToKey(firstKey, daysInMonth(year, month) - 1);

        const dayDocs = await findActiveDaySessions(firstKey, lastKey, {
            userId,
        })
            .sort({ date: 1 })
            .lean<{ date: DateKey; sessions: DaySessionRow[] }[]>();

        // Initialize arrays with 32 elements (index 0 unused, 1-31 for days)
        const sessionsByDay: DaySessionRow[][] = Array(32)
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

        dayDocs.forEach((dayDoc) => {
            const dayOfMonth = Number(dayDoc.date.slice(8, 10));
            sessionsByDay[dayOfMonth] = dayDoc.sessions;
            daysWithSessionsSet.add(dayOfMonth);

            // An unmatched trailing check-in counts until end of day so
            // forgotten check-outs don't undercount the day.
            const dayHours = computeDayHours(dayDoc.sessions, {
                countOpenUntil: '24:00',
                round: false,
            }).totalHours;

            // A "session" is a completed check-in/check-out pair; isolated
            // check-ins/outs (forgot check-out/in) are anomalies, not sessions.
            const completedSessions = countCompletedSessions(dayDoc.sessions);

            dailyStats[dayOfMonth] = {
                hoursWorked: Math.round(dayHours * 100) / 100,
                sessions: completedSessions,
            };

            totalSessions += completedSessions;
            totalHoursWorked += dayHours;
        });

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
