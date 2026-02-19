import { NextApiResponse } from 'next';

const rateLimitMap = new Map();

export const rateLimit = (res: NextApiResponse, limit: number = 100, windowMs: number = 15 * 60 * 1000) => {
  const now = Date.now();
  const clientIp = res.socket?.remoteAddress || 'unknown';
  
  if (!rateLimitMap.has(clientIp)) {
    rateLimitMap.set(clientIp, { count: 0, lastReset: now });
  }
  
  const clientData = rateLimitMap.get(clientIp);
  
  // Reset counter if window has passed
  if (now - clientData.lastReset > windowMs) {
    clientData.count = 0;
    clientData.lastReset = now;
  }
  
  // Check if over limit
  if (clientData.count >= limit) {
    return false;
  }
  
  clientData.count++;
  return true;
};