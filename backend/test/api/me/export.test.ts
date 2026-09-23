import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
    requireRole: (
        _roles: string[],
        handler: (req: unknown, res: unknown) => unknown
    ) => handler,
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
import handler from '@/pages/api/me/export';

describe('POST /api/me/export', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(buildExportPayload).mockResolvedValue({
            manifest: { rowCounts: { daily: 1 } },
            documents: { daily: [], monthly: [], history: [] },
        } as any);
        vi.mocked(formatExport).mockResolvedValue({
            filename: 'export_2025-07_2025-08-01.json',
            contentType: 'application/json; charset=utf-8',
            body: Buffer.from('{}'),
        });
    });

    it('scopes the export to the authenticated user', async () => {
        const res = mockRes();
        await handler(
            mockReq({
                method: 'POST',
                body: {
                    year: 2025,
                    month: 7,
                    documents: ['daily'],
                    format: 'json',
                    language: 'ca',
                },
            }),
            res
        );

        expect(buildExportPayload).toHaveBeenCalledWith({
            userIds: ['user-123'],
            year: 2025,
            month: 7,
            documents: ['daily'],
            generatedBy: 'user-123',
            language: 'ca',
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(AuditEvent.create).toHaveBeenCalledWith(
            expect.objectContaining({
                actorId: 'user-123',
                action: 'export_work_sessions',
            })
        );
    });
});
