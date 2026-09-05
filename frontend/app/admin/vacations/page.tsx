'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { ElectiveVacation, User } from '@/types';
import { Alert } from '@/components/ui/Alert';
import Card from '@/components/ui/Card';
import AdminBackButton from '../../../components/AdminBackButton';
import Avatar from '@/components/Avatar';
import VacationMonthsTable from '@/components/VacationMonthsTable';
import { usePersistedState } from '@/lib/usePersistedState';
import { ADMIN_VACATIONS_USER, ADMIN_VACATIONS_YEAR } from '@/lib/storage';
import { localeTag } from '@/lib/datetime';
import { ChevronRight, ChevronLeft, Check, X, Download } from 'lucide-react';
import {
    VACATION_APPROVED,
    VACATION_CANCELLED,
    VACATION_PENDING,
    VACATION_REJECTED,
} from 'shared/src/lib/constants';

type GroupedRequest = {
    ids: string[];
    userId: string;
    startDate: Date;
    endDate: Date;
    daysCount: number;
    status: string;
    reason?: string;
};

// Requests are stored as intervals with their spent days computed by the
// backend, so each document maps to exactly one display group.
const groupRequests = (
    rawRequests: ElectiveVacation[]
): GroupedRequest[] =>
    [...rawRequests]
        .sort((a, b) => {
            if (a.userId !== b.userId) return a.userId.localeCompare(b.userId);
            return (
                new Date(a.startDate).getTime() -
                new Date(b.startDate).getTime()
            );
        })
        .map((vac) => ({
            ids: [vac._id],
            userId: vac.userId,
            startDate: new Date(vac.startDate),
            endDate: new Date(vac.endDate),
            daysCount: vac.spentDays ?? 0,
            status: vac.status,
            reason: vac.reason,
        }));

