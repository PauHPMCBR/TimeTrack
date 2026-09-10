import path from 'path';
import { withApi } from '@/lib/api-handler';
import { UserFile } from '@/models';
import {
    responseErrorEntryNotFound,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { FileIdParamSchema, FileUpdateRequestSchema } from 'shared/src/schemas/api';
import { deleteDocument } from '@/lib/storage';
import type { NextApiRequest, NextApiResponse } from 'next';

const deleteHandler = withApi(
    {
        method: 'DELETE',
        guard: 'admin',
        query: FileIdParamSchema,
        audit: {
            action: 'file_deleted',
            targetType: 'file',
            targetId: (_req, ctx) => (ctx.query as { fileId: string }).fileId,
        },
    },
    async (req, res, { query }) => {
        const file = await UserFile.findById(query.fileId);
        if (!file) {
            return responseErrorEntryNotFound(res, 'File');
        }

        // Hard delete: the binary is removed from disk too.
        await deleteDocument(file.filename);
        await UserFile.findByIdAndDelete(file._id);

        res.status(200).json({ success: true, data: { deleted: true } });
    }
);

// Edit metadata (display name and/or description). Any edit refreshes the
// upload date so the file resurfaces as "recent" in both lists.
const putHandler = withApi(
    {
        method: 'PUT',
        guard: 'admin',
        query: FileIdParamSchema,
        body: FileUpdateRequestSchema,
        audit: {
            action: 'file_updated',
            targetType: 'file',
            targetId: (_req, ctx) => (ctx.query as { fileId: string }).fileId,
            metadata: (_req, ctx) => ({
                fields: Object.keys(ctx.body as object),
            }),
        },
    },
    async (req, res, { query, body }) => {
        const { originalName, description } = body;

        const update: Record<string, unknown> = {
            updatedAt: new Date(),
            // Refreshed on every edit, per product decision.
            uploadedAt: new Date(),
        };
        if (originalName !== undefined) {
            // Keep only the basename (never a client path), as on upload.
            update.originalName = path
                .basename(String(originalName))
                .slice(0, 255);
        }
        if (description !== undefined) {
            update.description = description;
        }

        const file = await UserFile.findByIdAndUpdate(query.fileId, update, {
            new: true,
        });
        if (!file) {
            return responseErrorEntryNotFound(res, 'File');
        }

        res.status(200).json({
            success: true,
            data: {
                file: { ...file.toObject(), _id: String(file._id) },
            },
        });
    }
);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'DELETE') return deleteHandler(req, res);
    if (req.method === 'PUT') return putHandler(req, res);
    return responseErrorMethodNotAllowed(res);
}
