'use client';

import { useI18n } from '@/app/i18n';
import { weekDayShortLabels, localeTag } from '@/lib/datetime';

const pad = (n: number) => String(n).padStart(2, '0');

function toTimeValue(hours: number): string {
    const minutes = Math.round(Math.max(0, hours) * 60);
    const clamped = Math.min(minutes, 23 * 60 + 59);
    return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

function fromTimeValue(value: string): number {
    const [h, m] = value.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    return (h * 60 + m) / 60;
}
export default function WeeklyHoursEditor({
    hours,
    onChange,
    locale,
}: {
    hours: number[];
    onChange: (next: number[]) => void;
    locale?: string;
}) {
    const { t, lang } = useI18n();
    const labels = weekDayShortLabels(locale ?? localeTag(lang));
    const daysOrder = [1, 2, 3, 4, 5, 6, 0];

    const setDay = (jsDay: number, value: number) => {
        onChange(hours.map((h, i) => (i === jsDay ? value : h)));
    };

    return (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {daysOrder.map((jsDay) => {
                const value = hours[jsDay] ?? 0;
                return (
                    <div
                        key={jsDay}
                        className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                    >
                        <span className="shrink-0 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            {labels[(jsDay + 6) % 7]}
                        </span>
                        <div className="flex items-center gap-2">
                            {value === 0 && (
                                <span className="shrink-0 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                                    {t('weeklyHours.nonWorkingDay')}
                                </span>
                            )}
                            <input
                                type="time"
                                value={toTimeValue(value)}
                                onChange={(e) =>
                                    setDay(
                                        jsDay,
                                        fromTimeValue(e.target.value)
                                    )
                                }
                                className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-800"
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
