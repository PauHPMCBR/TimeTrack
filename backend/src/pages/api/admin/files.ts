import type { NextApiResponse } from 'next';
import path from 'path';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { User, UserFile } from '@/models';
import {
    responseErrorEntryNotFound,
    responseErrorGet,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import {
    runValidation,
    validateQueryParams,
    validateRequestBody,
} from '@/lib/validation';
import {
    AdminFilesQuerySchema,
    FileRow,
    FileUploadRequestSchema,
} from 'shared/src/schemas/api';
import {
    getFilesMaxBytes,
    getFilesQuotaBytes,
    getFilesTotalSizeBytes,
} from '@/lib/files';
import { saveDocument } from '@/lib/storage';
import { sendNewFileEmail } from '@/lib/mail';
import { getFrontendUrl } from '@/lib/frontend-url';
import { ADMIN_ROLE } from 'shared/src/lib/constants';

export const config = {
    api: {
        // 10 MB binary → ~13.3 MB base64 → the JSON body fits in 16mb.
        bodyParser: { sizeLimit: '16mb' },
    },
};

const DATA_URL_MIME_PATTERN = /^data:([\w.+-]+\/[\w.+-]+);base64,/;

function toRow(doc: Record<string, unknown>, userName?: string): FileRow {
    return { ...doc, _id: String(doc._id), userName } as FileRow;
}

async function handleGet(req: AuthRequest, res: NextApiResponse) {
    if (
        !(await runValidation(
            validateQueryParams(AdminFilesQuerySchema),
            req,
            res
        ))
    )
        return;

    const { userId, sortBy = 'uploadedAt', order = 'desc' } = req.query;

    try {
        await dbConnect();

        const filter: Record<string, unknown> = {};
        if (userId) filter.userId = userId;

        const sortDir = order === 'asc' ? 1 : -1;
        const sortField = String(sortBy);
        const files = (
            await UserFile.find(filter)
                .sort({ [sortField]: sortDir })
                .lean()
        ) as unknown as Record<string, unknown>[];

        // Resolve the owner display names in one query.
        const ownerIds = Array.from(
            new Set(files.map((f) => String(f.userId)))
        );
        const owners = ownerIds.length
            ? ((await User.find({ _id: { $in: ownerIds } })
                  .select('name')
                  .lean()) as unknown as {
                  _id: { toString(): string };
                  name: string;
              }[])
            : [];
        const nameById = new Map(owners.map((u) => [String(u._id), u.name]));

        const rows = files.map((f) =>
            toRow(f, nameById.get(String(f.userId)))
        );

        const totalSize = await getFilesTotalSizeBytes();

        res.status(200).json({
            success: true,
            data: {
                files: rows,
                totalSize,
                quotaBytes: getFilesQuotaBytes(),
            },
        });
    } catch (error) {
        console.error('List files error:', error);
        return responseErrorGet(res);
    }
}

async function handlePost(req: AuthRequest, res: NextApiResponse) {
    if (
        !(await runValidation(
            validateRequestBody(FileUploadRequestSchema),
            req,
            res
        ))
    )
        return;

    const { userId, description, dataUrl } = req.body;
    // Employee-facing name: keep only the basename (never a client path).
    const originalName = path
        .basename(String(req.body.originalName))
        .slice(0, 255);

    try {
        await dbConnect();

        const target = await User.findOne({
            _id: userId,
            deleted: { $ne: true },
        }).select('name email notifyNewFile');
        if (!target) {
            return responseErrorEntryNotFound(res, 'User');
        }

        const match = DATA_URL_MIME_PATTERN.exec(dataUrl);
        const buffer = match
            ? Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
            : null;

        if (!match || !buffer || buffer.length === 0) {
            return responseErrorIncorrectParameter(res, 'file', [
                'InvalidFileData',
            ]);
        }
        if (buffer.length > getFilesMaxBytes()) {
            return responseErrorIncorrectParameter(res, 'file', [
                'FileTooLarge',
            ]);
        }

        const used = await getFilesTotalSizeBytes();
        if (used + buffer.length > getFilesQuotaBytes()) {
            return responseErrorIncorrectParameter(res, 'file', [
                'StorageQuotaExceeded',
            ]);
        }

        const filename = await saveDocument(userId, buffer);
        const doc = await UserFile.create({
            userId,
            filename,
            originalName,
            description: description ?? '',
            mimeType: match[1],
            size: buffer.length,
            uploadedBy: req.user!.userId,
            uploadedAt: new Date(),
        });

        // Best-effort notification; never breaks the upload.
        if (target.notifyNewFile !== false && target.email) {
            void sendNewFileEmail({
                to: target.email,
                name: target.name,
                fileName: originalName,
                description: description,
                filesUrl: `${getFrontendUrl()}/files`,
            });
        }

        res.status(200).json({
            success: true,
            data: { file: toRow(doc.toObject() as Record<string, unknown>) },
        });
    } catch (error) {
        console.error('Upload file error:', error);
        return responseErrorPost(res);
    }
}

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method === 'GET') return handleGet(req, res);
    if (req.method === 'POST') return handlePost(req, res);
    return responseErrorMethodNotAllowed(res);
}

export default requireRole([ADMIN_ROLE], handler);
