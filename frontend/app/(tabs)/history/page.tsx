"use client"; // TODO update to new look

import { useMemo, useState, useEffect, useCallback } from "react";
import { useI18n } from "@/app/i18n";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { apiClient } from "@/lib/api";
import { WorkSession } from "@/types";
import { toLocalDateKey } from "@/lib/datetime";
import { toCsv, downloadCsv } from "@/lib/csv";
import { Download, Clock } from "lucide-react";
import { useThemeFlavor, type ThemeFlavor } from "@/lib/theme";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

const CHART_COLORS: Record<
  ThemeFlavor,
  { bar: string; grid: string; axis: string; tooltipBg: string; tooltipBorder: string; tooltipText: string }
> = {
  latte: { bar: "#7287fd", grid: "#9ca0b0", axis: "#4c4f69", tooltipBg: "#ffffff", tooltipBorder: "#ccd0da", tooltipText: "#4c4f69" },
  frappe: { bar: "#babbf1", grid: "#737994", axis: "#c6d0f5", tooltipBg: "#414559", tooltipBorder: "#51576d", tooltipText: "#c6d0f5" },
  macchiato: { bar: "#b7bdf8", grid: "#6e738d", axis: "#cad3f5", tooltipBg: "#363a4f", tooltipBorder: "#494d64", tooltipText: "#cad3f5" },
  mocha: { bar: "#b4befe", grid: "#6c7086", axis: "#cdd6f4", tooltipBg: "#313244", tooltipBorder: "#45475a", tooltipText: "#cdd6f4" },
};

function hoursBetween(a: Date, b: Date) {
  return Math.max(0, (b.getTime() - a.getTime()) / 3_600_000);
}
function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // monday=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}
function fmtHM(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${mm}m`;
}
function parseLocalDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function HistoryAndStatsPage() {
  const { t } = useI18n();
  const theme = useThemeFlavor();
  const chart = CHART_COLORS[theme];
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = await apiClient.getCurrentUser();
        if (user) {
          const now = new Date();
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

          // Get sessions for multiple months — fetch all 4 in parallel.
          const monthCalls = Array.from({ length: 4 }, (_, i) => {
            const date = new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth() + i, 1);
            return apiClient.getMonthlyRecords(user._id, date.getMonth() + 1, date.getFullYear());
          });
          const responses = await Promise.all(monthCalls);

          const allSessions: WorkSession[] = [];
          responses.forEach((response) => {
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
          });

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

  const perDay = useMemo(() => {
    const byDay = new Map<string, number>();
    
    const sessionsByDate = new Map<string, WorkSession[]>();
    
    workSessions.forEach(session => {
      const dateKey = toLocalDateKey(session.timestamp);
      if (!sessionsByDate.has(dateKey)) {
        sessionsByDate.set(dateKey, []);
      }
      sessionsByDate.get(dateKey)!.push(session);
    });

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

      // Unmatched check-in: count until now if today, otherwise until end of
      // that day so forgotten check-outs don't inflate historical totals.
      if (checkInTime) {
        const isToday = dateKey === toLocalDateKey(new Date());
        const endDate = isToday
          ? new Date()
          : (() => {
              const d = parseLocalDateKey(dateKey);
              d.setHours(23, 59, 59, 999);
              return d;
            })();
        totalHours += hoursBetween(checkInTime, endDate);
      }

      if (totalHours > 0) {
        byDay.set(dateKey, totalHours);
      }
    });

    return Array.from(byDay.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // desc
      .map(([date, hrs]) => ({ date, hrs }));
  }, [workSessions]);

  const perWeek = useMemo(() => {
    const w0 = startOfWeek(new Date());
    const weeks: { label: string; hrs: number }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const start = new Date(w0);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      const weekHours = perDay.reduce((acc, day) => {
        const dayDate = parseLocalDateKey(day.date);
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

  const handleExport = useCallback(async () => {
    const user = await apiClient.getCurrentUser();
    // Same detail as the admin CSV export: one row per check-in/check-out.
    const headers = ['Name', 'Email', 'Timestamp', 'Type', 'Reason', 'Notes'];
    const rows = [...workSessions]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(s => [
        user?.name ?? '',
        user?.email ?? '',
        new Date(s.timestamp).toISOString(),
        s.type,
        s.reason ?? '',
        s.notes ?? '',
      ]);
    downloadCsv(toCsv(headers, rows), `history_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [workSessions]);

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <div className="animate-pulse p-4">
                <div className="h-4 bg-zinc-200 rounded w-1/2 mb-2"></div>
                <div className="h-6 bg-zinc-200 rounded w-3/4"></div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{t('tabs.history')}</h2>
        <Button variant="soft" onClick={handleExport}>
          <Download size={16} />
          {t('history.export.label')}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm text-zinc-500">{t('history.chart.title')}</div>
          <div className="mt-1 text-2xl font-semibold">{fmtHM(totalThisWeek)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-zinc-500">{t('history.avgPerDay')}</div>
          <div className="mt-1 text-2xl font-semibold">{fmtHM(avgPerDayThisWeek)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-zinc-500">{t('history.daysWithCheckins')}</div>
          <div className="mt-1 text-2xl font-semibold">{perDay.length}</div>
        </Card>
      </div>

      {/* Weekly Chart */}
      <Card className="p-5">
        <div className="mb-3 text-sm font-medium">{t('history.weekHours')}</div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perWeek} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke={chart.axis} tick={{ fill: chart.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke={chart.axis} tick={{ fill: chart.axis, fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                cursor={{ fill: "rgba(127,132,156,0.12)" }}
                contentStyle={{
                  backgroundColor: chart.tooltipBg,
                  border: `1px solid ${chart.tooltipBorder}`,
                  borderRadius: 12,
                  color: chart.tooltipText,
                  fontSize: 13,
                }}
                labelStyle={{ color: chart.tooltipText, fontWeight: 600 }}
                formatter={(value) => [`${fmtHM(Number(value))}`, t('history.hours')]}
                labelFormatter={(label) => `${t('history.week')} ${label}`}
              />
              <Bar dataKey="hrs" fill={chart.bar} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Daily History */}
      <Card className="overflow-hidden">
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
                    {parseLocalDateKey(d.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">{fmtHM(d.hrs)}</td>
                </tr>
              ))}
              {perDay.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center">
                    <Clock size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                    <div className="text-sm text-zinc-500">{t('history.noRecords')}</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}