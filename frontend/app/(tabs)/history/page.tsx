"use client"; // TODO update to new look

import { useMemo, useState, useEffect, useCallback } from "react";
import { useI18n } from "@/app/i18n";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { apiClient } from "@/lib/api";
import { WorkSession } from "@/types";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";

// Helpers
function hoursBetween(a: Date, b: Date) {
  return Math.max(0, (b.getTime() - a.getTime()) / 3_600_000);
}
function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // dilluns=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}
function fmtHM(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${mm}m`;
}

export default function HistoryAndStatsPage() {
  const { t } = useI18n();
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Fetch user and work sessions
  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = await apiClient.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          
          // Fetch last 3 months of data for comprehensive history
          const now = new Date();
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          
          // Get sessions for multiple months
          const allSessions: WorkSession[] = [];
          
          for (let i = 0; i < 4; i++) {
            const date = new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth() + i, 1);
            const response = await apiClient.getMonthlyRecords(
              user._id, 
              date.getMonth() + 1, 
              date.getFullYear()
            );
            
            if (response.data?.sessionsByDay) {
              // Flatten the sessionsByDay array (index is day of month, position 0 is empty)
              response.data.sessionsByDay.forEach((daySessions, dayIndex) => {
                if (dayIndex > 0 && daySessions) {
                  daySessions.forEach(session => {
                    allSessions.push(session);
                  });
                }
              });
            }
          }
          
          setWorkSessions(allSessions);
        }
      } catch (error) {
        console.error('Failed to fetch history data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate hours for a session (check-in to check-out)
  const calculateSessionHours = (session: WorkSession): number => {
    if (session.type === 'check_in') {
      // Find matching check-out
      const checkOut = workSessions.find(s => 
        s.type === 'check_out' && 
        new Date(s.timestamp) > new Date(session.timestamp) &&
        Math.abs(new Date(s.timestamp).getTime() - new Date(session.timestamp).getTime()) < 24 * 60 * 60 * 1000 // within 24 hours
      );
      
      if (checkOut) {
        return hoursBetween(new Date(session.timestamp), new Date(checkOut.timestamp));
      }
    }
    return 0;
  };

  // Aggregate hours per day
  const perDay = useMemo(() => {
    const byDay = new Map<string, number>();
    
    // Group sessions by date and calculate total hours per day
    const sessionsByDate = new Map<string, WorkSession[]>();
    
    workSessions.forEach(session => {
      const dateKey = new Date(session.timestamp).toISOString().slice(0, 10); // YYYY-MM-DD
      if (!sessionsByDate.has(dateKey)) {
        sessionsByDate.set(dateKey, []);
      }
      sessionsByDate.get(dateKey)!.push(session);
    });

    // Calculate total hours for each day
    sessionsByDate.forEach((daySessions, dateKey) => {
      let totalHours = 0;
      const sortedSessions = daySessions.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let checkInTime: Date | null = null;
      
      sortedSessions.forEach(session => {
        if (session.type === 'check_in') {
          checkInTime = new Date(session.timestamp);
        } else if (session.type === 'check_out' && checkInTime) {
          totalHours += hoursBetween(checkInTime, new Date(session.timestamp));
          checkInTime = null;
        }
      });

      // If there's an unmatched check-in at the end of the day
      if (checkInTime) {
        totalHours += hoursBetween(checkInTime, new Date());
      }

      if (totalHours > 0) {
        byDay.set(dateKey, totalHours);
      }
    });

    return Array.from(byDay.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // desc
      .map(([date, hrs]) => ({ date, hrs }));
  }, [workSessions]);

  // Aggregate hours per week (last 6 weeks)
  const perWeek = useMemo(() => {
    const w0 = startOfWeek(new Date());
    const weeks: { label: string; hrs: number }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const start = new Date(w0);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      // Calculate hours for this week from perDay data
      const weekHours = perDay.reduce((acc, day) => {
        const dayDate = new Date(day.date);
        if (dayDate >= start && dayDate < end) {
          return acc + day.hrs;
        }
        return acc;
      }, 0);

      const label = `${start.getDate()}/${start.getMonth() + 1}`;
      weeks.push({ label, hrs: Number(weekHours.toFixed(2)) });
    }
    return weeks;
  }, [perDay]);

  const totalThisWeek = perWeek[perWeek.length - 1]?.hrs ?? 0;
  const avgPerDayThisWeek = useMemo(() => {
    const wStart = startOfWeek(new Date());
    const today = new Date();
    const days = Math.max(1, Math.min(5, Math.floor((today.getTime() - wStart.getTime()) / 86_400_000) + 1));
    return totalThisWeek / days;
  }, [totalThisWeek]);

  const handleExport = useCallback(() => {
    const data = perDay.map(day => ({
      [t('history.export.date')]: day.date,
      [t('history.export.hours')]: day.hrs.toFixed(2),
      [t('history.export.formatted')]: fmtHM(day.hrs)
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "History");
    XLSX.writeFile(workbook, `history_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [perDay, t]);

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="animate-pulse">
                <div className="h-4 bg-zinc-200 rounded w-1/2 mb-2"></div>
                <div className="h-6 bg-zinc-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{t('tabs.history')}</h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/30 transition-colors"
        >
          <Download size={16} />
          {t('history.export')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">{t('history.chart.title')}</div>
          <div className="mt-1 text-2xl font-semibold">{fmtHM(totalThisWeek)}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">{t('history.avgPerDay')}</div>
          <div className="mt-1 text-2xl font-semibold">{fmtHM(avgPerDayThisWeek)}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">{t('history.daysWithCheckins')}</div>
          <div className="mt-1 text-2xl font-semibold">{perDay.length}</div>
        </div>
      </div>

      {/* Weekly Chart */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 text-sm font-medium">{t('history.weekHours')}</div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perWeek} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip 
                formatter={(value) => [`${fmtHM(Number(value))}`, t('history.hours')]}
                labelFormatter={(label) => `${t('history.week')} ${label}`}
              />
              <Bar dataKey="hrs" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily History */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 text-sm font-medium dark:border-zinc-800">
          {t('history.recent.title')}
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-2">{t('history.date')}</th>
                <th className="px-4 py-2">{t('history.hours')}</th>
              </tr>
            </thead>
            <tbody>
              {perDay.map((d) => (
                <tr key={d.date} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    {new Date(d.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">{fmtHM(d.hrs)}</td>
                </tr>
              ))}
              {perDay.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-zinc-500" colSpan={2}>
                    {t('history.noRecords')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}