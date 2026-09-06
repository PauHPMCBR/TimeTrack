'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { useDirty } from '@/lib/useDirty';
import type { FileRow } from '@/schemas/api';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import TextAreaField from '@/components/ui/TextAreaField';
import { Loader2 } from 'lucide-react';

type Props = {
    open: boolean;
    file: FileRow | null;
    onClose: () => void;
    onSaved: (file: FileRow) => void;
};

/** Admin modal to edit an uploaded file's display name and description.
 *  The backend refreshes the upload date on every edit. */
export default function FileEditModal({
    open,
    file,
    onClose,
    onSaved,
}: Props) {
    const { t } = useI18n();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { dirty, markDirty, resetDirty } = useDirty();

    useEffect(() => {
        if (open && file) {
            setName(file.originalName);
            setDescription(file.description ?? '');
            setError(null);
            resetDirty();
        }
    }, [open, file]);

    const requestClose = () => {
        if (dirty && !window.confirm(t('common.unsavedChangesConfirm'))) return;
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;
        setError(null);

        setSaving(true);
        try {
            const res = await apiClient.updateFile(file._id, {
                originalName: name.trim(),
                description,
            });
            if (res.error) {
                setError(
                    t(`error.${res.error}`) || res.error || t('error.PutError')
                );
                return;
            }
            if (res.data?.file) {
                resetDirty();
                onSaved(res.data.file);
            }
        } catch (err) {
            console.error(err);
            setError(t('error.PutError'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open && !!file}
            title={t('admin.files.editTitle')}
            subtitle={t('admin.files.editHint')}
            onClose={requestClose}
            footer={
                <Button
                    type="submit"
                    form="file-edit-form"
                    disabled={saving || name.trim().length === 0}
                    variant="primary"
                    className="w-full"
                >
                    {saving ? (
                        <span className="flex items-center justify-center gap-2">
                            <Loader2 size={16} className="animate-spin" />
                            {t('common.saving')}
                        </span>
                    ) : (
                        t('common.save')
                    )}
                </Button>
            }
        >
            <form
                id="file-edit-form"
                onSubmit={handleSubmit}
                className="space-y-4"
            >
                {error && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                    </div>
                )}

                <TextField
                    label={t('files.upload.file')}
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        markDirty();
                    }}
                    maxLength={255}
                />

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
