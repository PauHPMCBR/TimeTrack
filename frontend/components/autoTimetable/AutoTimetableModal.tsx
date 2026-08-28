'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/app/i18n';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import AutoTimetableFields from '@/components/autoTimetable/AutoTimetableFields';
import { useDirty } from '@/lib/useDirty';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { TimetableEntry } from '@/lib/timetable';

export default function AutoTimetableModal({
    open,
    timetable,
    onClose,
    onSave,
}: {
    open: boolean;
    timetable: TimetableEntry[];
    onClose: () => void;
    onSave: (next: TimetableEntry[]) => Promise<boolean>;
}) {
    const { t } = useI18n();

    const [draft, setDraft] = useState<TimetableEntry[]>(timetable);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { dirty, markDirty, resetDirty } = useDirty();
    useUnsavedChanges(dirty);

    const wasOpen = useRef(false);

    useEffect(() => {
        if (!open) {
            wasOpen.current = false;
            resetDirty();
            return;
        }
        if (wasOpen.current) return;
        wasOpen.current = true;
        setDraft(timetable);
        setSaving(false);
        setMessage(null);
        setError(null);
        resetDirty();
    }, [open, timetable, resetDirty]);

    const requestClose = () => {
        if (dirty && !window.confirm(t('common.unsavedChangesConfirm'))) return;
        onClose();
    };

    const handleDraftChange = (next: TimetableEntry[]) => {
        setDraft(next);
        markDirty();
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        const ok = await onSave(draft);
        setSaving(false);
        if (ok) {
            setMessage(t('checkin.autoSaved'));
            resetDirty();
        } else {
            setError(t('checkin.autoSaveFailed'));
        }
    };

    return (
        <Modal open={open} title={t('checkin.autoTitle')} onClose={requestClose}>
            <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {t('checkin.autoSubtitle')}
                </p>
                <AutoTimetableFields
                    timetable={draft}
                    onChange={handleDraftChange}
                />

                {message && (
                    <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                        {message}
                    </div>
                )}
                {error && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>
                        {t('checkin.autoCancel')}
                    </Button>
                    <Button
                        variant="primary"
                        disabled={saving}
                        onClick={handleSave}
                    >
                        {saving ? t('common.saving') : t('checkin.autoSave')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}