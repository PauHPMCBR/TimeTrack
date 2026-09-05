'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import {
    YearlyVacationResponse,
    MonthlyWorkRecordResponse,
} from '@/schemas/api';
import { TeamVacation } from '@/types';
import { useRouter } from 'next/navigation';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { defaultNonWorkingDays } from 'shared/src/lib/defaults';
import { localeTag } from '@/lib/datetime';
import { Calendar } from '@/components/calendar/Calendar';
import { Alert } from '@/components/ui/Alert';
import Card from '@/components/ui/Card';
import { usePersistedState } from '@/lib/usePersistedState';
import { CALENDAR_ALL_USERS, CALENDAR_MONTH } from '@/lib/storage';

export default function CalendarPage() {
    const router = useRouter();
    const { t, lang } = useI18n();
    const locale = localeTag(lang);

    const today = new Date();
    const [cursor, setCursor] = usePersistedState<Date>(
        CALENDAR_MONTH,
        () => new Date(today.getFullYear(), today.getMonth(), 1),
        {
            serialize: (d) => d.toISOString(),
            deserialize: (s) => {
                const d = new Date(s);
                return new Date(d.getFullYear(), d.getMonth(), 1);
            },
        }
    );
    const [vacations, setVacations] = useState<YearlyVacationResponse | null>(
        null
    );
    const [allVacations, setAllVacations] =
        useState<YearlyVacationResponse | null>(null);
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});
    const [workSessions, setWorkSessions] =
        useState<MonthlyWorkRecordResponse | null>(null);
    const [teamVacations, setTeamVacations] = useState<TeamVacation[]>([]);
    const [nonWorkingDays, setNonWorkingDays] = useState<number[]>(defaultNonWorkingDays());
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [allUsers, setAllUsers] = usePersistedState<boolean>(
        CALENDAR_ALL_USERS,
        () => false
    );
    const [isAdmin, setIsAdmin] = useState(false);

    const handleMonthChange = (newCursor: Date) => {
        setCursor(newCursor);
    };

    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            setLoading(true);
            setErrorMsg(null);
            try {
                // getCurrentUser is cached in ApiClient, so this resolves instantly on
                // subsequent month changes; the data calls then run in parallel.
                const user = await apiClient.getCurrentUser();
                if (cancelled) return;
                if (!user) {
                    router.push('/');
                    return;
                }

                const isAdmin = user.role === ADMIN_ROLE;
                const globalMode = isAdmin && allUsers;
                const year = cursor.getFullYear();
                const month = cursor.getMonth() + 1;
                setIsAdmin(isAdmin);

                const [
                    vacationsResponse,
                    workSessionsResponse,
                    teamVacationsRes,
                    settingsRes,
                    allVacationsRes,
                    companyUsersRes,
                ] = await Promise.all([
                    globalMode
                        ? Promise.resolve(null)
                        : apiClient.getUserVacations(user._id, year),
                    globalMode
                        ? Promise.resolve(null)
                        : apiClient.getMonthlyRecords(user._id, month, year),
                    globalMode
                        ? Promise.resolve(null)
                        : apiClient.getTeamVacations(year),
                    apiClient.getPublicSettings(),
                    globalMode
                        ? apiClient.getAllVacationsYearAdmin(year)
                        : Promise.resolve(null),
                    globalMode
                        ? apiClient.getCompanyUsers()
                        : Promise.resolve(null),
                ]);
                if (cancelled) return;

                if (vacationsResponse?.error) {
                    setErrorMsg(t(`error.${vacationsResponse.error}`));
                } else if (vacationsResponse) {
                    setVacations(vacationsResponse.data!);
                }

                if (workSessionsResponse?.error) {
                    setErrorMsg(t(`error.${workSessionsResponse.error}`));
                } else if (workSessionsResponse) {
                    setWorkSessions(workSessionsResponse.data!);
                }

                if (teamVacationsRes?.data && teamVacationsRes.data.vacations) {
                    // Filter out self to not duplicate
                    const others = teamVacationsRes.data.vacations.filter(
                        (v) => {
                            const vUserId =
                                typeof v.userId === 'object'
                                    ? v.userId._id
                                    : v.userId;
                            return vUserId !== user._id;
                        }
                    );
                    setTeamVacations(others);
                }

                if (allVacationsRes?.error) {
                    setErrorMsg(t(`error.${allVacationsRes.error}`));
                } else if (allVacationsRes?.data) {
                    setAllVacations(allVacationsRes.data);
                }

                if (companyUsersRes?.data?.users) {
                    const map: Record<string, string> = {};
                    companyUsersRes.data.users.forEach((u) => {
                        map[u._id] = u.name;
                    });
                    setUsersMap(map);
                }

                // Non-working days: prefer the user's own override, else the company default.
                const allDays = [0, 1, 2, 3, 4, 5, 6];
                if (user.workDays && user.workDays.length > 0) {
                    setNonWorkingDays(
                        allDays.filter((d) => !user.workDays!.includes(d))
                    );
                } else if (!settingsRes.error && settingsRes.data?.settings) {
                    setNonWorkingDays(
                        settingsRes.data.settings.nonWorkingDays ?? defaultNonWorkingDays()
                    );
                }
            } catch (error) {
                console.error('Failed to fetch calendar data:', error);
                setErrorMsg(t('error.GetError'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchData();
        return () => {
            cancelled = true;
        };
    }, [cursor, allUsers, t, router]);

    const globalMode = isAdmin && allUsers;

    return (
        <div className="space-y-4">
            {errorMsg && (
                <Alert variant="destructive" onClose={() => setErrorMsg(null)}>
                    {errorMsg}
                </Alert>
            )}
            {isAdmin && (
                <div className="flex justify-end">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                        <input
                            type="checkbox"
                            checked={allUsers}
                            onChange={(e) => setAllUsers(e.target.checked)}
                            className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        {t('calendar.allUsersVacations')}
                    </label>
                </div>
            )}
            {!globalMode && vacations && !vacations.yearlyVacationDays && (
                <Alert variant="warning">{t('calendar.notConfigured')}</Alert>
            )}
            <Calendar
                cursor={cursor}
                onMonthChange={handleMonthChange}
                vacations={globalMode ? allVacations : vacations}
                workSessions={globalMode ? null : workSessions}
                teamVacations={globalMode ? [] : teamVacations}
                usersMap={globalMode ? usersMap : undefined}
                nonWorkingDays={nonWorkingDays}
                loading={loading}
                showWorkSessions={!globalMode}
                showVacations={true}
                locale={locale}
                t={t}
            />

            {/* Legend */}
            <Card className="p-4 text-sm">
                <div className="font-medium mb-2">
                    {t('calendar.legend.title')}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
                            <span className="text-zinc-600 dark:text-zinc-300 text-sm">
                                {t('calendar.electiveVacation')}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-yellow-100 border border-dashed border-yellow-300"></div>
                            <span className="text-zinc-600 dark:text-zinc-300 text-sm">
                                {t('calendar.pendingVacation')}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-red-100 border border-dashed border-red-300"></div>
                            <span className="text-zinc-600 dark:text-zinc-300 text-sm">
                                {t('calendar.rejectedVacation')}
                            </span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
                            <span className="text-zinc-600 dark:text-zinc-300 text-sm">
                                {t('calendar.obligatoryVacation')}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200 dark:bg-purple-900/30 dark:border-purple-800/50"></div>
                            <span className="text-zinc-600 dark:text-zinc-300 text-sm">
                                {t('calendar.teamVacation')}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-purple-50 border border-dashed border-purple-300 dark:bg-purple-900/20 dark:border-purple-800/50"></div>
                            <span className="text-zinc-600 dark:text-zinc-300 text-sm">
                                {t('calendar.teamPendingVacation')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Work sessions summary */}
                {!globalMode && workSessions && (
                    <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                        <div className="font-medium mb-1">
                            {t('calendar.workSummary')}
                        </div>
                        <div className="text-sm text-zinc-600 dark:text-zinc-300 space-y-1">
                            <div>
                                {t('calendar.totalHours')}:{' '}
                                <strong>
                                    {workSessions.summary.totalHoursWorked.toFixed(
                                        1
                                    )}
                                    h
                                </strong>
                            </div>
                            <div>
                                {t('calendar.totalCompletedSessions')}:{' '}
                                <strong>
                                    {workSessions.summary.totalSessions}
                                </strong>
                            </div>
                            <div>
                                {t('calendar.daysWithSessions')}:{' '}
                                <strong>
                                    {workSessions.summary.daysWithSessions}
                                </strong>
                            </div>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
