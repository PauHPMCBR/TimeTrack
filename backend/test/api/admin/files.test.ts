import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReq, mockRes } from '../../utils/mocks';

vi.mock('@/lib/mongodb', () => ({
    default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/auth', () => ({
    requireRole: (
        roles: string[],
        handler: (req: unknown, res: unknown) => unknown
    ) => {
        return async (req: any, res: any) => {
            req.user = {
                userId: 'admin-123',
                email: 'admin@example.com',
                role: 'admin',
            };
            req.dbUser = { _id: 'admin-123', role: 'admin' };
            return handler(req, res);
        };
    },
    AuthRequest: class {},
}));

vi.mock('@/models', () => ({
    User: {
        findOne: vi.fn(),
        find: vi.fn(),
    },
    UserFile: {
        find: vi.fn(),
        create: vi.fn(),
        findById: vi.fn(),
        findByIdAndDelete: vi.fn(),
        findByIdAndUpdate: vi.fn(),
        aggregate: vi.fn(),
    },
}));

vi.mock('@/lib/storage', () => ({
    saveDocument: vi.fn(),
    readDocument: vi.fn(),
    deleteDocument: vi.fn(),
}));

vi.mock('@/lib/mail', () => ({
    sendNewFileEmail: vi.fn(),
}));

import adminFilesHandler from '@/pages/api/admin/files';
import adminFileDeleteHandler from '@/pages/api/admin/files/[fileId]';
import { User, UserFile } from '@/models';
import { saveDocument, deleteDocument } from '@/lib/storage';
import { sendNewFileEmail } from '@/lib/mail';

const AGGREGATE_TOTAL = 100;

const mockAggTotal = (total: number) => {
    vi.mocked(UserFile.aggregate).mockResolvedValue([{ total }]);
};

const mockFileDocs = (docs: any[]) => {
    vi.mocked(UserFile.find).mockReturnValue({
        sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(docs),
        }),
    } as any);
};

const base64DataUrl = (bytes: number) =>
    `data:application/pdf;base64,${Buffer.alloc(bytes, 1).toString('base64')}`;

describe('GET /api/admin/files', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.FILES_STORAGE_QUOTA_BYTES;
        mockAggTotal(AGGREGATE_TOTAL);
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 405 if method is not GET/POST', async () => {
        const req = mockReq({ method: 'PUT' });
        const res = mockRes();

        await adminFilesHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'MethodNotAllowed',
            details: {},
        });
    });

    it('should return 200 with files, totalSize and quotaBytes', async () => {
        mockFileDocs([
            { _id: 'file-1', userId: 'user-1', originalName: 'a.pdf', size: 10 },
        ]);
        vi.mocked(User.find).mockReturnValue({
            select: vi.fn().mockReturnValue({
                lean: vi
                    .fn()
                    .mockResolvedValue([{ _id: 'user-1', name: 'Anna' }]),
            }),
        } as any);

        const req = mockReq({ method: 'GET', query: {} });
        const res = mockRes();

        await adminFilesHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                files: [
                    expect.objectContaining({
                        _id: 'file-1',
                        userName: 'Anna',
                    }),
                ],
                totalSize: AGGREGATE_TOTAL,
                quotaBytes: 1024 * 1024 * 1024,
            },
        });
    });

    it('should return 500 on database error', async () => {
        vi.mocked(UserFile.find).mockRejectedValue(new Error('DB Error'));

        const req = mockReq({ method: 'GET', query: {} });
        const res = mockRes();

        await adminFilesHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'GetError',
            details: {},
        });
    });
});

