'use client';

import { useI18n } from '@/app/i18n';
import TimetableList from '@/components/autoTimetable/TimetableList';
import { weekDayShortLabels, localeTag } from '@/lib/datetime';
import type { WeekTimetable } from '@/schemas/database';

export default function ExpectedTimetablePreview({
    timetable,
    locale,
}: {
    timetable: WeekTimetable;
    locale?: string;
}) {
    const { t, lang } = useI18n();
    const labels = weekDayShortLabels(locale ?? localeTag(lang));
    const daysOrder = [1, 2, 3, 4, 5, 6, 0];

    return (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {daysOrder.map((jsDay) => {
                const intervals = timetable[jsDay] ?? [];
                return (
                    <div
                        key={jsDay}
                        className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                    >
                        <span className="shrink-0 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            {labels[(jsDay + 6) % 7]}
                        </span>
                        {intervals.length > 0 ? (
                            <TimetableList timetable={intervals} />
                        ) : (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {t('expectedTimetable.nonWorkingDay')}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
