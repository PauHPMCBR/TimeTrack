'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/app/i18n';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import ExpectedTimetableEditor from '@/components/timetable/ExpectedTimetableEditor';
import { useDirty } from '@/lib/useDirty';
import { normalizeWeekTimetable } from '@/lib/timetable';
import { isValidDayTimetable } from 'shared/src/lib/timetable-validation';
import type { WeekTimetable } from '@/schemas/database';

export default function ExpectedTimetableModal({
    open,
    timetable,
    locale,
    onClose,
    onSave,
}: {
    open: boolean;
    timetable: WeekTimetable;
    locale?: string;
    onClose: () => void;
    onSave: (next: WeekTimetable) => void;
}) {
    const { t } = useI18n();

    const [draft, setDraft] = useState<WeekTimetable>(timetable);
    const [error, setError] = useState<string | null>(null);
    const { dirty, markDirty, resetDirty } = useDirty();

    const wasOpen = useRef(false);

    useEffect(() => {
        if (!open) {
            wasOpen.current = false;
            resetDirty();
            return;
        }
        if (wasOpen.current) return;
        wasOpen.current = true;
        setDraft(normalizeWeekTimetable(timetable));
        setError(null);
        resetDirty();
    }, [open, timetable, resetDirty]);

    const requestClose = () => {
        if (dirty && !window.confirm(t('common.unsavedChangesConfirm'))) return;
        onClose();
    };

    const handleSave = () => {
        if (!draft.every(isValidDayTimetable)) {
            setError(t('expectedTimetable.invalidIntervals'));
            return;
        }
        onSave(draft);
        onClose();
    };

    return (
        <Modal
            open={open}
            size="xl"
            title={t('expectedTimetable.title')}
            onClose={requestClose}
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={requestClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={handleSave}>
                        {t('common.save')}
                    </Button>
                </div>
            }
        >
            <ExpectedTimetableEditor
                timetable={draft}
                locale={locale}
                onChange={(next) => {
                    setDraft(next);
                    markDirty();
                }}
            />
            {error && (
                <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}
        </Modal>
    );
}
