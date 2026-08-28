import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res
            .status(405)
            .json({ success: false, error: 'MethodNotAllowed', details: {} });
    }

    // readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
    const dbState = mongoose.connection.readyState;

    res.status(200).json({
        status: 'ok',
        database:
            dbState === 1
                ? 'connected'
                : dbState === 2
                  ? 'connecting'
                  : 'disconnected',
        jwtConfigured: Boolean(process.env.JWT_SECRET),
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
    });
}
