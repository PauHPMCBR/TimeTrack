// app/calendar/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";
import { YearlyVacationResponse, MonthlyWorkRecordResponse } from "@/schemas/api";
import { useRouter } from "next/navigation";
import { Calendar } from "@/components/calendar/Calendar";
import { Alert } from "@/components/ui/Alert";

function toLocale(lang: "ca" | "es" | "en"): string {
  return lang === "ca" ? "ca-ES" : lang === "es" ? "es-ES" : "en-US";
}

export default function CalendarPage() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const locale = toLocale(lang);

  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [vacations, setVacations] = useState<YearlyVacationResponse | null>(null);
  const [workSessions, setWorkSessions] = useState<MonthlyWorkRecordResponse | null>(null);
  const [teamVacations, setTeamVacations] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleMonthChange = (newCursor: Date) => {
    setCursor(newCursor);
  };

  // Fetch data when month changes
  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      
      setLoading(true);
      setErrorMsg(null);
      try {
        const year = cursor.getFullYear();
        const month = cursor.getMonth() + 1;
        
        const vacationsResponse = await apiClient.getUserVacations(currentUser._id, year);
        console.log(vacationsResponse);
        if (vacationsResponse.error) {
           setErrorMsg(t(`error.${vacationsResponse.error}`));
        } else {
           setVacations(vacationsResponse.data!);
        }

        const workSessionsResponse = await apiClient.getMonthlyRecords(currentUser._id, month, year);
        console.log(workSessionsResponse);
        if (workSessionsResponse.error) {
           setErrorMsg(t(`error.${workSessionsResponse.error}`));
        } else {
           setWorkSessions(workSessionsResponse.data!);
        }

        const teamVacationsRes = await apiClient.getTeamVacations(year);
        if (teamVacationsRes.data && teamVacationsRes.data.vacations) {
            // Filter out self to not duplicate
            const others = teamVacationsRes.data.vacations.filter((v: any) => {
                const vUserId = typeof v.userId === 'object' ? v.userId._id : v.userId;
                return vUserId !== currentUser._id;
            });
            setTeamVacations(others);
        }

      } catch (error) {
        console.error('Failed to fetch calendar data:', error);
        setErrorMsg(t('error.GetError'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [cursor, currentUser, t]);

  // Fetch current user on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const userResponse = await apiClient.getCurrentUser();
        if (userResponse) {
          setCurrentUser(userResponse);
        } else {
          console.log("redirecting to login...");
          router.push("/");
        }
      } catch (error) {
        console.error('Failed to fetch current user:', error);
      }
    };
    
    fetchCurrentUser();
  }, []);

  return (
    <div className="space-y-4">
      {errorMsg && (
        <Alert 
          variant="destructive" 
          onClose={() => setErrorMsg(null)} 
        >
          {errorMsg}
        </Alert>
      )}
      {vacations && !vacations.yearlyVacationDays && (
        <Alert 
          variant="warning" 
        >
          {t('calendar.notConfigured')}
        </Alert>
      )}
      <Calendar
        cursor={cursor}
        onMonthChange={handleMonthChange}
        vacations={vacations}
        workSessions={workSessions}
        teamVacations={teamVacations}
        loading={loading}
        showWorkSessions={true}
        showVacations={true}
        locale={locale}
        t={t}
      />

      {/* Legend */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="font-medium mb-2">{t("calendar.legend.title")}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
              <span className="text-zinc-600 dark:text-zinc-300 text-sm">
                {t('calendar.electiveVacation')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200"></div>
              <span className="text-zinc-600 dark:text-zinc-300 text-sm">
                {t('calendar.pendingVacation')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
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
              <div className="w-3 h-3 rounded outline-2 outline-indigo-500"></div>
              <span className="text-zinc-600 dark:text-zinc-300 text-sm">
                {t('calendar.legend.today')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200 dark:bg-purple-900/30 dark:border-purple-800/50"></div>
              <span className="text-zinc-600 dark:text-zinc-300 text-sm">
                {t('calendar.teamVacation')}
              </span>
            </div>
          </div>
        </div>
        
        {/* Work sessions summary */}
        {workSessions && (
          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
            <div className="font-medium mb-1">{t('calendar.workSummary')}</div>
            <div className="text-sm text-zinc-600 dark:text-zinc-300 space-y-1">
              <div>{t('calendar.totalHours')}: <strong>{workSessions.summary.totalHoursWorked.toFixed(1)}h</strong></div>
              <div>{t('calendar.totalSessions')}: <strong>{workSessions.summary.totalSessions}</strong></div>
              <div>{t('calendar.daysWithSessions')}: <strong>{workSessions.summary.daysWithSessions}</strong></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}