describe('POST /api/admin/files', () => {
    const validBody = {
        userId: 'user-1',
        originalName: '/tmp/payslip.pdf',
        description: 'Payroll',
        dataUrl: `data:application/pdf;base64,${Buffer.from('%PDF-1.4').toString('base64')}`,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.FILES_STORAGE_QUOTA_BYTES;
        delete process.env.FILE_MAX_BYTES;
        mockAggTotal(AGGREGATE_TOTAL);
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 404 when the target user does not exist', async () => {
        vi.mocked(User.findOne).mockReturnValue({
            select: vi.fn().mockResolvedValue(null),
        } as any);

        const req = mockReq({ method: 'POST', body: validBody });
        const res = mockRes();

        await adminFilesHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'EntryNotFound',
            details: { entry: 'User' },
        });
    });

    it('should return 400 InvalidFileData for an empty payload', async () => {
        vi.mocked(User.findOne).mockReturnValue({
            select: vi.fn().mockResolvedValue({
                _id: 'user-1',
                name: 'Anna',
                email: 'anna@example.com',
                notifyNewFile: true,
            }),
        } as any);

        const req = mockReq({
            method: 'POST',
            body: { ...validBody, dataUrl: 'data:application/pdf;base64,' },
        });
        const res = mockRes();

        await adminFilesHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IncorrectParameter',
            details: {
                incorrectParameter: 'file',
                reasons: ['InvalidFileData'],
            },
        });
    });

    it('should return 400 FileTooLarge when the file exceeds the cap', async () => {
        vi.mocked(User.findOne).mockReturnValue({
            select: vi.fn().mockResolvedValue({
                _id: 'user-1',
                name: 'Anna',
                email: 'anna@example.com',
                notifyNewFile: true,
            }),
        } as any);

        const req = mockReq({
            method: 'POST',
            body: { ...validBody, dataUrl: base64DataUrl(10 * 1024 * 1024 + 1) },
        });
        const res = mockRes();

        await adminFilesHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IncorrectParameter',
            details: {
                incorrectParameter: 'file',
                reasons: ['FileTooLarge'],
            },
        });
        expect(saveDocument).not.toHaveBeenCalled();
    });

    it('should honor the FILE_MAX_BYTES env override', async () => {
        vi.mocked(User.findOne).mockReturnValue({
            select: vi.fn().mockResolvedValue({
                _id: 'user-1',
                name: 'Anna',
                email: 'anna@example.com',
                notifyNewFile: true,
            }),
        } as any);
        process.env.FILE_MAX_BYTES = '10';

        const req = mockReq({
            method: 'POST',
            body: { ...validBody, dataUrl: base64DataUrl(11) },
        });
        const res = mockRes();

        await adminFilesHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IncorrectParameter',
            details: {
                incorrectParameter: 'file',
                reasons: ['FileTooLarge'],
            },
        });
    });

    it('should return 400 StorageQuotaExceeded when the upload would exceed the quota', async () => {
        vi.mocked(User.findOne).mockReturnValue({
            select: vi.fn().mockResolvedValue({
                _id: 'user-1',
                name: 'Anna',
                email: 'anna@example.com',
                notifyNewFile: true,
            }),
        } as any);
        process.env.FILES_STORAGE_QUOTA_BYTES = String(
            AGGREGATE_TOTAL + 10
        );

        const req = mockReq({
            method: 'POST',
            body: { ...validBody, dataUrl: base64DataUrl(11) },
        });
        const res = mockRes();

        await adminFilesHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'IncorrectParameter',
            details: {
                incorrectParameter: 'file',
                reasons: ['StorageQuotaExceeded'],
            },
        });
    });

    it('should create the file and send the notification email', async () => {
        vi.mocked(User.findOne).mockReturnValue({
            select: vi.fn().mockResolvedValue({
                _id: 'user-1',
                name: 'Anna',
                email: 'anna@example.com',
                notifyNewFile: true,
            }),
        } as any);
        vi.mocked(saveDocument).mockResolvedValue('user-1-123-abc');
        vi.mocked(UserFile.create).mockResolvedValue({
            toObject: () => ({
                userId: 'user-1',
                filename: 'user-1-123-abc',
                originalName: 'payslip.pdf',
                description: 'Payroll',
                mimeType: 'application/pdf',
                size: 8,
                uploadedBy: 'admin-123',
            }),
        } as any);

        const req = mockReq({ method: 'POST', body: validBody });
        const res = mockRes();

        await adminFilesHandler(req, res);

        expect(saveDocument).toHaveBeenCalledWith('user-1', expect.any(Buffer));
        expect(UserFile.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                originalName: 'payslip.pdf',
                mimeType: 'application/pdf',
                uploadedBy: 'admin-123',
            })
        );
        expect(sendNewFileEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'anna@example.com',
                fileName: 'payslip.pdf',
            })
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should skip the email when the user opted out', async () => {
        vi.mocked(User.findOne).mockReturnValue({
            select: vi.fn().mockResolvedValue({
                _id: 'user-1',
                name: 'Anna',
                email: 'anna@example.com',
                notifyNewFile: false,
            }),
        } as any);
        vi.mocked(saveDocument).mockResolvedValue('user-1-123-abc');
        vi.mocked(UserFile.create).mockResolvedValue({
            toObject: () => ({ userId: 'user-1', filename: 'user-1-123-abc' }),
        } as any);

        const req = mockReq({ method: 'POST', body: validBody });
        const res = mockRes();

        await adminFilesHandler(req, res);

        expect(sendNewFileEmail).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });
});

