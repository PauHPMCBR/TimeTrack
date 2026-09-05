'use client';

import { useMemo } from 'react';
import { Check, Clock, Hourglass, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type MonthCellState =
    | 'notApplicable'
    | 'awaitingReview'
    | 'pending'
    | 'confirmed';

export type MonthYearGridProps = {
    /** Oldest year (bottom row). */
    fromYear: number;
    /** Newest year (top row). */
    toYear: number;
    /** State of a cell; `month` is 1-12. */
    cellState: (year: number, month: number) => MonthCellState;
    /** Accessible label / tooltip for a cell. */
    cellTitle?: (year: number, month: number, state: MonthCellState) => string;
    /** Whether a cell is interactive; defaults to `state === 'pending'`. */
    isCellClickable?: (year: number, month: number, state: MonthCellState) => boolean;
    onCellClick?: (year: number, month: number) => void;
    locale: string;
    className?: string;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Background/text classes per state; also used for legends elsewhere. */
export const monthStateClasses: Record<MonthCellState, string> = {
    confirmed:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    pending:
        'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    awaitingReview:
        'bg-sky-50 text-sky-700 border border-dashed border-sky-300 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-700',
    notApplicable:
        'bg-zinc-50 text-zinc-300 dark:bg-zinc-800/40 dark:text-zinc-600',
};

const clickableClasses: Record<MonthCellState, string> = {
    confirmed: '',
    pending:
        'cursor-pointer hover:ring-2 hover:ring-amber-400 dark:hover:ring-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 outline-none',
    awaitingReview: '',
    notApplicable: '',
};

const stateIcons: Record<MonthCellState, LucideIcon> = {
    confirmed: Check,
    pending: Clock,
    awaitingReview: Hourglass,
    notApplicable: Minus,
};

function monthLabel(locale: string, month: number) {
    const label = new Intl.DateTimeFormat(locale, {
        month: 'short',
    }).format(new Date(2024, month - 1, 1));
    return label.replace('.', '');
}

/**
 * Compact year × month grid: one row per year (most recent first), one
 * column per month. Cells are color-coded by state, show the month name and
 * an optional icon, and can be clickable.
 */
export default function MonthYearGrid({
    fromYear,
    toYear,
    cellState,
    cellTitle,
    isCellClickable,
    onCellClick,
    locale,
    className = '',
}: MonthYearGridProps) {
    const labels = useMemo(
        () => MONTHS.map((m) => monthLabel(locale, m)),
        [locale]
    );
    const years = useMemo(() => {
        const list: number[] = [];
        for (let y = toYear; y >= fromYear; y--) list.push(y);
        return list;
    }, [fromYear, toYear]);

    const renderCell = (year: number, month: number) => {
        const state = cellState(year, month);
        const clickable =
            Boolean(onCellClick) &&
            (isCellClickable
                ? isCellClickable(year, month, state)
                : state === 'pending');
        const title = cellTitle?.(year, month, state);
        const Icon = stateIcons[state];
        const classes = [
            'flex items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium select-none',
            monthStateClasses[state],
            clickable ? clickableClasses[state] : '',
        ]
            .filter(Boolean)
            .join(' ');
        const content = (
            <>
                {labels[month - 1]}
                <Icon size={12} aria-hidden="true" />
            </>
        );

        if (clickable) {
            return (
                <button
                    key={month}
                    type="button"
                    className={classes}
                    title={title}
                    aria-label={title}
                    onClick={() => onCellClick?.(year, month)}
                >
                    {content}
                </button>
            );
        }
        return (
            <span key={month} className={classes} title={title}>
                {content}
            </span>
        );
    };

    return (
        <div
            className={`grid grid-cols-[2.5rem_repeat(12,minmax(0,1fr))] gap-1 ${className}`}
            role="grid"
        >
            {years.map((year) => (
                <div key={year} role="row" className="contents">
                    <span
                        role="rowheader"
                        className="flex items-center justify-end pr-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300"
                    >
                        {year}
                    </span>
                    {MONTHS.map((month) => renderCell(year, month))}
                </div>
            ))}
        </div>
    );
}
