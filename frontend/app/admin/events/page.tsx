'use client';

import { useState, useEffect, useCallback, Suspense, Fragment, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { AdminWorkSessionRow } from '@/types';
import { formatHM, localeTag, toLocalDateKey } from '@/lib/datetime';
import { configuredTimezone } from '@/lib/timezone';
import Card from '@/components/ui/Card';
import SessionEditorModal from '@/components/SessionEditorModal';
import AdminBackButton from '../../../components/AdminBackButton';
import { usePersistedState } from '@/lib/usePersistedState';
import {
    ADMIN_REPORT_PERIODS,
    AdminReportPeriod,
    CHECK_IN,
    MS_PER_HOUR,
    SOURCE_ADMIN,
    SOURCE_AUTOMATIC,
    SOURCE_USER,
} from 'shared/src/lib/constants';
import {
    ADMIN_EVENTS_PERIOD,
    ADMIN_EVENTS_CURSOR,
    ADMIN_EVENTS_ANOMALY_ONLY,
} from '@/lib/storage';
import {
    ChevronRight,
    ChevronLeft,
    ShieldCheck,
    User,
    Zap,
    CheckCircle2,
    AlertTriangle,
    Palmtree,
    Ban,
} from 'lucide-react';

type Period = AdminReportPeriod;

const PERIODS: Period[] = [...ADMIN_REPORT_PERIODS];

export default function AdminEventsPage() {
    return (
        <Suspense fallback={null}>
            <AdminEventsInner />
        </Suspense>
    );
}

function AdminEventsInner() {
    const { t, lang } = useI18n();
    const searchParams = useSearchParams();

    const urlParamConsumed = useRef(false);

    const [period, setPeriod] = usePersistedState<Period>(ADMIN_EVENTS_PERIOD, 'week');
    const [cursor, setCursor] = usePersistedState<Date>(
        ADMIN_EVENTS_CURSOR,
        () => {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            return now;
        },
        {
            serialize: (d) => d.toISOString(),
            deserialize: (s) => {
                const d = new Date(s);
                d.setHours(0, 0, 0, 0);
                return d;
            },
        }
    );
    const [rows, setRows] = useState<AdminWorkSessionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingRow, setEditingRow] = useState<AdminWorkSessionRow | null>(
        null
    );
    const PAGE_SIZE = 200;
    const [offset, setOffset] = useState(0);
    const [total, setTotal] = useState(0);
    const [anomalyOnly, setAnomalyOnly] = usePersistedState<boolean>(
        ADMIN_EVENTS_ANOMALY_ONLY,
        false
    );

    // Override persisted state from URL params on deep-link (one-time).
    useEffect(() => {
        if (urlParamConsumed.current) return;
        urlParamConsumed.current = true;
        const p = searchParams.get('period');
        if ((ADMIN_REPORT_PERIODS as readonly string[]).includes(p ?? '')) {
            setPeriod(p as Period);
        }
        const d = searchParams.get('date');
        if (d) {
            const parsed = new Date(`${d}T00:00:00`);
            if (!isNaN(parsed.getTime())) {
                parsed.setHours(0, 0, 0, 0);
                setCursor(parsed);
            }
        }
    }, [searchParams, setPeriod, setCursor]);

    const locale = localeTag(lang);

    const loadRows = useCallback(async () => {
        setLoading(true);
        setError(null);
        let params: Parameters<typeof apiClient.getAdminWorkSessions>[0];
        if (period === 'day' || period === 'week') {
            params = {
                period,
                date: toLocalDateKey(cursor),
                limit: PAGE_SIZE,
                offset,
            };
        } else if (period === 'month') {
            params = {
                period,
                year: cursor.getFullYear(),
                month: cursor.getMonth() + 1,
                limit: PAGE_SIZE,
                offset,
            };
        } else {
            params = {
                period,
                year: cursor.getFullYear(),
                limit: PAGE_SIZE,
                offset,
            };
        }

        const res = await apiClient.getAdminWorkSessions(params);
        if (res.error) {
            setError(
                t(`error.${res.error}`) || res.error || t('error.GetError')
            );
            setRows([]);
            setTotal(0);
        } else if (res.data?.rows) {
            setRows(res.data.rows);
            setTotal(res.data.total ?? res.data.rows.length);
        }
        setLoading(false);
    }, [period, cursor, offset, t]);

    useEffect(() => {
        loadRows();
    }, [loadRows]);

    const shiftCursor = (dir: -1 | 1) => {
        setOffset(0);
        const next = new Date(cursor);
        if (period === 'day') next.setDate(next.getDate() + dir);
        else if (period === 'week') next.setDate(next.getDate() + 7 * dir);
        else if (period === 'month') next.setMonth(next.getMonth() + dir);
        else next.setFullYear(next.getFullYear() + dir);
        setCursor(next);
    };

    const periodLabel = () => {
        if (period === 'month') {
            const label = cursor.toLocaleDateString(locale, {
                month: 'long',
                year: 'numeric',
            });
            return label.charAt(0).toUpperCase() + label.slice(1);
        }
        if (period === 'year') return String(cursor.getFullYear());
        const start = cursor.toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
        if (period === 'day') return start;
        const end = new Date(cursor);
        end.setDate(end.getDate() + 6);
        const endLabel = end.toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
        return `${start} — ${endLabel}`;
    };

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

    const filteredRows = anomalyOnly
        ? rows.filter((r) => r.status === 'anomaly')
        : rows;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            <div className="mx-auto max-w-6xl px-4 py-6">
                <AdminBackButton />
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                            {t('admin.events.title')}
                        </h1>
                        <p className="mt-1 text-sm text-zinc-500">
                            {t('admin.events.subtitle')}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
                            {PERIODS.map((p) => (
                                <button
                                    key={p}
                                    onClick={() => {
                                        setOffset(0);
                                        setPeriod(p);
                                    }}
                                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
                            onClick={() => shiftCursor(-1)}
                            className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div className="min-w-[140px] text-center text-sm font-semibold text-zinc-900 dark:text-white">
                            {periodLabel()}
                        </div>
                        <button
                            onClick={() => shiftCursor(1)}
                            className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {(period === 'day' || period === 'week') && (
                    <div className="mb-6">
                        <input
                            type="date"
                            value={toLocalDateKey(cursor)}
                            onChange={(e) => {
                                if (!e.target.value) return;
                                const d = new Date(
                                    e.target.value + 'T00:00:00'
                                );
                                setCursor(d);
                            }}
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                        />
                    </div>
                )}

                {error && (
                    <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* Legend */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
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
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                        <input
                            type="checkbox"
                            checked={anomalyOnly}
                            onChange={(e) => setAnomalyOnly(e.target.checked)}
                            className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        {t('admin.events.anomalyOnly')}
                    </label>
                </div>

                {/* Loading / empty states showing only filtered count */}
                {!loading && anomalyOnly && filteredRows.length === 0 && (
                    <Card className="p-10 text-center text-sm text-zinc-500">
                        {t('admin.events.noAnomalies')}
                    </Card>
                )}

                {loading ? (
                    <div className="p-10 text-center animate-pulse text-zinc-500">
                        {t('common.loading')}
                    </div>
                ) : filteredRows.length === 0 && !anomalyOnly ? (
                    <Card className="p-10 text-center text-sm text-zinc-500">
                        {t('admin.events.noData')}
                    </Card>
                ) : filteredRows.length === 0 ? null : (
                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
                                <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                                    <tr className="text-xs uppercase tracking-wider text-zinc-500">
                                        <th className="w-[36px] px-3 py-3">
                                        </th>
                                        <th className="w-[110px] whitespace-nowrap px-3 py-3 font-semibold">
                                            {t('admin.events.table.date')}
                                        </th>
                                        <th className="w-[150px] px-3 py-3 font-semibold">
                                            {t('admin.events.table.employee')}
                                        </th>
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
                                            filteredRows[i - 1].date !==
                                                row.date;
                                        return (
                                            <Fragment
                                                key={`${row.date}:${row.userId}`}
                                            >
                                                {newDay && (
                                                    <tr aria-hidden="true">
                                                        <td
                                                            colSpan={6}
                                                            className="border-y-2 border-zinc-300 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 py-0.5"
                                                        ></td>
                                                    </tr>
                                                )}
                                                <tr
                                                    className={`${rowClass(row)} cursor-pointer border-b border-zinc-100 transition-colors last:border-b-0 hover:brightness-[0.97] dark:border-zinc-800 dark:hover:brightness-[1.2]`}
                                                    onClick={() =>
                                                        setEditingRow(row)
                                                    }
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
                                                </td>
                                                <td className="truncate px-3 py-3 font-medium text-zinc-900 dark:text-white">
                                                    {row.userName}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {row.sessions.length ===
                                                        0 ? (
                                                            <span className="text-zinc-400">
                                                                —
                                                            </span>
                                                        ) : (
                                                            row.sessions.map(
                                                                (s, i) => {
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
                                                                            {i >
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
                                                    {row.expectedHours}{' '}
                                                    {t('time.h')}
                                                </td>
                                                </tr>
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

                {!anomalyOnly && total > PAGE_SIZE && (
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">
                            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} /{' '}
                            {total}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() =>
                                    setOffset((o) => Math.max(0, o - PAGE_SIZE))
                                }
                                disabled={offset === 0}
                                className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                                aria-label={t(
                                    'admin.events.pagination.previous'
                                )}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                                disabled={offset + PAGE_SIZE >= total}
                                className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                                aria-label={t('admin.events.pagination.next')}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}

                {editingRow && (
                    <SessionEditorModal
                        row={editingRow}
                        onClose={() => setEditingRow(null)}
                        onSaved={loadRows}
                    />
                )}
            </div>
        </div>
    );
}
