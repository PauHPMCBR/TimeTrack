import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockReq, mockRes } from '../../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
    requireRole: (
        _roles: string[],
        handler: (req: unknown, res: unknown) => unknown
    ) => {
        return async (req: any, res: any) => {
            req.user = { userId: 'admin-123', role: 'admin' };
            return handler(req, res);
        };
    },
    authenticateToken: (handler: (req: unknown, res: unknown) => unknown) => {
        return async (req: any, res: any) => {
            req.user = { userId: 'user-123' };
            return handler(req, res);
        };
    },
    AuthRequest: class {},
}));

vi.mock('@/lib/validation', () => ({
    runValidation: async (middleware: any, req: any, res: any) => {
        await new Promise((resolve) =>
            middleware(req, res, () => resolve(true))
        );
        return !res.headersSent;
    },
    validateQueryParams:
        () => (req: any, res: any, next: (err?: unknown) => void) => next(),
    validateRequestBody:
        () => (req: any, res: any, next: (err?: unknown) => void) => next(),
}));

vi.mock('@/lib/export/build', () => ({
    buildExportPayload: vi.fn(),
}));

vi.mock('@/lib/export/format', () => ({
    formatExport: vi.fn(),
}));

vi.mock('@/models', () => ({
    AuditEvent: { create: vi.fn().mockResolvedValue({}) },
}));

import { buildExportPayload } from '@/lib/export/build';
import { formatExport } from '@/lib/export/format';
import { AuditEvent } from '@/models';
import handler from '@/pages/api/admin/export';

const requestBody = {
    year: 2025,
    month: 7,
    userIds: ['u1', 'u2'],
    documents: ['daily'],
    format: 'csv',
    language: 'en',
};

describe('POST /api/admin/export', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(buildExportPayload).mockResolvedValue({
            manifest: { rowCounts: { daily: 2 } },
            documents: { daily: [], monthly: [], history: [] },
        } as any);
        vi.mocked(formatExport).mockResolvedValue({
            filename: 'export_2025-07_2025-08-01.zip',
            contentType: 'application/zip',
            body: Buffer.from('zip'),
        });
    });

    it('should return 405 if method is not POST', async () => {
        const res = mockRes();
        await handler(mockReq({ method: 'GET' }), res);
        expect(res.status).toHaveBeenCalledWith(405);
    });

    it('builds, formats and sends the export', async () => {
        const res = mockRes();
        await handler(mockReq({ method: 'POST', body: requestBody }), res);

        expect(buildExportPayload).toHaveBeenCalledWith({
            userIds: ['u1', 'u2'],
            year: 2025,
            month: 7,
            documents: ['daily'],
            generatedBy: 'admin-123',
            language: 'en',
        });
        expect(formatExport).toHaveBeenCalledWith(
            'csv',
            expect.objectContaining({ manifest: expect.anything() })
        );
        expect(res.setHeader).toHaveBeenCalledWith(
            'Content-Type',
            'application/zip'
        );
        expect(res.setHeader).toHaveBeenCalledWith(
            'Content-Disposition',
            'attachment; filename="export_2025-07_2025-08-01.zip"'
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));

        expect(AuditEvent.create).toHaveBeenCalledWith(
            expect.objectContaining({
                actorId: 'admin-123',
                action: 'export_work_sessions',
                metadata: expect.stringContaining('"rows":2'),
            })
        );
    });

    it('should return 500 when building fails', async () => {
        vi.mocked(buildExportPayload).mockRejectedValue(new Error('boom'));
        const res = mockRes();
        await handler(mockReq({ method: 'POST', body: requestBody }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'PostError',
            details: {},
        });
    });
});
