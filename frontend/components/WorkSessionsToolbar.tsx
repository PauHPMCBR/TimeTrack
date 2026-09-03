'use client';

import { useI18n } from '@/app/i18n';
import { toLocalDateKey } from '@/lib/datetime';
import {
    ADMIN_REPORT_PERIODS,
    AdminReportPeriod,
} from 'shared/src/lib/constants';
import {
    ChevronRight,
    ChevronLeft,
    ShieldCheck,
    User,
    Zap,
    Lock,
} from 'lucide-react';

type Period = AdminReportPeriod;

// Exclude the year period: it loads too many rows to be practical.
const PERIODS: Period[] = ADMIN_REPORT_PERIODS.filter((p) => p !== 'year');

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
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
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

                    <button
                        onClick={() => onShift(-1)}
                        className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="min-w-[320px] px-1 text-center text-sm font-semibold text-zinc-900 dark:text-white">
                        {periodLabel}
                    </div>
                    <button
                        onClick={() => onShift(1)}
                        className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                <input
                    type="date"
                    value={toLocalDateKey(cursor)}
                    onChange={(e) => {
                        if (!e.target.value) return;
                        const d = new Date(e.target.value + 'T00:00:00');
                        onCursorChange(d);
                    }}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
                        {t('admin.events.status.ok')}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
                        {t('admin.events.status.anomaly')}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                        {t('admin.events.status.vacation')}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-zinc-400"></span>
                        {t('admin.events.status.nonWorkingDay')}
                    </span>
                    <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-700"></span>
                    <span className="flex items-center gap-1.5">
                        <User size={12} />
                        {t('admin.events.source.user')}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <ShieldCheck size={12} />
                        {t('admin.events.source.admin')}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Zap size={12} />
                        {t('admin.events.source.automatic')}
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
