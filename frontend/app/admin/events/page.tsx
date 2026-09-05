'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { AdminWorkSessionRow, User } from '@/types';
import { localeTag, toLocalDateKey } from '@/lib/datetime';
import { Download } from 'lucide-react';
import Button from '@/components/ui/Button';
import SessionEditorModal from '@/components/SessionEditorModal';
import AdminBackButton from '../../../components/AdminBackButton';
import FitxatgesTable from '@/components/FitxatgesTable';
import WorkSessionsToolbar from '@/components/WorkSessionsToolbar';
import { usePersistedState } from '@/lib/usePersistedState';
import {
    ADMIN_REPORT_PERIODS,
    AdminReportPeriod,
} from 'shared/src/lib/constants';
import {
    ADMIN_EVENTS_PERIOD,
    ADMIN_EVENTS_CURSOR,
    ADMIN_EVENTS_ANOMALY_ONLY,
} from '@/lib/storage';

type Period = AdminReportPeriod;

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
    const [approvedMonths, setApprovedMonths] = useState<Set<string>>(
        new Set()
    );
    const PAGE_SIZE = 200;
    const [offset, setOffset] = useState(0);
    const [total, setTotal] = useState(0);
    const [anomalyOnly, setAnomalyOnly] = usePersistedState<boolean>(
        ADMIN_EVENTS_ANOMALY_ONLY,
        false
    );
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

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
            setApprovedMonths(
                new Set(res.data.approvedMonths ?? [])
            );
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

    const changePeriod = (p: Period) => {
        setOffset(0);
        setPeriod(p);
    };

    const exportRange = (): { from: string; to: string } => {
        const start = new Date(cursor);
        start.setHours(0, 0, 0, 0);
        const end = new Date(cursor);
        end.setHours(0, 0, 0, 0);
        if (period === 'week') {
            end.setDate(end.getDate() + 6);
        } else if (period === 'month') {
            end.setMonth(end.getMonth() + 1, 0);
        } else if (period === 'year') {
            start.setMonth(0, 1);
            end.setMonth(11, 31);
        }
        return { from: toLocalDateKey(start), to: toLocalDateKey(end) };
    };

    const handleExport = async () => {
        setExporting(true);
        setExportError(null);
        const res = await apiClient.getCompanyUsers();
        if (res.error || !res.data?.users) {
            setExporting(false);
            setExportError(res.error ?? 'GetError');
            return;
        }
        const userIds = res.data.users.map((u: User) => u._id);
        const exportRes = await apiClient.exportWorkSessions(
            userIds,
            exportRange()
        );
        setExporting(false);
        if (exportRes.error) setExportError(exportRes.error);
    };

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
                    <Button
                        onClick={handleExport}
                        disabled={exporting}
                        variant="soft"
                    >
                        <Download size={16} />
                        {exporting
                            ? t('common.loading')
                            : t('admin.export.button')}
                    </Button>
                </div>

                {error && (
                    <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                    </div>
                )}

                {exportError && (
                    <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {t('admin.export.error')} ({exportError})
                    </div>
                )}

                <div className="mb-4">
                    <WorkSessionsToolbar
                        period={period}
                        onPeriodChange={changePeriod}
                        cursor={cursor}
                        onCursorChange={(d) => {
                            setOffset(0);
                            setCursor(d);
                        }}
                        onShift={shiftCursor}
                        anomalyOnly={anomalyOnly}
                        onAnomalyOnlyChange={setAnomalyOnly}
                        periodLabel={periodLabel()}
                    />
                </div>

                <FitxatgesTable
                    rows={rows}
                    loading={loading}
                    anomalyOnly={anomalyOnly}
                    total={total}
                    offset={offset}
                    pageSize={PAGE_SIZE}
                    onPageChange={setOffset}
                    onRowClick={(row) => setEditingRow(row)}
                    showEmployee
                    approvedMonths={approvedMonths}
                />

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
