'use client';

import { useI18n } from '@/app/i18n';
import Button from '@/components/ui/Button';
import { TimetableEntry } from '@/lib/timetable';
import {
    DEFAULT_CHECK_IN_TIME,
    DEFAULT_CHECK_OUT_TIME,
} from 'shared/src/lib/defaults';

export default function AutoTimetableFields({
    timetable,
    onChange,
}: {
    timetable: TimetableEntry[];
    onChange: (next: TimetableEntry[]) => void;
}) {
    const { t } = useI18n();

    const updateEntry = (
        index: number,
        field: 'checkIn' | 'checkOut',
        value: string
    ) => {
        onChange(
            timetable.map((e, i) =>
                i === index ? { ...e, [field]: value } : e
            )
        );
    };

    const addInterval = () => {
        onChange([
            ...timetable,
            { checkIn: DEFAULT_CHECK_IN_TIME, checkOut: DEFAULT_CHECK_OUT_TIME },
        ]);
    };

    const removeInterval = (index: number) => {
        onChange(
            timetable.length <= 1
                ? timetable
                : timetable.filter((_, i) => i !== index)
        );
    };

    return (
        <div className="space-y-3">
            {timetable.map((entry, index) => (
                <div
                    key={index}
                    className="flex items-end gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                >
                    <div className="flex-1">
                        <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {t('checkin.autoCheckIn')}
                        </label>
                        <input
                            type="time"
                            value={entry.checkIn}
                            onChange={(e) =>
                                updateEntry(index, 'checkIn', e.target.value)
                            }
                            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 transition-colors"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {t('checkin.autoCheckOut')}
                        </label>
                        <input
                            type="time"
                            value={entry.checkOut}
                            onChange={(e) =>
                                updateEntry(index, 'checkOut', e.target.value)
                            }
                            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 transition-colors"
                        />
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={timetable.length <= 1}
                        onClick={() => removeInterval(index)}
                    >
                        {t('checkin.autoRemoveInterval')}
                    </Button>
                </div>
            ))}
            <Button
                variant="secondary"
                size="sm"
                onClick={addInterval}
            >
                {t('checkin.autoAddInterval')}
            </Button>
        </div>
    );
}
