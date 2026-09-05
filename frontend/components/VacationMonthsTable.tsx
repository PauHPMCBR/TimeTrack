'use client';

import { useMemo } from 'react';

export type VacationMonthsTableProps = {
    /** Company obligatory vacation days of a single year. */
    days: (Date | string)[];
    locale: string;
    className?: string;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i);

function monthLabel(locale: string, month: number) {
    return new Intl.DateTimeFormat(locale, { month: 'long' }).format(
        new Date(2024, month, 1)
    );
}

/**
 * Company obligatory vacations of one year: one row per month, month name on
 * the left and the vacation day numbers as badges on the right.
 */
export default function VacationMonthsTable({
    days,
    locale,
    className = '',
}: VacationMonthsTableProps) {
    const daysByMonth = useMemo(() => {
        const byMonth: number[][] = Array.from({ length: 12 }, () => []);
        days.forEach((raw) => {
            const d = new Date(raw);
            if (Number.isNaN(d.getTime())) return;
            byMonth[d.getMonth()].push(d.getDate());
        });
        byMonth.forEach((list) => list.sort((a, b) => a - b));
        return byMonth;
    }, [days]);

    return (
        <div className={`divide-y divide-zinc-100 dark:divide-zinc-800 ${className}`}>
            {MONTHS.map((month) => {
                const dayList = daysByMonth[month];
                return (
                    <div
                        key={month}
                        className="flex items-start gap-4 py-2.5 first:pt-0 last:pb-0"
                    >
                        <span className="w-24 shrink-0 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            {monthLabel(locale, month)}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {dayList.length === 0 ? (
                                <span className="text-sm text-zinc-300 dark:text-zinc-600">
                                    &mdash;
                                </span>
                            ) : (
                                dayList.map((day) => (
                                    <span
                                        key={day}
                                        className="flex h-6 w-6 items-center justify-center rounded bg-indigo-100 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                                    >
                                        {day}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
