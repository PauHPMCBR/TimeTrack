import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { authenticateToken, AuthRequest } from '@/lib/auth';
import { UserFile } from '@/models';
import {
    responseError,
    responseErrorEntryNotFound,
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { runValidation, validateQueryParams } from '@/lib/validation';
import { FileIdParamSchema } from 'shared/src/schemas/api';
import { readDocument } from '@/lib/storage';
import { ADMIN_ROLE } from 'shared/src/lib/constants';

// Content-Disposition with a UTF-8 field for non-ASCII names plus an ASCII
// fallback for old clients.
function contentDisposition(filename: string): string {
    const fallback = filename
        .replace(/[^\x20-\x7E]/g, '_')
        .replace(/["\\]/g, '_');
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

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

        // Only the employee the file belongs to and admins can download it.
        // req.dbUser is the live user doc already fetched by authenticateToken.
        const isOwner = String(file.userId) === req.user!.userId;
        const isAdmin = req.dbUser?.role === ADMIN_ROLE;
        if (!isOwner && !isAdmin) {
            return responseError(res, 403, 'NoAccessToUser');
        }

        let data: Buffer;
        try {
            data = await readDocument(file.filename);
        } catch {
            return responseErrorEntryNotFound(res, 'File');
        }

        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', contentDisposition(file.originalName));
        res.setHeader('Content-Length', String(data.length));
        res.setHeader('Cache-Control', 'private, no-store');
        res.status(200).send(data);
    } catch (error) {
        console.error('Download file error:', error);
        return responseErrorGet(res);
    }
}

export default authenticateToken(handler);
