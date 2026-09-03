'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { User } from '@/types';
import {
    YearlyVacationResponse,
    MonthlyWorkRecordResponse,
} from '@/schemas/api';
import { Calendar } from '@/components/calendar/Calendar';
import { ChevronLeft, Mail, CalendarDays } from 'lucide-react';
import Card from '@/components/ui/Card';
import { usePersistedState } from '@/lib/usePersistedState';
import { CALENDAR_MONTH } from '@/lib/storage';

function toLocale(lang: 'ca' | 'es' | 'en'): string {
    return lang === 'ca' ? 'ca-ES' : lang === 'es' ? 'es-ES' : 'en-US';
}

export default function OtherUserProfilePage() {
    const { t, lang } = useI18n();
    const params = useParams();
    const router = useRouter();
    const userId = params?.userId as string;
    const locale = toLocale(lang);

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

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
    const [workSessions, setWorkSessions] =
        useState<MonthlyWorkRecordResponse | null>(null);
    const [calendarLoading, setCalendarLoading] = useState(false);

    useEffect(() => {
        if (!userId) return;

        const loadUser = async () => {
            setLoading(true);
            try {
                const res = await apiClient.getProfile(userId);
                if (res.data) {
                    setUser(res.data.user || res.data);
                }
            } catch (error) {
                console.error('Error loading profile:', error);
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, [userId]);

    useEffect(() => {
        if (!userId) return;

        let cancelled = false;
        const fetchCalendarData = async () => {
            setCalendarLoading(true);
            try {
                const year = cursor.getFullYear();
                const month = cursor.getMonth() + 1;

                const [vacRes, workRes] = await Promise.all([
                    apiClient.getUserVacations(userId, year),
                    apiClient.getMonthlyRecords(userId, month, year),
                ]);

                if (cancelled) return;
                if (vacRes.data) setVacations(vacRes.data);
                if (workRes.data) setWorkSessions(workRes.data);
            } catch (error) {
                console.error('Error loading calendar data:', error);
            } finally {
                if (!cancelled) setCalendarLoading(false);
            }
        };

        fetchCalendarData();
        return () => {
            cancelled = true;
        };
    }, [userId, cursor]);

    const handleMonthChange = (newCursor: Date) => {
        setCursor(newCursor);
    };

    if (loading)
        return (
            <div className="p-10 text-center text-zinc-500 animate-pulse">
                {t('common.loading')}
            </div>
        );
    if (!user)
        return (
            <div className="p-10 text-center text-red-500">
                {t('profile.notFound')}
            </div>
        );

    const displayName = user.name || t('common.noName');
    const initials = (displayName[0] || 'U').toUpperCase();

    return (
        <section className="space-y-6 pb-20">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => router.back()}
                    className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {t('profile.title')}
                </h1>
            </div>

            <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-indigo-600 text-white shadow-lg">
                    <span className="text-2xl font-bold">{initials}</span>
                </div>
                <div>
                    <div className="text-lg font-semibold text-zinc-900 dark:text-white">
                        {displayName}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <Mail size={14} />
                        {user.email}
                    </div>
                    <div className="mt-1 inline-block rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                        {user.role || 'Employee'}
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
                    <CalendarDays size={20} className="text-indigo-500" />
                    {t('profile.activity')}
                </div>

                <Calendar
                    cursor={cursor}
                    onMonthChange={handleMonthChange}
                    vacations={vacations}
                    workSessions={workSessions}
                    loading={calendarLoading}
                    showWorkSessions={true}
                    showVacations={true}
                    locale={locale}
                    t={t}
                />

                {workSessions && (
                    <Card className="p-4">
                        <div className="font-medium mb-2 text-zinc-900 dark:text-white">
                            {t('calendar.workSummary')}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-xs text-zinc-500">
                                    {t('calendar.totalHours')}
                                </div>
                                <div className="text-lg font-semibold text-zinc-900 dark:text-white">
                                    {workSessions.summary.totalHoursWorked.toFixed(
                                        1
                                    )}
                                    h
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-zinc-500">
                                    {t('calendar.totalCompletedSessions')}
                                </div>
                                <div className="text-lg font-semibold text-zinc-900 dark:text-white">
                                    {workSessions.summary.totalSessions}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-zinc-500">
                                    {t('calendar.daysWithSessions')}
                                </div>
                                <div className="text-lg font-semibold text-zinc-900 dark:text-white">
                                    {workSessions.summary.daysWithSessions}
                                </div>
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </section>
    );
}
