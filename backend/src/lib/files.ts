import {
    DEFAULT_FILE_MAX_BYTES,
    DEFAULT_FILES_STORAGE_QUOTA_BYTES,
} from 'shared/src/lib/constants';
import { UserFile } from '@/models';

export function getFilesMaxBytes(): number {
    const raw = process.env.FILE_MAX_BYTES;
    if (!raw) return DEFAULT_FILE_MAX_BYTES;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        console.warn(
            `[files] Invalid FILE_MAX_BYTES "${raw}"; using the default`
        );
        return DEFAULT_FILE_MAX_BYTES;
    }
    return Math.floor(parsed);
}

// Total-storage quota for employee files, in bytes. Configured via the
// FILES_STORAGE_QUOTA_BYTES env var.
export function getFilesQuotaBytes(): number {
    const raw = process.env.FILES_STORAGE_QUOTA_BYTES;
    if (!raw) return DEFAULT_FILES_STORAGE_QUOTA_BYTES;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        console.warn(
            `[files] Invalid FILES_STORAGE_QUOTA_BYTES "${raw}"; using the default`
        );
        return DEFAULT_FILES_STORAGE_QUOTA_BYTES;
    }
    return Math.floor(parsed);
}

// Total bytes currently used by all employee files. The size index makes this
// an index-only scan (uploads are rare, so recomputing per request is fine and
// self-healing — no drift-prone counter to maintain).
export async function getFilesTotalSizeBytes(): Promise<number> {
    const rows = await UserFile.aggregate<{ total?: number }>([
        { $group: { _id: null, total: { $sum: '$size' } } },
    ]);
    return rows[0]?.total ?? 0;
}
