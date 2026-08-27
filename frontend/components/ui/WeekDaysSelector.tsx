'use client';

import { weekDayShortLabels, localeTag } from '@/lib/datetime';

export type WeekDaysSelectorProps = {
    /** Week days (JS day numbers 0..6) currently selected/highlighted. */
    selected: number[];
    onToggle: (jsDay: number) => void;
    locale?: string;
    className?: string;
};

/**
 * Grid of the 7 week days (Mon..Sun). Highlighted days are the ones present in
 * `selected`; clicking toggles them. Used both for company non-working days
 * (settings) and per-user custom non-working days (user edit).
 */
export default function WeekDaysSelector({
    selected,
    onToggle,
    locale,
    className = '',
}: WeekDaysSelectorProps) {
    const labels = weekDayShortLabels(locale ?? localeTag('ca'));

    return (
        <div className={`grid grid-cols-7 gap-1.5 ${className}`}>
            {labels.map((label, idx) => {
                const jsDay = (idx + 1) % 7; // idx0=Mon(1) ... idx5=Sat(6) idx6=Sun(0)
                const active = selected.includes(jsDay);
                return (
                    <button
                        key={jsDay}
                        type="button"
                        onClick={() => onToggle(jsDay)}
                        className={`flex flex-col items-center justify-center rounded-lg border px-1 py-2 text-xs font-medium transition-all ${
                            active
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-300'
                                : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                        }`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
