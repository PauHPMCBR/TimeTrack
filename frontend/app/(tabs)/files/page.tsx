'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import type {
    FileRow,
    FileSortField,
    FileSortOrder,
    MyFilesQuery,
} from '@/schemas/api';
import { Alert } from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import FileList from '@/components/files/FileList';
import FileSortControls from '@/components/files/FileSortControls';
import { usePersistedState } from '@/lib/usePersistedState';
import { MY_FILES_ORDER, MY_FILES_SORT } from '@/lib/storage';
import { FolderOpen } from 'lucide-react';

export default function MyFilesPage() {
    const { t } = useI18n();

    const [files, setFiles] = useState<FileRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const fetchSeq = useRef(0);

    const [sortBy, setSortBy] = usePersistedState<FileSortField>(
        MY_FILES_SORT,
        'uploadedAt'
    );
    const [order, setOrder] = usePersistedState<FileSortOrder>(
        MY_FILES_ORDER,
        'desc'
    );

    const fetchFiles = useCallback(async () => {
        const seq = ++fetchSeq.current;
        setLoading(true);
        setError(null);
        try {
            const params: MyFilesQuery = { sortBy, order };
            const res = await apiClient.getMyFiles(params);
            if (seq !== fetchSeq.current) return;
            if (res.error) {
                setError(t(`error.${res.error}`) || t('error.GetError'));
            } else if (res.data) {
                setFiles(res.data.files);
            }
        } catch (err) {
            console.error('Error loading files:', err);
            if (seq === fetchSeq.current) setError(t('error.GetError'));
        } finally {
            if (seq === fetchSeq.current) setLoading(false);
        }
    }, [sortBy, order, t]);

    useEffect(() => {
        fetchFiles();
        return () => {
            fetchSeq.current += 1;
        };
    }, [fetchFiles]);

    const handleDownload = async (file: FileRow) => {
        setDownloadingId(file._id);
        try {
            await apiClient.downloadFile(file._id, file.originalName);
        } finally {
            setDownloadingId(null);
        }
    };

    return (
        <section className="space-y-6 pb-20">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {t('files.title')}
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        {t('files.subtitle')}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <FileSortControls
                        sortBy={sortBy}
                        order={order}
                        onSortBy={setSortBy}
                        onOrder={setOrder}
                    />
                </div>
            </div>

            {error && (
                <Alert variant="destructive" onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {loading ? (
                <div className="p-10 text-center animate-pulse text-zinc-500">
                    {t('common.loading')}
                </div>
            ) : files.length === 0 ? (
                <EmptyState
                    icon={<FolderOpen size={28} />}
                    title={t('files.empty')}
                    description={t('files.emptyDesc')}
                />
            ) : (
                <FileList
                    files={files}
                    downloadingId={downloadingId}
                    onDownload={handleDownload}
                />
            )}
        </section>
    );
}
