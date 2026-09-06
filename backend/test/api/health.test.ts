import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockReq, mockRes } from '../utils/mocks';

import healthHandler from '@/pages/api/health';

describe('GET /api/health', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns a minimal 200 payload without config details', async () => {
        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await healthHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it('leaks no environment or database information', async () => {
        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await healthHandler(req, res);

        const payload = res.json.mock.calls[0][0] as Record<string, unknown>;
        expect(Object.keys(payload)).toEqual(['ok']);
        expect(payload).not.toHaveProperty('jwtConfigured');
        expect(payload).not.toHaveProperty('database');
        expect(payload).not.toHaveProperty('uptime');
    });

    it('returns 405 for non-GET requests', async () => {
        const req = mockReq({ method: 'POST' });
        const res = mockRes();

        await healthHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
    });
});
