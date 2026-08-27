import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { authenticateToken, AuthRequest } from '@/lib/auth';
import { WorkSession } from '@/models';
import { responseErrorIncorrectParameter, responseErrorMethodNotAllowed, responseErrorPost } from '@/lib/response-error-generator';
import { validateRequestBody } from '@/lib/validation';
import { WorkSessionRequestSchema } from 'shared/src/schemas/api';
import { CheckInIncorrectParameterReason } from 'shared/src/types/response-errors';

// Fetches today's sessions once (ascending) and derives both the last-session
// type (for the check_in/check_out guard) and the day's worked hours from it.
async function getTodaySessions(userId: string | undefined): Promise<any[]> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return WorkSession.find({
    userId: userId,
    timestamp: { $gte: today }
  }).sort({ timestamp: 1 });
}

function verifyInOut(lastSession: any, type: string): CheckInIncorrectParameterReason | null {
  if (type === 'check_in') {
    if (lastSession && lastSession.type === 'check_in') {
      return 'AlreadyCheckedIn';
    }
  } else if (type === 'check_out') {
    if (!lastSession) {
      return 'NoEntryToday';
    }
    if (lastSession.type === 'check_out') {
      return 'AlreadyCheckedOut';
    }
  }

  return null;
}

function computeTodayHours(sessions: any[]): number {
  let totalMs = 0;
  let lastCheckIn: Date | null = null;

  for (const session of sessions) {
    if (session.type === 'check_in') {
      lastCheckIn = session.timestamp;
    } else if (session.type === 'check_out' && lastCheckIn) {
      totalMs += session.timestamp.getTime() - lastCheckIn.getTime();
      lastCheckIn = null;
    }
  }

  return totalMs / (1000 * 60 * 60);
}

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return responseErrorMethodNotAllowed(res);
  }

  const validationMiddleware = validateRequestBody(WorkSessionRequestSchema);
  await new Promise((resolve) => {
    validationMiddleware(req, res, () => resolve(true));
  });
  if (res.headersSent) return;

  const { type, reason, notes } = req.body;

  try {
    await dbConnect();

    if (!['check_in', 'check_out'].includes(type)) {
      return responseErrorIncorrectParameter(res, 'type');
    }

    const todaySessions = await getTodaySessions(req.user?.userId);
    const inOutCheckError = verifyInOut(todaySessions[todaySessions.length - 1], type);
    if (inOutCheckError !== null) {
      return responseErrorIncorrectParameter(res, 'type', [inOutCheckError])
    }

    const workSession = new WorkSession({
      userId: req.user!.userId,
      type,
      timestamp: new Date(),
      source: 'user',
      reason,
      notes,
    });

    await workSession.save();

    let hoursWorked = null;
    if (type === 'check_out') {
      hoursWorked = computeTodayHours([...todaySessions, workSession]);
    }

    res.status(201).json({
      message: type === 'check_in' ? 'CheckInRegistered' : 'CheckOutRegistered',
      session: workSession,
      hoursWorked
    });
  } catch (error) {
    console.error('Work session error:', error);
    return responseErrorPost(res);
  }
}

export default authenticateToken(handler);
