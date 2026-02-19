import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { authenticateToken, AuthRequest } from '@/lib/auth';
import { WorkSessionReason } from '@/models';
import { responseErrorGet, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return responseErrorMethodNotAllowed(res);
  }

  try {
    await dbConnect();

    const reasons = await WorkSessionReason.find();

    res.status(200).json({ reasons: reasons });
  } catch (error) {
    console.error('Get work session reasons error:', error);
    return responseErrorGet(res);
  }
}

export default authenticateToken(handler);