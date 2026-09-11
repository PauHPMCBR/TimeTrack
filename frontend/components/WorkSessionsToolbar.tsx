'use client';

import { useI18n } from '@/app/i18n';
import { toLocalDateKey } from '@/lib/datetime';
import StepperNav from '@/components/ui/StepperNav';
import { sourceIconOf, statusDotClass } from '@/lib/workDayVisuals';
import type { SourceKind } from '@/schemas/database';
import {
    ADMIN_REPORT_PERIODS,
    AdminReportPeriod,
} from 'shared/src/lib/constants';
import { Clock, Lock } from 'lucide-react';

type Period = AdminReportPeriod;

// Exclude the year period: it loads too many rows to be practical.
const PERIODS: Period[] = ADMIN_REPORT_PERIODS.filter((p) => p !== 'year');

const LEGEND_SOURCES: SourceKind[] = [
    'userClick',
    'userManual',
    'adminManual',
    'userAutomatic',
];

interface WorkSessionsToolbarProps {
    period: Period;
    onPeriodChange: (period: Period) => void;
    cursor: Date;
    onCursorChange: (cursor: Date) => void;
    onShift: (dir: -1 | 1) => void;
    anomalyOnly: boolean;
    onAnomalyOnlyChange: (value: boolean) => void;
    periodLabel: string;
}

export default function WorkSessionsToolbar({
    period,
    onPeriodChange,
    cursor,
    onCursorChange,
    onShift,
    anomalyOnly,
    onAnomalyOnlyChange,
    periodLabel,
}: WorkSessionsToolbarProps) {
    const { t } = useI18n();

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Narrow screens: pills + date picker share the first row and
                    the ‹ period › navigator gets its own full-width row, so the
                    label stays on ONE line. sm+: everything back on one row. */}
                <div className="order-1 flex min-w-0 items-center gap-1.5">
                    <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
                        {PERIODS.map((p) => (
                            <button
                                key={p}
                                onClick={() => onPeriodChange(p)}
                                className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                                    period === p
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                                }`}
                            >
                                {t(`admin.events.period.${p}`)}
                            </button>
                        ))}
                    </div>
                </div>

                <input
                    type="date"
                    value={toLocalDateKey(cursor)}
                    onChange={(e) => {
                        if (!e.target.value) return;
                        const d = new Date(e.target.value + 'T00:00:00');
                        onCursorChange(d);
                    }}
                    className="order-2 shrink-0 rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white sm:order-3"
                />

                <div className="order-3 flex w-full min-w-0 items-center sm:order-2 sm:w-auto sm:flex-1">
                    <StepperNav
                        onPrev={() => onShift(-1)}
                        onNext={() => onShift(1)}
                        className="w-full sm:w-auto sm:flex-1"
                    >
                        {periodLabel}
                    </StepperNav>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="flex items-center gap-1.5">
                        <span
                            className={`h-2.5 w-2.5 rounded-full ${statusDotClass('ok')}`}
                        ></span>
                        {t('admin.events.status.ok')}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span
                            className={`h-2.5 w-2.5 rounded-full ${statusDotClass('anomaly')}`}
                        ></span>
                        {t('admin.events.status.anomaly')}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span
                            className={`h-2.5 w-2.5 rounded-full ${statusDotClass('vacation')}`}
                        ></span>
                        {t('admin.events.status.vacation')}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span
                            className={`h-2.5 w-2.5 rounded-full ${statusDotClass('nonWorkingDay')}`}
                        ></span>
                        {t('admin.events.status.nonWorkingDay')}
                    </span>
                    <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-700"></span>
                    {LEGEND_SOURCES.map((source) => {
                        const Icon = sourceIconOf(source);
                        return (
                            <span
                                key={source}
                                className="flex items-center gap-1.5"
                            >
                                <Icon size={12} />
                                {t(`admin.events.source.${source}`)}
                            </span>
                        );
                    })}
                    <span className="flex items-center gap-1.5">
                        <Clock size={12} />
                        {t('admin.events.legend.overtime')}
                    </span>
                    <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-700"></span>
                    <span className="flex items-center gap-1.5">
                        <Lock size={12} />
                        {t('admin.events.status.confirmed')}
                    </span>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <input
                        type="checkbox"
                        checked={anomalyOnly}
                        onChange={(e) => onAnomalyOnlyChange(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {t('admin.events.anomalyOnly')}
                </label>
            </div>
        </div>
    );
}
