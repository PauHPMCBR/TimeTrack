import type { NextApiRequest, NextApiResponse } from 'next';

// Minimal, unauthenticated probe for load balancers / healthchecks
// (deploy scripts grep for "ok"). No config or DB details are exposed.
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res
            .status(405)
            .json({ success: false, error: 'MethodNotAllowed', details: {} });
    }

    res.status(200).json({ ok: true });
}
