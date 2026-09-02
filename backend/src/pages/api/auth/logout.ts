import { NextApiRequest, NextApiResponse } from 'next';
import { clearAuthCookie } from '@/lib/auth';
import {
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';

// POST /api/auth/logout — clears the httpOnly session cookie. The cookie was
// set with HttpOnly so the frontend cannot remove it itself; it must call this
// endpoint (with credentials) so the browser expires the cookie on the backend.
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    clearAuthCookie(res);
    res.status(200).json({ success: true, data: { success: true } });
}

export default handler;
