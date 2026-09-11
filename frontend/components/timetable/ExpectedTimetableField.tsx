'use client';

import { useState } from 'react';
import { useI18n } from '@/app/i18n';
import Button from '@/components/ui/Button';
import Label from '@/components/ui/Label';
import ExpectedTimetableModal from '@/components/timetable/ExpectedTimetableModal';
import ExpectedTimetablePreview from '@/components/timetable/ExpectedTimetablePreview';
import { normalizeWeekTimetable } from '@/lib/timetable';
import type { WeekTimetable } from '@/schemas/database';
export default function ExpectedTimetableField({
    timetable,
    onChange,
    label,
    help,
    locale,
}: {
    timetable: WeekTimetable;
    onChange: (next: WeekTimetable) => void;
    label?: string;
    help?: string;
    locale?: string;
}) {
    const { t } = useI18n();
    const [editing, setEditing] = useState(false);

    return (
        <div>
            {label && <Label>{label}</Label>}
            {help && (
                <p className="mb-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {help}
                </p>
            )}
            <ExpectedTimetablePreview timetable={timetable} locale={locale} />
            <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => setEditing(true)}
            >
                {t('expectedTimetable.edit')}
            </Button>
            {editing && (
                <ExpectedTimetableModal
                    open={editing}
                    timetable={timetable}
                    locale={locale}
                    onClose={() => setEditing(false)}
                    onSave={(next) => onChange(normalizeWeekTimetable(next))}
                />
            )}
        </div>
    );
}
