import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireSameGroupOrAdmin, AuthRequest } from '@/lib/auth';
import { WorkSession } from '@/models';
import { responseErrorGet, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';
import { validateQueryParams } from '@/lib/validation';
import { MonthlyWorkRecordResponse, YearMonthParamSchema } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return responseErrorMethodNotAllowed(res);
  }

  const validationMiddleware = validateQueryParams(YearMonthParamSchema);
  await new Promise((resolve, reject) => {
    validationMiddleware(req, res, (err?: any) => err ? reject(err) : resolve(true));
  });

  try {
    await dbConnect();

    const userId = req.query.userId as string;
    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);

    const startOfMonth = new Date(year, month-1, 1, 0, 0, 0); // Note: month is 0-indexed in Date constructor
    const nextMonth = (month == 12)
      ? new Date(startOfMonth.getFullYear() + 1, 0, 1)
      : new Date(startOfMonth.getFullYear(), month, 1, 0, 0, 0);

    const sessions = await WorkSession.find({
      userId: userId,
      timestamp: { 
        $gte: startOfMonth, 
        $lt: nextMonth 
      }
    }).sort({ timestamp: 1 });

    // Initialize arrays with 32 elements (index 0 unused, 1-31 for days)
    const sessionsByDay: any[][] = Array(32).fill(null).map(() => []);
    const dailyStats = Array(32).fill(null).map(() => ({
      hoursWorked: 0,
      sessions: 0
    }));

    let totalHoursWorked = 0;
    let totalSessions = sessions.length;
    const daysWithSessionsSet = new Set<number>();

    // Group sessions by day
    sessions.forEach(session => {
      const dayOfMonth = new Date(session.timestamp).getDate();
      sessionsByDay[dayOfMonth].push(session);
      daysWithSessionsSet.add(dayOfMonth);
    });

    // Calculate hours for each day
    for (let day = 1; day <= 31; day++) {
      const daySessions = sessionsByDay[day];
      if (daySessions.length === 0) continue;

      // Sort sessions by timestamp for this day
      daySessions.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let dayHours = 0;
      let checkInTime: Date | null = null;

      // Calculate hours worked by pairing check-ins with check-outs
      for (const session of daySessions) {
        if (session.type === 'check_in') {
          checkInTime = new Date(session.timestamp);
        } else if (session.type === 'check_out' && checkInTime) {
          const checkOutTime = new Date(session.timestamp);
          dayHours += (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
          checkInTime = null;
        }
      }

      // If there's an unmatched check-in at the end of the day, calculate until end of day
      if (checkInTime) {
        const endOfDay = new Date(checkInTime);
        endOfDay.setHours(23, 59, 59, 999);
        dayHours += (endOfDay.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
      }

      dailyStats[day] = {
        hoursWorked: Math.round(dayHours * 100) / 100, // Round to 2 decimal places
        sessions: daySessions.length
      };

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
        dailyStats
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Get user month sessions error:', error);
    return responseErrorGet(res);
  }
}

export default requireSameGroupOrAdmin(handler);