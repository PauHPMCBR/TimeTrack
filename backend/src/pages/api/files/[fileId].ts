import { withApi } from '@/lib/api-handler';
import { UserFile } from '@/models';
import {
    responseError,
    responseErrorEntryNotFound,
} from '@/lib/response-error-generator';
import { FileIdParamSchema } from 'shared/src/schemas/api';
import { readDocument } from '@/lib/storage';
import { sameId } from '@/lib/objectid';
import { ADMIN_ROLE } from 'shared/src/lib/constants';

// Content-Disposition with a UTF-8 field for non-ASCII names plus an ASCII
// fallback for old clients.
function contentDisposition(filename: string): string {
    const fallback = filename
        .replace(/[^\x20-\x7E]/g, '_')
        .replace(/["\\]/g, '_');
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export default withApi(
    { method: 'GET', query: FileIdParamSchema },
    async (req, res, { query }) => {
        const file = await UserFile.findById(query.fileId);
        if (!file) {
            return responseErrorEntryNotFound(res, 'File');
        }

        // Only the employee the file belongs to and admins can download it.
        // req.dbUser is the live user doc already fetched by authenticateToken.
        const isOwner = sameId(file.userId, req.user!.userId);
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
    }
);
