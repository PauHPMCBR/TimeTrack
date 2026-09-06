'use client';

import { useI18n } from '@/app/i18n';
import type { FileRow } from '@/schemas/api';
import { localeTag } from '@/lib/datetime';
import {
    Download,
    File as FileIcon,
    FileText,
    Image as ImageIcon,
    Pencil,
    Trash2,
} from 'lucide-react';

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIconFor(mimeType: string) {
    if (mimeType.startsWith('image/')) return ImageIcon;
    if (mimeType === 'application/pdf' || mimeType.startsWith('text/'))
        return FileText;
    return FileIcon;
}

type Props = {
    files: FileRow[];
    /** Show the employee the file belongs to (admin list). */
    showOwner?: boolean;
    downloadingId?: string | null;
    deletingId?: string | null;
    onDownload: (file: FileRow) => void;
    onDelete?: (file: FileRow) => void;
    onEdit?: (file: FileRow) => void;
};

/** Shared file list used by the admin files page (with owner/delete) and the
 *  employee "my files" page (without). */
export default function FileList({
    files,
    showOwner = false,
    downloadingId,
    deletingId,
    onDownload,
    onDelete,
    onEdit,
}: Props) {
    const { t, lang } = useI18n();

    return (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {files.map((file, idx) => {
                const Icon = fileIconFor(file.mimeType || '');
                const isDownloading = downloadingId === file._id;
                const isDeleting = deletingId === file._id;
                return (
                    <div
                        key={file._id}
                        className={`flex items-center gap-4 p-4 ${
                            idx !== files.length - 1
                                ? 'border-b border-zinc-200 dark:border-zinc-800'
                                : ''
                        }`}
                    >
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                            <Icon size={20} />
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                                <span
                                    className="truncate font-medium text-zinc-900 dark:text-white"
                                    title={file.originalName}
                                >
                                    {file.originalName}
                                </span>
                                {showOwner && file.userName && (
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                        · {file.userName}
                                    </span>
                                )}
                            </div>
                            <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                {new Date(file.uploadedAt).toLocaleString(
                                    localeTag(lang)
                                )}
                                {' · '}
                                {formatBytes(file.size)}
                            </div>
                            {file.description && (
                                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                                    {file.description}
                                </div>
                            )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                            <button
                                onClick={() => onDownload(file)}
                                disabled={isDownloading || isDeleting}
                                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-indigo-600 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-indigo-400"
                                title={t('files.download')}
                                aria-label={t('files.download')}
                            >
                                <Download size={18} />
                            </button>
                            {onEdit && (
                                <button
                                    onClick={() => onEdit(file)}
                                    disabled={isDownloading || isDeleting}
                                    className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-indigo-600 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-indigo-400"
                                    title={t('admin.files.edit')}
                                    aria-label={t('admin.files.edit')}
                                >
                                    <Pencil size={18} />
                                </button>
                            )}
                            {onDelete && (
                                <button
                                    onClick={() => onDelete(file)}
                                    disabled={isDownloading || isDeleting}
                                    className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                    title={t('files.delete')}
                                    aria-label={t('files.delete')}
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
