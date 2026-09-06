'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { useDirty } from '@/lib/useDirty';
import type { User } from '@/types';
import type { FileRow, FileUploadRequest } from '@/schemas/api';
import { getFileMaxBytes } from '@/lib/constants';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import Label from '@/components/ui/Label';
import TextAreaField from '@/components/ui/TextAreaField';
import { formatBytes } from '@/components/files/FileList';
import { Loader2, Upload } from 'lucide-react';

type Props = {
    open: boolean;
    users: User[];
    onClose: () => void;
    onUploaded: (file: FileRow) => void;
};

const readFileAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });

/** Admin modal to upload a file for a specific employee. The employee is
 *  mandatory; the description is optional. */
export default function FileUploadModal({
    open,
    users,
    onClose,
    onUploaded,
}: Props) {
    const { t } = useI18n();

    const [userId, setUserId] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { dirty, markDirty, resetDirty } = useDirty();

    useEffect(() => {
        if (open) {
            setUserId('');
            setDescription('');
            setFile(null);
            setError(null);
            resetDirty();
        }
    }, [open]);

    const requestClose = () => {
        if (dirty && !window.confirm(t('common.unsavedChangesConfirm'))) return;
        onClose();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        e.target.value = '';
        setError(null);
        markDirty();
        if (!selected) {
            setFile(null);
            return;
        }
        const maxBytes = getFileMaxBytes();
        if (selected.size > maxBytes) {
            setFile(null);
            setError(
                t('error.IncorrectParameter.reason.FileTooLarge', {
                    maxSize: formatBytes(maxBytes),
                })
            );
            return;
        }
        setFile(selected);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!userId) {
            setError(t('files.upload.selectEmployee'));
            return;
        }
        if (!file) {
            setError(t('files.upload.noFile'));
            return;
        }

        setUploading(true);
        try {
            const dataUrl = await readFileAsDataURL(file);
            const body: FileUploadRequest = {
                userId,
                originalName: file.name,
                description: description.trim() || undefined,
                dataUrl,
            };
            const res = await apiClient.uploadFile(body);
            if (res.error) {
                if (
                    res.error === 'IncorrectParameter' &&
                    res.details?.incorrectParameter === 'file'
                ) {
                    const reasons = res.details?.reasons || [];
                    const maxSize = formatBytes(getFileMaxBytes());
                    setError(
                        reasons.length > 0
                            ? reasons
                                  .map((r) =>
                                      t(
                                          `error.IncorrectParameter.reason.${r}`,
                                          { maxSize }
                                      )
                                  )
                                  .join(', ')
                            : t('error.IncorrectParameter.message')
                    );
                } else {
                    setError(
                        t(`error.${res.error}`) ||
                            res.error ||
                            t('error.PostError')
                    );
                }
                return;
            }
            if (res.data?.file) {
                resetDirty();
                onUploaded(res.data.file);
            }
        } catch (err) {
            console.error(err);
            setError(t('files.upload.error'));
        } finally {
            setUploading(false);
        }
    };

    return (
        <Modal
            open={open}
            title={t('admin.files.upload')}
            subtitle={t('files.upload.subtitle')}
            onClose={requestClose}
            footer={
                <Button
                    type="submit"
                    form="file-upload-form"
                    disabled={uploading}
                    variant="primary"
                    className="w-full"
                >
                    {uploading ? (
                        <span className="flex items-center justify-center gap-2">
                            <Loader2 size={16} className="animate-spin" />
                            {t('files.upload.uploading')}
                        </span>
                    ) : (
                        t('files.upload.submit')
                    )}
                </Button>
            }
        >
            <form
                id="file-upload-form"
                onSubmit={handleSubmit}
                className="space-y-4"
            >
                {error && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                    </div>
                )}

                <div>
                    <Label className="mb-1.5">
                        {t('files.upload.employee')}
                    </Label>
                    <select
                        value={userId}
                        onChange={(e) => {
                            setUserId(e.target.value);
                            markDirty();
                        }}
                        required
                        className={selectClass}
                    >
                        <option value="">
                            {t('files.upload.selectEmployeePlaceholder')}
                        </option>
                        {users.map((u) => (
                            <option key={u._id} value={u._id}>
                                {u.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <Label className="mb-1.5">{t('files.upload.file')}</Label>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full items-center gap-3 rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-left text-sm transition-colors hover:border-indigo-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
                    >
                        <Upload size={18} className="shrink-0 text-zinc-400" />
                        <span className="truncate text-zinc-700 dark:text-zinc-300">
                            {file
                                ? file.name
                                : t('files.upload.filePlaceholder', {
                                      maxSize: formatBytes(getFileMaxBytes()),
                                  })}
                        </span>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <p className="mt-1.5 text-xs text-zinc-500">
                        {t('files.upload.fileHelp', {
                            maxSize: formatBytes(getFileMaxBytes()),
                        })}
                    </p>
                </div>

                <TextAreaField
                    label={t('files.upload.description')}
                    value={description}
                    onChange={(e) => {
                        setDescription(e.target.value);
                        markDirty();
                    }}
                    maxLength={1000}
                    rows={3}
                    placeholder={t('files.upload.descriptionPlaceholder')}
                />
            </form>
        </Modal>
    );
}

const selectClass =
    'w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white dark:focus:border-indigo-400';
