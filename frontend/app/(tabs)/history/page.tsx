'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { AdminWorkSessionRow } from '@/types';
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
import FitxatgesTable from '@/components/FitxatgesTable';
import WorkSessionsToolbar from '@/components/WorkSessionsToolbar';
import MonthlyConfirmationCard from '@/components/MonthlyConfirmationCard';
import SessionEditorModal from '@/components/SessionEditorModal';
import ExportModal from '@/components/ExportModal';
import { usePersistedState } from '@/lib/usePersistedState';
import {
    AdminReportPeriod,
} from 'shared/src/lib/constants';
import {
    HISTORY_PERIOD,
    HISTORY_CURSOR,
    HISTORY_ANOMALY_ONLY,
} from '@/lib/storage';

type Period = AdminReportPeriod;

export default function HistoryPage() {
    const { t, lang } = useI18n();
    const locale = localeTag(lang);

    const [period, setPeriod] = usePersistedState<Period>(HISTORY_PERIOD, 'week');
    const [cursor, setCursor] = usePersistedState<DateKey>(
        HISTORY_CURSOR,
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
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [approvedMonths, setApprovedMonths] = useState<Set<string>>(
        new Set()
    );
    const [timetableToleranceMinutes, setTimetableToleranceMinutes] =
        useState(0);
    const [anomalyOnly, setAnomalyOnly] = usePersistedState<boolean>(
        HISTORY_ANOMALY_ONLY,
        false
    );
    const [editingRow, setEditingRow] = useState<AdminWorkSessionRow | null>(
        null
    );
    const [exportOpen, setExportOpen] = useState(false);
    const PAGE_SIZE = 200;

    const loadRows = useCallback(async () => {
        setLoading(true);
        setError(null);
        let params: Parameters<typeof apiClient.getMyWorkSessions>[0];
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

        const res = await apiClient.getMyWorkSessions(params);
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
        <section className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                    {t('tabs.history')}
                </h2>
                <Button variant="soft" onClick={() => setExportOpen(true)}>
                    <Download size={16} />
                    {t('export.button')}
                </Button>
            </div>

            {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

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
            />

            <FitxatgesTable
                rows={rows}
                loading={loading}
                anomalyOnly={anomalyOnly}
                total={total}
                offset={offset}
                pageSize={PAGE_SIZE}
                onPageChange={setOffset}
                onRowClick={(row) => setEditingRow(row)}
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

            <hr></hr>

            <MonthlyConfirmationCard
                onApproved={(userId, year, month) =>
                    setApprovedMonths((prev) => {
                        const next = new Set(prev);
                        next.add(
                            `${userId}:${year}-${String(month).padStart(2, '0')}`
                        );
                        return next;
                    })
                }
            />

            <ExportModal
                open={exportOpen}
                onClose={() => setExportOpen(false)}
                self
            />
        </section>
    );
}
