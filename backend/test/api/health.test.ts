import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../utils/mocks';

vi.mock('mongoose', () => ({
    default: {
        connection: {
            readyState: 1,
        },
    },
}));

import healthHandler from '@/pages/api/health';

describe('GET /api/health', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('JWT_SECRET', 'test-secret-for-testing');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('returns 200 with ok status when configured', async () => {
        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await healthHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'ok',
                database: 'connected',
                jwtConfigured: true,
            })
        );
    });

    it('reports disconnected database and missing jwt secret', async () => {
        const mongoose = await import('mongoose');
        (mongoose.default.connection as any).readyState = 0;
        vi.stubEnv('JWT_SECRET', '');

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await healthHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'ok',
                database: 'disconnected',
                jwtConfigured: false,
            })
        );
    });

    it('returns 405 for non-GET requests', async () => {
        const req = mockReq({ method: 'POST' });
        const res = mockRes();

        await healthHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
    });
});