describe('DELETE /api/admin/files/[fileId]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 404 when the file does not exist', async () => {
        vi.mocked(UserFile.findById).mockResolvedValue(null);

        const req = mockReq({
            method: 'DELETE',
            query: { fileId: 'missing' },
        });
        const res = mockRes();

        await adminFileDeleteHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'EntryNotFound',
            details: { entry: 'File' },
        });
        expect(deleteDocument).not.toHaveBeenCalled();
    });

    it('should delete the file from disk and database', async () => {
        vi.mocked(UserFile.findById).mockResolvedValue({
            _id: 'file-1',
            filename: 'user-1-123-abc',
        } as any);
        vi.mocked(UserFile.findByIdAndDelete).mockResolvedValue({} as any);

        const req = mockReq({
            method: 'DELETE',
            query: { fileId: 'file-1' },
        });
        const res = mockRes();

        await adminFileDeleteHandler(req, res);

        expect(deleteDocument).toHaveBeenCalledWith('user-1-123-abc');
        expect(UserFile.findByIdAndDelete).toHaveBeenCalledWith('file-1');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { deleted: true },
        });
    });
});

describe('PUT /api/admin/files/[fileId] (edit)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should return 404 when the file does not exist', async () => {
        vi.mocked(UserFile.findByIdAndUpdate).mockResolvedValue(null);

        const req = mockReq({
            method: 'PUT',
            query: { fileId: 'missing' },
            body: { originalName: 'renamed.pdf' },
        });
        const res = mockRes();

        await adminFileDeleteHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'EntryNotFound',
            details: { entry: 'File' },
        });
    });

    it('should rename the file and refresh the upload date', async () => {
        vi.mocked(UserFile.findByIdAndUpdate).mockResolvedValue({
            _id: 'file-1',
            userId: 'user-1',
            originalName: 'renamed.pdf',
            toObject: () => ({
                userId: 'user-1',
                originalName: 'renamed.pdf',
            }),
        } as any);

        const req = mockReq({
            method: 'PUT',
            query: { fileId: 'file-1' },
            body: {
                originalName: '/tmp/renamed.pdf',
                description: 'Updated description',
            },
        });
        const res = mockRes();

        await adminFileDeleteHandler(req, res);

        expect(UserFile.findByIdAndUpdate).toHaveBeenCalledWith(
            'file-1',
            expect.objectContaining({
                originalName: 'renamed.pdf',
                description: 'Updated description',
                uploadedAt: expect.any(Date),
                updatedAt: expect.any(Date),
            }),
            { new: true }
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { file: expect.objectContaining({ originalName: 'renamed.pdf' }) },
        });
    });

    it('should return 500 on database error', async () => {
        vi.mocked(UserFile.findByIdAndUpdate).mockRejectedValue(
            new Error('DB Error')
        );

        const req = mockReq({
            method: 'PUT',
            query: { fileId: 'file-1' },
            body: { originalName: 'renamed.pdf' },
        });
        const res = mockRes();

        await adminFileDeleteHandler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: 'PutError',
            details: {},
        });
    });
});
