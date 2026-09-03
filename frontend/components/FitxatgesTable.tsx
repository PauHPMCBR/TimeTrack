'use client';

import { Fragment } from 'react';
import { useI18n } from '@/app/i18n';
import { AdminWorkSessionRow } from '@/types';
import { formatHM, localeTag } from '@/lib/datetime';
import { configuredTimezone } from '@/lib/timezone';
import Card from '@/components/ui/Card';
import {
    CHECK_IN,
    MS_PER_HOUR,
    SOURCE_ADMIN,
    SOURCE_AUTOMATIC,
    SOURCE_USER,
} from 'shared/src/lib/constants';
import {
    ChevronLeft,
    ChevronRight,
    ShieldCheck,
    User,
    Zap,
    CheckCircle2,
    AlertTriangle,
    Palmtree,
    Ban,
    Lock,
} from 'lucide-react';

interface FitxatgesTableProps {
    rows: AdminWorkSessionRow[];
    loading: boolean;
    anomalyOnly: boolean;
    total: number;
    offset: number;
    pageSize: number;
    onPageChange: (offset: number) => void;
    onRowClick?: (row: AdminWorkSessionRow) => void;
    showEmployee?: boolean;
    approvedMonths?: Set<string>;
}

export default function FitxatgesTable({
    rows,
    loading,
    anomalyOnly,
    total,
    offset,
    pageSize,
    onPageChange,
    onRowClick,
    showEmployee = false,
    approvedMonths,
}: FitxatgesTableProps) {
    const { t, lang } = useI18n();
    const locale = localeTag(lang);

    const filteredRows = anomalyOnly
        ? rows.filter((r) => r.status === 'anomaly')
        : rows;

    const fmtTime = (ts: Date | string) =>
        new Intl.DateTimeFormat(locale, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: configuredTimezone(),
        }).format(new Date(ts));

    const rowClass = (row: AdminWorkSessionRow) => {
        if (row.status === 'vacation')
            return 'border-l-4 border-l-blue-500 bg-blue-100/90 dark:bg-blue-900/40';
        if (row.status === 'ok')
            return 'border-l-4 border-l-green-500 bg-green-100/90 dark:bg-green-900/40';
        if (row.status === 'nonWorkingDay')
            return 'border-l-4 border-l-zinc-300 bg-zinc-100/80 dark:bg-zinc-800/60 dark:border-l-zinc-600';
        return 'border-l-4 border-l-red-500 bg-red-100/90 dark:bg-red-900/40';
    };

    const statusIcon = (status: AdminWorkSessionRow['status']) => {
        if (status === 'ok')
            return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
        if (status === 'anomaly')
            return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
        if (status === 'vacation')
            return <Palmtree className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
        return <Ban className="h-4 w-4 text-zinc-400" />;
    };

    // Loading / empty states showing only filtered count
    if (!loading && anomalyOnly && filteredRows.length === 0) {
        return (
            <Card className="p-10 text-center text-sm text-zinc-500">
                {t('admin.events.noAnomalies')}
            </Card>
        );
    }

    if (loading) {
        return (
            <div className="p-10 text-center animate-pulse text-zinc-500">
                {t('common.loading')}
            </div>
        );
    }

    if (filteredRows.length === 0 && !anomalyOnly) {
        return (
            <Card className="p-10 text-center text-sm text-zinc-500">
                {t('admin.events.noData')}
            </Card>
        );
    }

    if (filteredRows.length === 0) {
        return null;
    }

    const colSpan = showEmployee ? 6 : 5;

    return (
        <>
            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
                        <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                            <tr className="text-xs uppercase tracking-wider text-zinc-500">
                                <th className="w-[36px] px-3 py-3"></th>
                                <th className="w-[110px] whitespace-nowrap px-3 py-3 font-semibold">
                                    {t('admin.events.table.date')}
                                </th>
                                {showEmployee && (
                                    <th className="w-[150px] px-3 py-3 font-semibold">
                                        {t('admin.events.table.employee')}
                                    </th>
                                )}
                                <th className="px-3 py-3 font-semibold">
                                    {t('admin.events.table.sessions')}
                                </th>
                                <th className="w-[70px] whitespace-nowrap px-3 py-3 text-right font-semibold">
                                    {t('admin.events.table.hours')}
                                </th>
                                <th className="w-[96px] whitespace-nowrap px-3 py-3 text-right font-semibold">
                                    {t('admin.events.table.expected')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map((row, i) => {
                                 const dateLabel = new Date(
                                     `${row.date}T00:00:00`
                                 ).toLocaleDateString(locale, {
                                     weekday: 'short',
                                     day: 'numeric',
                                     month: 'short',
                                 });
                                 const newDay =
                                     i > 0 &&
                                     filteredRows[i - 1].date !== row.date;
                                 const monthKey = row.date.slice(0, 7);
                                 const userMonthKey = `${row.userId}:${monthKey}`;
                                 const isConfirmed = approvedMonths?.has(
                                     userMonthKey
                                 ) ?? false;

                                 return (
                                     <Fragment
                                         key={`${row.date}:${row.userId}`}
                                     >
                                         {newDay && (
                                             <tr aria-hidden="true">
                                                 <td
                                                     colSpan={colSpan}
                                                     className="border-y-2 border-zinc-300 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 py-0.5"
                                                 ></td>
                                             </tr>
                                         )}
                                         <tr
                                             className={`${rowClass(row)} ${isConfirmed ? 'border-r-2 border-r-zinc-300 dark:border-r-zinc-600 cursor-not-allowed opacity-75' : 'cursor-pointer'} border-b border-zinc-100 transition-colors last:border-b-0 hover:brightness-[0.97] dark:border-zinc-800 dark:hover:brightness-[1.2]`}
                                             onClick={() =>
                                                 !isConfirmed && onRowClick?.(row)
                                             }
                                             title={isConfirmed ? t('admin.events.monthConfirmed') : undefined}
                                         >
                                             <td
                                                 className="whitespace-nowrap px-3 py-3"
                                                 title={t(
                                                     `admin.events.status.${row.status}`
                                                 )}
                                             >
                                                 {statusIcon(row.status)}
                                             </td>
                                             <td className="whitespace-nowrap px-3 py-3 text-xs font-medium text-zinc-900 dark:text-white">
                                                 {dateLabel}
                                                 {isConfirmed && (
                                                     <span
                                                         title={t(
                                                             'admin.events.status.confirmed'
                                                         )}
                                                         className="inline-block ml-1"
                                                     >
                                                         <Lock size={14} className="text-zinc-400 dark:text-zinc-500" />
                                                     </span>
                                                 )}
                                             </td>
                                            {showEmployee && (
                                                <td className="truncate px-3 py-3 font-medium text-zinc-900 dark:text-white">
                                                    {row.userName}
                                                </td>
                                            )}
                                            <td className="px-3 py-3">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {row.sessions.length === 0 ? (
                                                        <span className="text-zinc-400">
                                                            —
                                                        </span>
                                                    ) : (
                                                        row.sessions.map(
                                                            (s, idx) => {
                                                                const source =
                                                                    s.source ??
                                                                    SOURCE_USER;
                                                                const SourceIcon =
                                                                    source ===
                                                                    SOURCE_ADMIN
                                                                        ? ShieldCheck
                                                                        : source ===
                                                                          SOURCE_AUTOMATIC
                                                                          ? Zap
                                                                          : User;
                                                                return (
                                                                    <span
                                                                        key={
                                                                            s._id
                                                                        }
                                                                        className="flex items-center gap-1"
                                                                    >
                                                                        {idx >
                                                                            0 && (
                                                                            <span className="text-zinc-400">
                                                                                →
                                                                            </span>
                                                                        )}
                                                                        <span
                                                                            title={t(
                                                                                `admin.events.source.${source}`
                                                                            )}
                                                                            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium text-white ${
                                                                                s.type ===
                                                                                CHECK_IN
                                                                                    ? 'bg-green-500'
                                                                                    : 'bg-red-500'
                                                                            }`}
                                                                        >
                                                                            <SourceIcon
                                                                                size={
                                                                                    14
                                                                                }
                                                                            />
                                                                            {fmtTime(
                                                                                s.timestamp
                                                                            )}
                                                                        </span>
                                                                    </span>
                                                                );
                                                            }
                                                        )
                                                    )}
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-zinc-900 dark:text-white">
                                                {row.totalHours > 0
                                                    ? formatHM(
                                                          row.totalHours *
                                                              MS_PER_HOUR,
                                                          t
                                                      )
                                                    : '—'}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3 text-right text-zinc-500">
                                                {row.expectedHours} {t('time.h')}
                                            </td>
                                        </tr>
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {!anomalyOnly && total > pageSize && (
                <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {offset + 1}–{Math.min(offset + pageSize, total)} /{' '}
                        {total}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() =>
                                onPageChange(Math.max(0, offset - pageSize))
                            }
                            disabled={offset === 0}
                            className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                            aria-label={t('admin.events.pagination.previous')}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => onPageChange(offset + pageSize)}
                            disabled={offset + pageSize >= total}
                            className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                            aria-label={t('admin.events.pagination.next')}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
