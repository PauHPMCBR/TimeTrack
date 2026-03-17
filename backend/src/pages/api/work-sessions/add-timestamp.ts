import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { authenticateToken, AuthRequest } from '@/lib/auth';
import { WorkSession } from '@/models';
import { responseErrorIncorrectParameter, responseErrorMethodNotAllowed, responseErrorPost } from '@/lib/response-error-generator';
import { validateRequestBody } from '@/lib/validation';
import { WorkSessionRequestSchema } from 'shared/src/schemas/api';
import { CheckInIncorrectParameterReason } from 'shared/src/types/response-errors';

async function verifyInOut(userId: string | undefined, type: string): Promise<CheckInIncorrectParameterReason | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todaySessions = await WorkSession.find({
    userId: userId,
    timestamp: { $gte: today }
  }).sort({ timestamp: -1 });

  const lastSession = todaySessions[0];

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

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return responseErrorMethodNotAllowed(res);
  }

  const validationMiddleware = validateRequestBody(WorkSessionRequestSchema);
  await new Promise((resolve, reject) => {
    validationMiddleware(req, res, (err?: any) => err ? reject(err) : resolve(true));
  });

  const { type, reason, notes } = req.body;

  try {
    await dbConnect();
    
    if (!['check_in', 'check_out'].includes(type)) {
      return responseErrorIncorrectParameter(res, 'type');
    }

    const inOutCheckError = await verifyInOut(req.user?.userId, type);
    if (inOutCheckError !== null) {
      return responseErrorIncorrectParameter(res, 'type', [inOutCheckError])
    }

    const workSession = new WorkSession({
      userId: req.user!.userId,
      type,
      timestamp: new Date(),
      reason,
      notes,
      //ipAddress: req.socket.remoteAddress,
      //userAgent: req.headers['user-agent']
    });

    await workSession.save();

    let hoursWorked = null;
    if (type === 'check_out') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const sessions = await WorkSession.find({
        userId: req.user!.userId,
        timestamp: { $gte: today }
      }).sort({ timestamp: 1 });

      let totalMs = 0;
      for (let i = 0; i < sessions.length; i += 2) {
        if (sessions[i].type === 'check_in' && sessions[i + 1]?.type === 'check_out') {
          totalMs += sessions[i + 1].timestamp.getTime() - sessions[i].timestamp.getTime();
        }
      }
      
      hoursWorked = totalMs / (1000 * 60 * 60);
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
