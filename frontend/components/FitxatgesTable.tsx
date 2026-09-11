'use client';

import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { useI18n } from '@/app/i18n';
import { AdminWorkSessionRow } from '@/types';
import { formatHM, localeTag } from '@/lib/datetime';
import { formatClockHM } from '@/lib/timezone';
import type { TimetableEntry } from '@/lib/timetable';
import TimetableList from '@/components/autoTimetable/TimetableList';
import {
    statusRowClass,
    statusIconOf,
    sourceIconOf,
} from '@/lib/workDayVisuals';
import {
    computePairDeviations,
    timeToMinutes,
    type TimetablePair,
} from 'shared/src/lib/expected-timetable';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import LoadingState from '@/components/ui/LoadingState';
import EmptyState from '@/components/ui/EmptyState';
import { CHECK_IN, MS_PER_HOUR } from 'shared/src/lib/constants';
import { Lock, Clock, CalendarX, CheckCircle2, AlertTriangle } from 'lucide-react';

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
    timetableToleranceMinutes?: number;
}

type IntervalTone = 'ok' | 'overtime' | 'problem';

type WorkedInterval = TimetableEntry & {
    overtime: boolean;
    problem: boolean;
};

const MISSING_TIME = '—';

const intervalToneVisuals: Record<
    IntervalTone,
    { className: string; icon: ReactNode }
