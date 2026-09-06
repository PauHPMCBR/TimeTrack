import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { authenticateToken, AuthRequest } from '@/lib/auth';
import { UserFile } from '@/models';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { runValidation, validateQueryParams } from '@/lib/validation';
import {
    FileRow,
    FilesResponse,
    MyFilesQuerySchema,
} from 'shared/src/schemas/api';
import { getFilesQuotaBytes, getFilesTotalSizeBytes } from '@/lib/files';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(
            validateQueryParams(MyFilesQuerySchema),
            req,
            res
        ))
    )
        return;

    const { sortBy = 'uploadedAt', order = 'desc' } = req.query;

    try {
        await dbConnect();

        const sortDir = order === 'asc' ? 1 : -1;
        const sortField = String(sortBy);
        const files = (
            await UserFile.find({ userId: req.user!.userId })
                .sort({ [sortField]: sortDir })
                .lean()
        ) as unknown as (FileRow & { _id: { toString(): string } })[];

        const rows: FileRow[] = files.map((f) => ({
            ...f,
            _id: String(f._id),
        }));

        const data: FilesResponse = {
            files: rows,
            totalSize: await getFilesTotalSizeBytes(),
            quotaBytes: getFilesQuotaBytes(),
        };

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('List my files error:', error);
        return responseErrorGet(res);
    }
}

export default authenticateToken(handler);
