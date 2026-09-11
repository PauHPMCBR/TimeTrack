'use client';

import { useI18n } from '@/app/i18n';
import Button from '@/components/ui/Button';
import AutoTimetableFields from '@/components/autoTimetable/AutoTimetableFields';
import { weekDayShortLabels, localeTag } from '@/lib/datetime';
import {
    DEFAULT_CHECK_IN_TIME,
    DEFAULT_CHECK_OUT_TIME,
} from 'shared/src/lib/defaults';
import type { WeekTimetable } from '@/schemas/database';

export default function ExpectedTimetableEditor({
    timetable,
    onChange,
    locale,
}: {
    timetable: WeekTimetable;
    onChange: (next: WeekTimetable) => void;
    locale?: string;
}) {
    const { t, lang } = useI18n();
    const labels = weekDayShortLabels(locale ?? localeTag(lang));
    const daysOrder = [1, 2, 3, 4, 5, 6, 0];

    const setDay = (jsDay: number, next: (typeof timetable)[number]) => {
        onChange(timetable.map((day, i) => (i === jsDay ? next : day)));
    };

    return (
        <div className="space-y-3">
            {daysOrder.map((jsDay) => {
                const intervals = timetable[jsDay] ?? [];
                return (
                    <div
                        key={jsDay}
                        className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                    >
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                {labels[(jsDay + 6) % 7]}
                            </span>
                            {intervals.length === 0 && (
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {t('expectedTimetable.nonWorkingDay')}
                                </span>
                            )}
                        </div>
                        {intervals.length === 0 ? (
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                    setDay(jsDay, [
                                        {
                                            checkIn: DEFAULT_CHECK_IN_TIME,
                                            checkOut: DEFAULT_CHECK_OUT_TIME,
                                        },
                                    ])
                                }
                            >
                                {t('checkin.autoAddInterval')}
                            </Button>
                        ) : (
                            <AutoTimetableFields
                                timetable={intervals}
                                allowEmpty
                                onChange={(next) => setDay(jsDay, next)}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