> = {
    ok: { className: 'bg-green-500 text-white', icon: null },
    overtime: {
        className: 'bg-purple-500 text-white',
        icon: <Clock size={12} />,
    },
    problem: {
        className: 'bg-red-500 text-white',
        icon: <AlertTriangle size={12} />,
    },
};

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
    timetableToleranceMinutes = 0,
}: FitxatgesTableProps) {
    const { t, lang } = useI18n();
    const locale = localeTag(lang);

    const filteredRows = anomalyOnly
        ? rows.filter((r) => r.status === 'anomaly')
        : rows;

    const fmtTime = (ts: Date | string) => formatClockHM(ts, locale);

    const dateLabelOf = (row: AdminWorkSessionRow) =>
        new Date(`${row.date}T00:00:00`).toLocaleDateString(locale, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
        });

    const isConfirmedRow = (row: AdminWorkSessionRow) =>
        approvedMonths?.has(`${row.userId}:${row.date.slice(0, 7)}`) ?? false;

    const rowClass = (row: AdminWorkSessionRow) => statusRowClass(row.status);

    const renderStatusIcon = (status: AdminWorkSessionRow['status']) => {
        const { Icon, className } = statusIconOf(status);
        return <Icon className={className} />;
    };

    const totalHoursLabel = (row: AdminWorkSessionRow) =>
        row.totalHours > 0
            ? formatHM(row.totalHours * MS_PER_HOUR, t)
            : MISSING_TIME;

    const workedIntervals = (row: AdminWorkSessionRow): WorkedInterval[] => {
        const intervals: Array<{
            checkIn: string;
            checkOut: string;
            overtime: boolean;
        }> = [];
        let open: { checkIn: string; overtime: boolean } | null = null;
        const sorted = [...row.sessions].sort(
            (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
        );
        for (const s of sorted) {
            const time = fmtTime(s.timestamp);
            if (s.type === CHECK_IN) {
                if (open) {
                    intervals.push({
                        checkIn: open.checkIn,
                        checkOut: MISSING_TIME,
                        overtime: open.overtime,
                    });
                }
                open = { checkIn: time, overtime: s.overtime === true };
            } else if (open) {
                intervals.push({
                    checkIn: open.checkIn,
                    checkOut: time,
                    overtime: open.overtime || s.overtime === true,
                });
                open = null;
            } else {
                intervals.push({
                    checkIn: MISSING_TIME,
                    checkOut: time,
                    overtime: s.overtime === true,
                });
            }
        }
        if (open) {
            intervals.push({
                checkIn: open.checkIn,
                checkOut: MISSING_TIME,
                overtime: open.overtime,
            });
        }

        const closedIndexes: number[] = [];
        const closedPairs: TimetablePair[] = [];
        intervals.forEach((interval, idx) => {
            if (
                interval.checkIn !== MISSING_TIME &&
                interval.checkOut !== MISSING_TIME
            ) {
                closedIndexes.push(idx);
                closedPairs.push({
                    checkIn: timeToMinutes(interval.checkIn),
                    checkOut: timeToMinutes(interval.checkOut),
                });
            }
        });
        const expected = row.timetable;
        const deviations =
            expected && expected.length > 0
                ? computePairDeviations(
                      closedPairs,
                      expected,
                      timetableToleranceMinutes
                  )
                : [];

        return intervals.map((interval, i) => {
            const unclosed =
                interval.checkIn === MISSING_TIME ||
                interval.checkOut === MISSING_TIME;
            const closedOrder = closedIndexes.indexOf(i);
            const deviates =
                !!expected &&
                (i >= expected.length ||
                    (closedOrder >= 0 &&
                        closedOrder < expected.length &&
                        Object.values(deviations[closedOrder] ?? {}).some(
                            Boolean
                        )));
            return {
                ...interval,
                problem: unclosed || !!deviates,
            };
        });
    };

    const intervalTone = (entry: WorkedInterval): IntervalTone => {
        if (entry.problem) return 'problem';
        return entry.overtime ? 'overtime' : 'ok';
    };

    const renderWorkedIntervals = (row: AdminWorkSessionRow) => {
        if (row.sessions.length === 0) {
            return <span className="text-zinc-400">{MISSING_TIME}</span>;
        }
        return (
            <TimetableList
                timetable={workedIntervals(row)}
                entryClassName={(entry) =>
                    intervalToneVisuals[intervalTone(entry)].className
                }
                entryTitle={(entry) =>
                    entry.problem
                        ? t('admin.events.intervalProblem')
                        : entry.overtime
                          ? t('admin.events.overtime')
                          : undefined
                }
                entryIcon={(entry) =>
                    intervalToneVisuals[intervalTone(entry)].icon
                }
            />
        );
    };

    const renderExpected = (row: AdminWorkSessionRow) =>
        row.timetable ? (
            <TimetableList timetable={row.timetable} />
        ) : (
            <span className="whitespace-nowrap">
                {row.expectedHours} {t('time.h')}
            </span>
        );

    const renderDaySource = (row: AdminWorkSessionRow) => {
        if (!row.source) return <span className="text-zinc-400">—</span>;
        const Icon = sourceIconOf(row.source);
        const label = t(`admin.events.source.${row.source}`);
        return (
            <span
                title={label}
                className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400"
            >
                <Icon size={14} />
                {label}
            </span>
        );
    };

    // Loading / empty states showing only filtered count
    if (loading) {
        return <LoadingState />;
    }

    if (filteredRows.length === 0) {
        if (anomalyOnly) {
            return (
                <EmptyState
                    icon={<CheckCircle2 size={24} />}
                    title={t('admin.events.noAnomalies')}
                />
            );
        }
        return (
            <EmptyState
                icon={<CalendarX size={24} />}
                title={t('admin.events.noData')}
            />
        );
    }

    const colSpan = showEmployee ? 7 : 6;

    return (
        <>
            {/* Desktop: full table (≥640px). The Expected column sizes itself
                to the widest timetable in the period; chip lists wrap inside. */}
            <Card className="hidden overflow-hidden sm:block">
                <div className="overflow-x-auto">
                    <table className="w-full table-auto border-separate border-spacing-0 text-left text-sm">
                        <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                            <tr className="text-xs uppercase tracking-wider text-zinc-500">
                                <th className="w-[36px] px-3 py-3"></th>
                                <th className="w-[110px] whitespace-nowrap px-3 py-3 font-semibold">
                                    {t('admin.events.table.date')}
                                </th>
                                {showEmployee && (
                                    <th className="w-[150px] whitespace-nowrap px-3 py-3 font-semibold">
                                        {t('admin.events.table.employee')}
                                    </th>
                                )}
                                <th className="whitespace-nowrap px-3 py-3 font-semibold">
                                    {t('admin.events.table.expected')}
                                </th>
                                <th className="w-[70px] whitespace-nowrap px-3 py-3 text-right font-semibold">
                                    {t('admin.events.table.hours')}
                                </th>
                                <th className="whitespace-nowrap px-3 py-3 font-semibold">
                                    {t('admin.events.table.sessions')}
                                </th>
                                <th className="whitespace-nowrap px-3 py-3 font-semibold">
                                    {t('admin.events.table.source')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map((row, i) => {
                                const dateLabel = dateLabelOf(row);
                                const newDay =
                                    i > 0 &&
                                    filteredRows[i - 1].date !== row.date;
                                const isConfirmed = isConfirmedRow(row);

                                return (
                                    <Fragment key={`${row.date}:${row.userId}`}>
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
                                                !isConfirmed &&
                                                onRowClick?.(row)
                                            }
                                            title={
                                                isConfirmed
                                                    ? t(
                                                          'admin.events.monthConfirmed'
                                                      )
                                                    : undefined
                                            }
                                        >
                                            <td
                                                className="whitespace-nowrap px-3 py-3"
                                                title={t(
                                                    `admin.events.status.${row.status}`
                                                )}
                                            >
                                                {renderStatusIcon(row.status)}
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
                                                        <Lock
                                                            size={14}
                                                            className="text-zinc-400 dark:text-zinc-500"
                                                        />
                                                    </span>
                                                )}
                                            </td>
                                            {showEmployee && (
                                                <td className="whitespace-nowrap px-3 py-3 font-medium text-zinc-900 dark:text-white">
                                                    {row.userName}
                                                </td>
                                            )}
                                            <td className="px-3 py-3 text-zinc-500">
                                                {renderExpected(row)}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-zinc-900 dark:text-white">
                                                {totalHoursLabel(row)}
                                            </td>
                                            <td className="px-3 py-3">
                                                {renderWorkedIntervals(row)}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3">
                                                {renderDaySource(row)}
                                            </td>
                                        </tr>
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Mobile (<640px): the same data as stacked cards. A fixed-width
                table either overflows horizontally or squeezes its headers
                into each other on phones; one card per day keeps every field
                readable and the whole card is the tap target. */}
            <Card className="space-y-2 p-2 sm:hidden">
                {filteredRows.map((row) => {
                    const isConfirmed = isConfirmedRow(row);
                    return (
                        <button
                            type="button"
                            key={`${row.date}:${row.userId}`}
                            disabled={isConfirmed}
                            onClick={() => !isConfirmed && onRowClick?.(row)}
                            title={
                                isConfirmed
                                    ? t('admin.events.monthConfirmed')
                                    : undefined
                            }
                            className={`block w-full rounded-lg p-3 text-left transition-transform active:scale-[0.99] ${rowClass(
                                row
                            )} ${
                                isConfirmed
                                    ? 'cursor-not-allowed opacity-75'
                                    : 'cursor-pointer'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                                    {renderStatusIcon(row.status)}
                                    <span className="truncate">
                                        {dateLabelOf(row)}
                                    </span>
                                    {isConfirmed && (
                                        <Lock
                                            size={14}
                                            className="shrink-0 text-zinc-400 dark:text-zinc-500"
                                        />
                                    )}
                                </span>
                                <span className="shrink-0 text-sm font-medium text-zinc-900 dark:text-white">
                                    {totalHoursLabel(row)}
                                </span>
                            </div>

                            {showEmployee && (
                                <div className="mt-0.5 truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                    {row.userName}
                                </div>
                            )}

                            <div className="mt-2">
                                {renderWorkedIntervals(row)}
                            </div>

                            <div className="mt-2 space-y-1.5 border-t border-zinc-900/10 pt-2 text-xs dark:border-white/10">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-zinc-600 dark:text-zinc-300">
                                        {t('admin.events.table.hours')}
                                    </span>
                                    <span className="font-semibold text-zinc-900 dark:text-white">
                                        {totalHoursLabel(row)}
                                    </span>
                                </div>
                                <div className="flex items-start justify-between gap-2">
                                    <span className="shrink-0 text-zinc-600 dark:text-zinc-300">
                                        {t('admin.events.table.expected')}
                                    </span>
                                    <div className="text-right text-zinc-500 dark:text-zinc-400">
                                        {renderExpected(row)}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-zinc-600 dark:text-zinc-300">
                                        {t('admin.events.table.source')}
                                    </span>
                                    {renderDaySource(row)}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </Card>

            {!anomalyOnly && (
                <Pagination
                    offset={offset}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={onPageChange}
                />
            )}
        </>
    );
}
