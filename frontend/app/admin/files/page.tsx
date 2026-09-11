'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import LoadingState from '@/components/ui/LoadingState';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import type { FileRow, FileSortField, FileSortOrder } from '@/schemas/api';
import type { User } from '@/types';
import { Alert } from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import AdminBackButton from '../../../components/AdminBackButton';
import FileList, { formatBytes } from '@/components/files/FileList';
import FileSortControls, {
    selectClass,
} from '@/components/files/FileSortControls';
import FileUploadModal from '@/components/files/FileUploadModal';
import FileEditModal from '@/components/files/FileEditModal';
import { usePersistedState } from '@/lib/usePersistedState';
import {
    ADMIN_FILES_ORDER,
    ADMIN_FILES_SORT,
    ADMIN_FILES_USER,
} from '@/lib/storage';
import { FolderOpen, Upload } from 'lucide-react';

export default function AdminFilesPage() {
    const { t } = useI18n();

    const [files, setFiles] = useState<FileRow[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalSize, setTotalSize] = useState(0);
    const [quotaBytes, setQuotaBytes] = useState<number | null>(null);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [editingFile, setEditingFile] = useState<FileRow | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const fetchSeq = useRef(0);

    const [filterUserId, setFilterUserId] = usePersistedState<string>(
        ADMIN_FILES_USER,
        'all'
    );
    const [sortBy, setSortBy] = usePersistedState<FileSortField>(
        ADMIN_FILES_SORT,
        'uploadedAt'
    );
    const [order, setOrder] = usePersistedState<FileSortOrder>(
        ADMIN_FILES_ORDER,
        'desc'
    );

    const fetchFiles = useCallback(async () => {
        const seq = ++fetchSeq.current;
        setLoading(true);
        setError(null);
        try {
            const [resFiles, resUsers] = await Promise.allSettled([
                apiClient.getAdminFiles({
                    userId: filterUserId === 'all' ? undefined : filterUserId,
                    sortBy,
                    order,
                }),
                apiClient.getCompanyUsers(),
            ]);
            if (seq !== fetchSeq.current) return;

            if (resFiles.status === 'fulfilled' && resFiles.value.data) {
                setFiles(resFiles.value.data.files);
                setTotalSize(resFiles.value.data.totalSize);
                setQuotaBytes(resFiles.value.data.quotaBytes);
            } else if (resFiles.status === 'rejected') {
                console.error('Error loading files:', resFiles.reason);
                setError(t('error.GetError'));
            }

            if (resUsers.status === 'fulfilled' && resUsers.value.data?.users) {
                setUsers(resUsers.value.data.users);
            }
        } finally {
            if (seq === fetchSeq.current) setLoading(false);
        }
    }, [filterUserId, sortBy, order, t]);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    const handleDownload = async (file: FileRow) => {
        setDownloadingId(file._id);
        try {
            await apiClient.downloadFile(file._id, file.originalName);
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDelete = async (file: FileRow) => {
        if (!window.confirm(t('admin.files.deleteConfirm'))) return;
        setDeletingId(file._id);
        try {
            const res = await apiClient.deleteFile(file._id);
            if (res.error) {
                setError(t(`error.${res.error}`) || t('error.DeleteError'));
            } else {
                setFiles((prev) => prev.filter((f) => f._id !== file._id));
            }
        } finally {
            setDeletingId(null);
        }
    };

    const handleEdited = () => {
        setEditingFile(null);
        // The edit refreshes the upload date, so the order may change: refetch.
        fetchFiles();
    };

    const usagePercent =
        quotaBytes && quotaBytes > 0
            ? Math.min(100, Math.round((totalSize / quotaBytes) * 100))
            : 0;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            <div className="mx-auto max-w-4xl px-4 py-6">
                <AdminBackButton />

                <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                            {t('admin.files.title')}
                        </h1>
                        <p className="mt-1 text-sm text-zinc-500">
                            {t('admin.files.subtitle')}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={filterUserId}
                            onChange={(e) => setFilterUserId(e.target.value)}
                            className={selectClass}
                        >
                            <option value="all">
                                {t('admin.files.allEmployees')}
                            </option>
                            {users.map((u) => (
                                <option key={u._id} value={u._id}>
                                    {u.name}
                                </option>
                            ))}
                        </select>

                        <span className="mx-1 h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

                        <FileSortControls
                            sortBy={sortBy}
                            order={order}
                            onSortBy={setSortBy}
                            onOrder={setOrder}
                        />

                        <span className="mx-1 h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

                        <Button onClick={() => setUploadOpen(true)}>
                            <Upload size={16} />
                            {t('admin.files.upload')}
                        </Button>
                    </div>
                </div>

                {quotaBytes !== null && (
                    <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="font-medium text-zinc-900 dark:text-white">
                                {t('admin.files.storage')}
                            </span>
                            <span className="text-zinc-500">
                                {formatBytes(totalSize)} /{' '}
                                {formatBytes(quotaBytes)}
                            </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <div
                                className={`h-full rounded-full transition-all ${
                                    usagePercent >= 90
                                        ? 'bg-red-500'
                                        : usagePercent >= 70
                                          ? 'bg-amber-500'
                                          : 'bg-indigo-500'
                                }`}
                                style={{ width: `${usagePercent}%` }}
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-6">
                        <Alert
                            variant="destructive"
                            onClose={() => setError(null)}
                        >
                            {error}
                        </Alert>
                    </div>
                )}

                {loading ? (
                    <LoadingState />
                ) : files.length === 0 ? (
                    <EmptyState
                        icon={<FolderOpen size={28} />}
                        title={t('admin.files.empty')}
                        description={t('admin.files.emptyDesc')}
                        action={
                            <Button onClick={() => setUploadOpen(true)}>
                                <Upload size={16} />
                                {t('admin.files.upload')}
                            </Button>
                        }
                    />
                ) : (
                    <FileList
                        files={files}
                        showOwner
                        downloadingId={downloadingId}
                        deletingId={deletingId}
                        onDownload={handleDownload}
                        onDelete={handleDelete}
                        onEdit={setEditingFile}
                    />
                )}
            </div>

            <FileUploadModal
                open={uploadOpen}
                users={users}
                onClose={() => setUploadOpen(false)}
                onUploaded={() => {
                    setUploadOpen(false);
                    fetchFiles();
                }}
            />

            <FileEditModal
                open={editingFile !== null}
                file={editingFile}
                onClose={() => setEditingFile(null)}
                onSaved={handleEdited}
            />
        </div>
    );
}
