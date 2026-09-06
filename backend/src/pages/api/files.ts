import { withApi } from '@/lib/api-handler';
import { UserFile } from '@/models';
import {
    FileRow,
    FilesResponse,
    MyFilesQuerySchema,
} from 'shared/src/schemas/api';
import { getFilesQuotaBytes, getFilesTotalSizeBytes } from '@/lib/files';

export default withApi(
    { method: 'GET', query: MyFilesQuerySchema },
    async (req, res, { query }) => {
        const { sortBy = 'uploadedAt', order = 'desc' } = query;

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
    }
);
