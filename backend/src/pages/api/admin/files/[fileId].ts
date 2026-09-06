import type { NextApiResponse } from 'next';
import path from 'path';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { UserFile } from '@/models';
import {
    responseErrorDelete,
    responseErrorEntryNotFound,
    responseErrorMethodNotAllowed,
    responseErrorPut,
} from '@/lib/response-error-generator';
import { runValidation, validateQueryParams, validateRequestBody } from '@/lib/validation';
import { FileIdParamSchema, FileUpdateRequestSchema } from 'shared/src/schemas/api';
import { deleteDocument } from '@/lib/storage';
import { ADMIN_ROLE } from 'shared/src/lib/constants';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method === 'DELETE') return handleDelete(req, res);
    if (req.method === 'PUT') return handlePut(req, res);
    return responseErrorMethodNotAllowed(res);
}

async function handleDelete(req: AuthRequest, res: NextApiResponse) {
    if (
        !(await runValidation(
            validateQueryParams(FileIdParamSchema),
            req,
            res
        ))
    )
        return;

    try {
        await dbConnect();

        const file = await UserFile.findById(req.query.fileId);
        if (!file) {
            return responseErrorEntryNotFound(res, 'File');
        }

        // Hard delete: the binary is removed from disk too.
        await deleteDocument(file.filename);
        await UserFile.findByIdAndDelete(file._id);

        res.status(200).json({ success: true, data: { deleted: true } });
    } catch (error) {
        console.error('Delete file error:', error);
        return responseErrorDelete(res);
    }
}

// Edit metadata (display name and/or description). Any edit refreshes the
// upload date so the file resurfaces as "recent" in both lists.
async function handlePut(req: AuthRequest, res: NextApiResponse) {
    if (
        !(await runValidation(
            validateQueryParams(FileIdParamSchema),
            req,
            res
        ))
    )
        return;

    if (
        !(await runValidation(
            validateRequestBody(FileUpdateRequestSchema),
            req,
            res
        ))
    )
        return;

    const { originalName, description } = req.body;

    try {
        await dbConnect();

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

        const file = await UserFile.findByIdAndUpdate(
            req.query.fileId,
            update,
            { new: true }
        );
        if (!file) {
            return responseErrorEntryNotFound(res, 'File');
        }

        res.status(200).json({
            success: true,
            data: {
                file: { ...file.toObject(), _id: String(file._id) },
            },
        });
    } catch (error) {
        console.error('Update file error:', error);
        return responseErrorPut(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
