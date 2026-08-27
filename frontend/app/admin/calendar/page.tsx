'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { YearlyVacationResponse } from '@/schemas/api';
import { localeTag, toLocalDateKey } from '@/lib/datetime';
import AdminBackButton from '../../../components/AdminBackButton';
import { Calendar } from '@/components/calendar/Calendar';

export default function AdminCalendarPage() {
    const { t, lang } = useI18n();
    const locale = localeTag(lang);
    const router = useRouter();

    const today = new Date();
    const [cursor, setCursor] = useState(
        new Date(today.getFullYear(), today.getMonth(), 1)
    );
    const [vacations, setVacations] = useState<YearlyVacationResponse | null>(
        null
    );
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});
    const [nonWorkingDays, setNonWorkingDays] = useState<number[]>([6, 0]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const year = cursor.getFullYear();

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const [vacRes, usersRes, settingsRes] = await Promise.all([
                    apiClient.getAllVacationsYearAdmin(year),
                    apiClient.getCompanyUsers(),
                    apiClient.getSettings(),
                ]);
                if (cancelled) return;

                if (vacRes.error) {
                    setError(t(`error.${vacRes.error}`) || t('error.GetError'));
                } else if (vacRes.data) {
                    setVacations(vacRes.data);
                }

                if (usersRes.data?.users) {
                    const map: Record<string, string> = {};
                    usersRes.data.users.forEach((u: any) => {
                        map[u._id] = u.name;
                    });
                    setUsersMap(map);
                }

                if (!settingsRes.error && settingsRes.data?.settings) {
                    setNonWorkingDays(
                        settingsRes.data.settings.nonWorkingDays ?? [6, 0]
                    );
                }
            } catch (err) {
                console.error('Error loading global calendar:', err);
                if (!cancelled) setError(t('error.GetError'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [year, t]);

    const goToFitxatges = (date: Date) => {
        router.push(`/admin/events?date=${toLocalDateKey(date)}&period=day`);
    };

    return (
        <div className="space-y-6">
            <AdminBackButton />

            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {t('admin.menu.calendar.title')}
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                    {t('admin.menu.calendar.desc')}
                </p>
            </div>

            {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

            <Calendar
                cursor={cursor}
                onMonthChange={setCursor}
                vacations={vacations}
                workSessions={null}
                teamVacations={[]}
                usersMap={usersMap}
                nonWorkingDays={nonWorkingDays}
                loading={loading}
                showWorkSessions={false}
                showVacations={true}
                onDayDetailAction={goToFitxatges}
                locale={locale}
                t={t}
            />
        </div>
    );
}