export default function AdminVacationsPage() {
    const { t, lang } = useI18n();

    const [requests, setRequests] = useState<ElectiveVacation[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [year, setYear] = usePersistedState<number>(ADMIN_VACATIONS_YEAR, new Date().getFullYear());
    const [obligatoryDays, setObligatoryDays] = useState<Date[]>([]);
    const [filterUserId, setFilterUserId] = usePersistedState<string>(ADMIN_VACATIONS_USER, 'all');
    const [processingIds, setProcessingIds] = useState<string[]>([]);
    const fetchSeq = useRef(0);

    const usersMap = useMemo(() => {
        const map: Record<string, User> = {};
        users.forEach((user) => {
            map[user._id] = user;
        });
        return map;
    }, [users]);

    const handleExportVacations = useCallback(async () => {
        const selectedUserIds =
            filterUserId === 'all' ? undefined : [filterUserId];
        await apiClient.exportVacations(year, { userIds: selectedUserIds });
    }, [year, filterUserId]);

    const getUserInfo = (userId: string): User | null => {
        return usersMap[userId] || null;
    };

    const fetchVacations = async () => {
        const seq = ++fetchSeq.current;
        try {
            setLoading(true);
            setError(null);

            const [resVacations, resUsers] = await Promise.allSettled([
                apiClient.getAllVacationsYearAdmin(year),
                apiClient.getCompanyUsers(),
            ]);

            if (seq !== fetchSeq.current) return;

            if (
                resVacations.status === 'fulfilled' &&
                resVacations.value.data
            ) {
                setRequests(resVacations.value.data.electives || []);
                setObligatoryDays(
                    resVacations.value.data.yearlyVacationDays
                        ?.obligatoryDays || []
                );
            } else if (resVacations.status === 'rejected') {
                console.error('Error loading vacations:', resVacations.reason);
                setError(t('error.GetError') || 'Error loading vacations');
            }

            if (resUsers.status === 'fulfilled' && resUsers.value.data?.users) {
                setUsers(resUsers.value.data.users);
            }
        } catch (error) {
            console.error('Unexpected error:', error);
            setError(t('error.GetError') || 'Error loading data');
        } finally {
            if (seq === fetchSeq.current) setLoading(false);
        }
    };

    useEffect(() => {
        fetchVacations();
    }, [year]);

    const handleYearChange = (newYear: number) => {
        setYear(newYear);
    };

    const handleBulkResolve = async (
        ids: string[],
        status: typeof VACATION_APPROVED | typeof VACATION_REJECTED
    ) => {
        if (ids.length === 0) return;

        setProcessingIds((prev) => [...prev, ...ids]);

        try {
            const results = await Promise.all(
                ids.map((id) => apiClient.resolveVacation(id, status))
            );

            const failures = ids.filter(
                (_, i) => results[i]?.error !== undefined
            );

            if (failures.length > 0) {
                // Some requests were rejected by the backend; refetch so the UI
                // reflects the real status and surface an error.
                await fetchVacations();
                setError(t('error.PostError') || 'Connection error');
            } else {
                setRequests((prev) =>
                    prev.map((req) =>
                        ids.includes(req._id) ? { ...req, status: status } : req
                    )
                );
            }
        } catch (error) {
            console.error('Error resolving group:', error);
            await fetchVacations();
            setError(t('error.PostError') || 'Connection error');
        } finally {
            setProcessingIds((prev) => prev.filter((id) => !ids.includes(id)));
        }
    };

    const filteredRequests = useMemo(
        () =>
            filterUserId === 'all'
                ? requests
                : requests.filter((r) => r.userId === filterUserId),
        [requests, filterUserId]
    );

    const pendingGroups = useMemo(
        () =>
            groupRequests(
                filteredRequests.filter((r) => r.status === VACATION_PENDING)
            ),
        [filteredRequests]
    );
    const approvedGroups = useMemo(
        () =>
            groupRequests(
                filteredRequests.filter((r) => r.status === VACATION_APPROVED)
            ),
        [filteredRequests]
    );
    const rejectedGroups = useMemo(
        () =>
            groupRequests(
                filteredRequests.filter((r) => r.status === VACATION_REJECTED)
            ),
        [filteredRequests]
    );

    // Elective days the pending requests would spend once approved.
    const pendingSpentDays = useMemo(
        () =>
            pendingGroups.reduce((sum, g) => sum + (g.daysCount ?? 0), 0),
        [pendingGroups]
    );

    const stats = useMemo(
        () => ({
            total: filteredRequests.length,
            pending: filteredRequests.filter((r) => r.status === VACATION_PENDING)
                .length,
            approved: filteredRequests.filter((r) => r.status === VACATION_APPROVED)
                .length,
            rejected: filteredRequests.filter((r) => r.status === VACATION_REJECTED)
                .length,
            cancelled: filteredRequests.filter((r) => r.status === VACATION_CANCELLED)
                .length,
            obligatoryDays: obligatoryDays.length,
        }),
        [filteredRequests, obligatoryDays]
    );

    const formatDateRange = (start: Date, end: Date) => {
        const s = start.toLocaleDateString();
        const e = end.toLocaleDateString();
        if (s === e) return s;
        return `${s} - ${e}`;
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            {/* CONTENT */}
            <div className="mx-auto max-w-4xl px-4 py-6">
                <AdminBackButton />

                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                                {t('admin.vacations.title')}
                            </h1>
                            <p className="mt-1 text-sm text-zinc-500">
                                {t('admin.vacations.subtitle')}
                            </p>
                        </div>

                        {/* Year selector */}
                        <div className="flex items-center gap-2">
                            <select
                                value={filterUserId}
                                onChange={(e) =>
                                    setFilterUserId(e.target.value)
                                }
                                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                            >
                                <option value="all">
                                    {t('admin.vacations.allUsers')}
                                </option>
                                {users.map((u) => (
                                    <option key={u._id} value={u._id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>

                            <button
                                onClick={() => handleYearChange(year - 1)}
                                className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                                disabled={loading}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>

                            <div className="min-w-[100px] text-center">
                                <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                                    {year}
                                </span>
                            </div>

                            <button
                                onClick={() => handleYearChange(year + 1)}
                                className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                                disabled={loading}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>

                            <button
                                onClick={handleExportVacations}
                                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                                disabled={loading}
                                title={t('admin.vacations.exportCsv')}
                            >
                                <Download className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Statistics */}
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                {t('admin.vacations.total')}
                            </div>
                            <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                                {stats.total}
                            </div>
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                            <div className="text-sm text-amber-600 dark:text-amber-400">
                                {t('admin.vacations.pending')}
                            </div>
                            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                                {stats.pending}
                            </div>
                        </div>
                        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                            <div className="text-sm text-green-600 dark:text-green-400">
                                {t('admin.vacations.approved')}
                            </div>
                            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                                {stats.approved}
                            </div>
                        </div>
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                            <div className="text-sm text-red-600 dark:text-red-400">
                                {t('admin.vacations.rejected')}
                            </div>
                            <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                                {stats.rejected}
                            </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/20">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                {t('admin.vacations.cancelled')}
                            </div>
                            <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                                {stats.cancelled}
                            </div>
                        </div>
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                            <div className="text-sm text-blue-600 dark:text-blue-400">
                                {t('calendar.obligatoryVacation')}
                            </div>
                            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                                {stats.obligatoryDays}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error message */}
                {error && (
                    <Alert variant="destructive" onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {loading ? (
                    <div className="p-10 text-center animate-pulse text-zinc-500">
                        {t('common.loading')}
                    </div>
                ) : (
                    <div className="space-y-10">
                        {/* --- PENDING (AGRUPAT) --- */}
                        <section>
                            <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-orange-400"></span>
                                {t('admin.vacations.pending')} (
                                {pendingGroups.length})
                                <span className="font-normal normal-case tracking-normal">
                                    · {pendingSpentDays}{' '}
                                    {t('admin.vacations.electiveDays')}
                                </span>
                            </h2>

                            {pendingGroups.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
                                    {t('admin.vacations.empty')}
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {pendingGroups.map((group, idx) => {
                                        const user = getUserInfo(group.userId);
                                        const userName =
                                            user?.name ||
                                            t('admin.vacations.unknownUser');
                                        const userEmail = user?.email || '';
                                        const userInitial =
                                            userName.charAt(0).toUpperCase() ||
                                            '?';
                                        const isProcessing = group.ids.some(
                                            (id) => processingIds.includes(id)
                                        );

                                        return (
                                            <Card
                                                key={`${group.userId}-${idx}`}
                                                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Avatar
                                                            userId={
                                                                group.userId
                                                            }
                                                            version={
                                                                user?.avatar ??
                                                                null
                                                            }
                                                            alt={userName}
                                                            fallback={
                                                                userInitial
                                                            }
                                                            className="h-8 w-8 rounded-full object-cover"
                                                            fallbackClassName="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                                                        />
                                                        <div>
                                                            <div className="font-semibold text-zinc-900 dark:text-white">
                                                                {userName}
                                                            </div>
                                                            {userEmail && (
                                                                <div className="text-xs text-zinc-400">
                                                                    {userEmail}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 flex items-center gap-4 text-sm">
                                                        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                                                            <span>📅</span>
                                                            {formatDateRange(
                                                                group.startDate,
                                                                group.endDate
                                                            )}
                                                        </div>
                                                        {group.daysCount >
                                                            1 && (
                                                            <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full dark:bg-orange-900/30 dark:text-orange-400">
                                                                {
                                                                    group.daysCount
                                                                }{' '}
                                                                {t(
                                                                    'vacations.days'
                                                                )}
                                                            </span>
                                                        )}
                                                        {group.reason && (
                                                            <div className="text-zinc-500 italic">
                                                                &quot;
                                                                {group.reason}
                                                                &quot;
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() =>
                                                            handleBulkResolve(
                                                                group.ids,
                                                                VACATION_APPROVED
                                                            )
                                                        }
                                                        disabled={isProcessing}
                                                        className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                        {t(
                                                            'admin.vacations.approve'
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleBulkResolve(
                                                                group.ids,
                                                                VACATION_REJECTED
                                                            )
                                                        }
                                                        disabled={isProcessing}
                                                        className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors dark:bg-transparent dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
                                                    >
                                                        <X className="w-4 h-4" />
                                                        {t(
                                                            'admin.vacations.reject'
                                                        )}
                                                    </button>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* --- APPROVED VACATIONS (AGRUPAT) --- */}
                        {approvedGroups.length > 0 && (
                            <section>
                                <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-green-400"></span>
                                    {t('admin.vacations.approved')}
                                </h2>
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 overflow-hidden">
                                    {approvedGroups.map((group, idx) => {
                                        const user = getUserInfo(group.userId);
                                        const userName =
                                            user?.name ||
                                            t('admin.vacations.unknownUser');

                                        return (
                                            <div
                                                key={`${group.userId}-${idx}`}
                                                className={`flex items-center justify-between p-4 ${idx !== approvedGroups.length - 1 ? 'border-b border-zinc-200 dark:border-zinc-800' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                                    <div>
                                                        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                                            {userName}
                                                        </div>
                                                        <div className="text-xs text-zinc-500 flex gap-2">
                                                            <span>
                                                                {formatDateRange(
                                                                    group.startDate,
                                                                    group.endDate
                                                                )}
                                                            </span>
                                                            {group.daysCount >
                                                                1 && (
                                                                <span className="font-semibold">
                                                                    (
                                                                    {
                                                                        group.daysCount
                                                                    }{' '}
                                                                    {t(
                                                                        group.daysCount ===
                                                                            1
                                                                            ? 'admin.vacations.electiveDay'
                                                                            : 'admin.vacations.electiveDays'
                                                                    )}
                                                                    )
                                                                </span>
                                                            )}
                                                            {group.reason && (
                                                                <span className="italic border-l border-zinc-300 pl-2">
                                                                    &quot;
                                                                    {
                                                                        group.reason
                                                                    }
                                                                    &quot;
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                    {t(
                                                        'admin.vacations.status.approved'
                                                    )}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* --- REJECTED (AGRUPAT) --- */}
                        {rejectedGroups.length > 0 && (
                            <section>
                                <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
                                    {t('admin.vacations.history')}
                                </h2>
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 overflow-hidden">
                                    {rejectedGroups.map((group, idx) => {
                                        const user = getUserInfo(group.userId);
                                        const userName =
                                            user?.name ||
                                            t('admin.vacations.unknownUser');

                                        return (
                                            <div
                                                key={`${group.userId}-${idx}`}
                                                className={`flex items-center justify-between p-4 ${idx !== rejectedGroups.length - 1 ? 'border-b border-zinc-200 dark:border-zinc-800' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                                    <div>
                                                        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                                            {userName}
                                                        </div>
                                                        <div className="text-xs text-zinc-500 flex gap-2">
                                                            <span>
                                                                {formatDateRange(
                                                                    group.startDate,
                                                                    group.endDate
                                                                )}
                                                            </span>
                                                            {group.daysCount >
                                                                1 && (
                                                                <span className="font-semibold">
                                                                    (
                                                                    {
                                                                        group.daysCount
                                                                    }{' '}
                                                                    {t(
                                                                        group.daysCount ===
                                                                            1
                                                                            ? 'admin.vacations.electiveDay'
                                                                            : 'admin.vacations.electiveDays'
                                                                    )}
                                                                    )
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                                        {t(
                                                            'admin.vacations.status.rejected'
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* --- COMPANY OBLIGATORY HOLIDAYS --- */}
                        {obligatoryDays.length > 0 && (
                            <section>
                                <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-blue-400"></span>
                                    {t('vacations.obligatoryTitle')}
                                </h2>
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 overflow-hidden">
                                    <div className="p-5">
                                        <VacationMonthsTable
                                            days={obligatoryDays}
                                            locale={localeTag(lang)}
                                        />
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
