'use client';

import { useState, useEffect, useCallback, useMemo, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { AdminWorkSessionRow, User } from '@/types';
import { localeTag, toLocalDateKey, formatPeriodLabel } from '@/lib/datetime';
import { todayKey } from '@/lib/timezone';
import {
    addDaysToKey,
    dateKeyFromParts,
    daysInMonth,
    isValidDateKey,
    type DateKey,
} from 'shared/src/lib/day-key';
import { Download } from 'lucide-react';
import Button from '@/components/ui/Button';
import SessionEditorModal from '@/components/SessionEditorModal';
import AdminBackButton from '../../../components/AdminBackButton';
import FitxatgesTable from '@/components/FitxatgesTable';
import WorkSessionsToolbar from '@/components/WorkSessionsToolbar';
import ExportModal from '@/components/ExportModal';
import { usePersistedState } from '@/lib/usePersistedState';
import {
    ADMIN_REPORT_PERIODS,
    AdminReportPeriod,
} from 'shared/src/lib/constants';
import {
    ADMIN_EVENTS_PERIOD,
    ADMIN_EVENTS_CURSOR,
    ADMIN_EVENTS_ANOMALY_ONLY,
    ADMIN_EVENTS_USER,
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
    const [cursor, setCursor] = usePersistedState<DateKey>(
        ADMIN_EVENTS_CURSOR,
        () => todayKey(),
        {
            serialize: (k) => k,
            deserialize: (s) => {
                if (isValidDateKey(s)) return s as DateKey;
                const d = new Date(s);
                return isNaN(d.getTime()) ? todayKey() : toLocalDateKey(d);
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
    const [timetableToleranceMinutes, setTimetableToleranceMinutes] =
        useState(0);
    const PAGE_SIZE = 200;
    const [offset, setOffset] = useState(0);
    const [total, setTotal] = useState(0);
    const [anomalyOnly, setAnomalyOnly] = usePersistedState<boolean>(
        ADMIN_EVENTS_ANOMALY_ONLY,
        false
    );
    const [users, setUsers] = useState<User[]>([]);
    const [userFilter, setUserFilter] = usePersistedState<string>(
        ADMIN_EVENTS_USER,
        'all'
    );
    const [exportOpen, setExportOpen] = useState(false);

    useEffect(() => {
        const load = async () => {
            const res = await apiClient.getCompanyUsers();
            if (!res.error && res.data?.users) setUsers(res.data.users);
        };
        load();
    }, []);

    const filteredRows = useMemo(
        () =>
            userFilter === 'all'
                ? rows
                : rows.filter((r) => r.userId === userFilter),
        [rows, userFilter]
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
        if (d && isValidDateKey(d)) {
            setCursor(d as DateKey);
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
                date: cursor,
                limit: PAGE_SIZE,
                offset,
            };
        } else if (period === 'month') {
            params = {
                period,
                year: Number(cursor.slice(0, 4)),
                month: Number(cursor.slice(5, 7)),
                limit: PAGE_SIZE,
                offset,
            };
        } else {
            params = {
                period,
                year: Number(cursor.slice(0, 4)),
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
            setTimetableToleranceMinutes(
                res.data.timetableToleranceMinutes ?? 0
            );
        }
        setLoading(false);
    }, [period, cursor, offset, t]);

    useEffect(() => {
        loadRows();
    }, [loadRows]);

    const shiftCursor = (dir: -1 | 1) => {
        setOffset(0);
        const [y, m, d] = cursor.split('-').map(Number);
        if (period === 'day') setCursor(addDaysToKey(cursor, dir));
        else if (period === 'week') setCursor(addDaysToKey(cursor, 7 * dir));
        else if (period === 'month') {
            const nm = m + dir;
            const ny = nm < 1 ? y - 1 : nm > 12 ? y + 1 : y;
            const norm = nm < 1 ? 12 : nm > 12 ? 1 : nm;
            setCursor(
                dateKeyFromParts(ny, norm, Math.min(d, daysInMonth(ny, norm)))
            );
        } else {
            const ny = y + dir;
            setCursor(
                dateKeyFromParts(ny, m, Math.min(d, daysInMonth(ny, m)))
            );
        }
    };

    const periodLabel = () =>
        formatPeriodLabel(cursor, period, locale);

    const changePeriod = (p: Period) => {
        setOffset(0);
        setPeriod(p);
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
                        onClick={() => setExportOpen(true)}
                        variant="soft"
                    >
                        <Download size={16} />
                        {t('export.button')}
                    </Button>
                </div>

                {error && (
                    <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                    </div>
                )}

                <div className="mb-4">
                    <WorkSessionsToolbar
                        period={period}
                        onPeriodChange={changePeriod}
                        cursor={cursor}
                        onCursorChange={(d) => {
                            setOffset(0);
                            setCursor(d as DateKey);
                        }}
                        onShift={shiftCursor}
                        anomalyOnly={anomalyOnly}
                        onAnomalyOnlyChange={setAnomalyOnly}
                        periodLabel={periodLabel()}
                        users={users}
                        userId={userFilter}
                        onUserChange={setUserFilter}
                    />
                </div>

                <FitxatgesTable
                    rows={filteredRows}
                    loading={loading}
                    anomalyOnly={anomalyOnly}
                    total={total}
                    offset={offset}
                    pageSize={PAGE_SIZE}
                    onPageChange={setOffset}
                    onRowClick={(row) => setEditingRow(row)}
                    showEmployee
                    approvedMonths={approvedMonths}
                    timetableToleranceMinutes={timetableToleranceMinutes}
                />

                {editingRow && (
                    <SessionEditorModal
                        row={editingRow}
                        onClose={() => setEditingRow(null)}
                        onSaved={loadRows}
                    />
                )}

                <ExportModal
                    open={exportOpen}
                    onClose={() => setExportOpen(false)}
                    users={users}
                    initialUserIds={
                        userFilter !== 'all' ? [userFilter] : undefined
                    }
                />
            </div>
        </div>
    );
}
