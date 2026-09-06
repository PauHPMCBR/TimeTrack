import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

// authenticateToken: injects the JWT user + the live DB user the guards reuse.
vi.mock('@/lib/auth', () => ({
    authenticateToken: (handler: (req: unknown, res: unknown) => unknown) => {
        return async (req: any, res: any) => {
            req.user = {
                userId: 'user-1',
                email: 'user@example.com',
                role: 'employee',
            };
            req.dbUser = req.dbUserOverride ?? { _id: 'user-1', role: 'employee' };
            return handler(req, res);
        };
    },
    AuthRequest: class {},
}));

vi.mock('@/models', () => ({
    UserFile: {
        find: vi.fn(),
        aggregate: vi.fn(),
        findById: vi.fn(),
    },
}));

vi.mock('@/lib/storage', () => ({
    readDocument: vi.fn(),
}));

import myFilesHandler from '@/pages/api/files';
import fileDownloadHandler from '@/pages/api/files/[fileId]';
import { UserFile } from '@/models';
import { readDocument } from '@/lib/storage';

const mockAggTotal = (total: number) => {
    vi.mocked(UserFile.aggregate).mockResolvedValue([{ total }]);
};

describe('GET /api/files (my files)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.FILES_STORAGE_QUOTA_BYTES;
        mockAggTotal(50);
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({ method: 'POST' });
        const res = mockRes();

        await myFilesHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
    });

    it('should return the authenticated user files', async () => {
        const sortMock = vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([
                { _id: 'file-1', userId: 'user-1', originalName: 'a.pdf' },
            ]),
        });
        vi.mocked(UserFile.find).mockReturnValue({
            sort: sortMock,
        } as any);

        const req = mockReq({ method: 'GET' });
        const res = mockRes();

        await myFilesHandler(req, res);

        expect(UserFile.find).toHaveBeenCalledWith({ userId: 'user-1' });
        expect(sortMock).toHaveBeenCalledWith({ uploadedAt: -1 });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                files: [
                    expect.objectContaining({ _id: 'file-1' }),
                ],
                totalSize: 50,
                quotaBytes: 1024 * 1024 * 1024,
            },
        });
    });

    it('should honor the sortBy/order query params', async () => {
        const sortMock = vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
        });
        vi.mocked(UserFile.find).mockReturnValue({
            sort: sortMock,
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { sortBy: 'originalName', order: 'asc' },
        });
        const res = mockRes();

        await myFilesHandler(req, res);

        expect(sortMock).toHaveBeenCalledWith({ originalName: 1 });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 for an invalid sortBy value', async () => {
        const req = mockReq({
            method: 'GET',
            query: { sortBy: 'hacked' },
        });
        const res = mockRes();

        await myFilesHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'ValidationError',
            details: expect.any(Object),
        });
    });
});

describe('GET /api/files/[fileId] (download)', () => {
    const fileDoc = {
        _id: 'file-1',
        userId: 'user-1',
        filename: 'user-1-123-abc',
        originalName: 'payslip.pdf',
        mimeType: 'application/pdf',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(readDocument).mockResolvedValue(Buffer.from('%PDF-1.4'));
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not GET', async () => {
        const req = mockReq({ method: 'POST', query: { fileId: 'file-1' } });
        const res = mockRes();

        await fileDownloadHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
    });

    it('should return 404 when the file does not exist', async () => {
        vi.mocked(UserFile.findById).mockResolvedValue(null);

        const req = mockReq({ method: 'GET', query: { fileId: 'missing' } });
        const res = mockRes();

        await fileDownloadHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 for another user file (non-admin)', async () => {
        vi.mocked(UserFile.findById).mockResolvedValue({
            ...fileDoc,
            userId: 'someone-else',
        } as any);

        const req = mockReq({ method: 'GET', query: { fileId: 'file-1' } });
        const res = mockRes();

        await fileDownloadHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'NoAccessToUser',
            details: {},
        });
    });

    it('should serve the file to its owner', async () => {
        vi.mocked(UserFile.findById).mockResolvedValue(fileDoc as any);

        const req = mockReq({ method: 'GET', query: { fileId: 'file-1' } });
        const res = mockRes();
        res.send = vi.fn().mockReturnThis();

        await fileDownloadHandler(req, res);

        expect(res.setHeader).toHaveBeenCalledWith(
            'Content-Type',
            'application/pdf'
        );
        expect(res.setHeader).toHaveBeenCalledWith(
            'Content-Disposition',
            expect.stringContaining('payslip.pdf')
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
    });

    it('should serve the file to an admin', async () => {
        vi.mocked(UserFile.findById).mockResolvedValue({
            ...fileDoc,
            userId: 'someone-else',
        } as any);

        const req = mockReq({
            method: 'GET',
            query: { fileId: 'file-1' },
            dbUserOverride: { _id: 'admin-1', role: 'admin' },
        });
        const res = mockRes();
        res.send = vi.fn().mockReturnThis();

        await fileDownloadHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when the binary is missing from disk', async () => {
        vi.mocked(UserFile.findById).mockResolvedValue(fileDoc as any);
        vi.mocked(readDocument).mockRejectedValue(new Error('ENOENT'));

        const req = mockReq({ method: 'GET', query: { fileId: 'file-1' } });
        const res = mockRes();

        await fileDownloadHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});
