"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";
import Card from "@/components/ui/Card";
import { UserPlus, Users, CalendarOff, Calendar, Settings, ClipboardList } from "lucide-react";

type MenuItem = {
  title: string;
  desc: string;
  href: string;
  meta?: string;
  alert?: boolean;
  iconColor: string;
  bgColor: string;
  icon: ReactNode;
};

export default function AdminDashboard() {
  const { t } = useI18n();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await apiClient.getAdminDashboard();
        if (!res.error && res.data) setData(res.data);
      } catch (error) {
        console.error("Error carregant dashboard:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const pendingVacations = data?.pendingVacations ?? 0;
  const anomalyCount = data?.anomalyCount ?? 0;

  const menuItems: MenuItem[] = [
    {
      title: t("admin.menu.users.title"),
      desc: t("admin.menu.users.desc"),
      meta: `${data?.usersCount ?? "-"} ${t("admin.menu.users.total")} · ${data?.currentlyWorking ?? "-"} ${t("admin.menu.users.working")}`,
      href: "/admin/users",
      iconColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      icon: <UserPlus size={24} />,
    },
    {
      title: t("admin.menu.events.title"),
      desc: t("admin.menu.events.desc"),
      meta: anomalyCount > 0 ? `${anomalyCount} ${t("admin.menu.events.anomalies")}` : t("admin.menu.events.noAnomalies"),
      href: "/admin/events",
      iconColor: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
      icon: <ClipboardList size={24} />,
      alert: anomalyCount > 0,
    },
    {
      title: t("admin.menu.groups.title"),
      desc: t("admin.menu.groups.desc"),
      meta: `${data?.groupsCount ?? "-"} ${t("admin.menu.groups.count")}`,
      href: "/admin/groups",
      iconColor: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
      icon: <Users size={24} />,
    },
    {
      title: t("admin.menu.vacations.title"),
      desc: t("admin.menu.vacations.desc"),
      meta: pendingVacations > 0 ? `${pendingVacations} ${t("admin.menu.vacations.pending")}` : t("admin.menu.vacations.none"),
      href: "/admin/vacations",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
      icon: <CalendarOff size={24} />,
      alert: pendingVacations > 0,
    },
    {
      title: t("admin.menu.yearlyvacations.title"),
      desc: t("admin.menu.yearlyvacations.desc"),
      href: "/admin/yearly-vacations",
      iconColor: "text-pink-600 dark:text-pink-400",
      bgColor: "bg-pink-50 dark:bg-pink-900/20",
      icon: <Calendar size={24} />,
    },
    {
      title: t("admin.menu.calendar.title"),
      desc: t("admin.menu.calendar.desc"),
      href: "/admin/calendar",
      iconColor: "text-cyan-600 dark:text-cyan-400",
      bgColor: "bg-cyan-50 dark:bg-cyan-900/20",
      icon: <Calendar size={24} />,
    },
    {
      title: t("admin.menu.settings.title"),
      desc: t("admin.menu.settings.desc"),
      href: "/admin/settings",
      iconColor: "text-zinc-600 dark:text-zinc-300",
      bgColor: "bg-zinc-100 dark:bg-zinc-800",
      icon: <Settings size={24} />,
    },
  ];

  const sections = [
    { title: t("admin.sections.users"), items: menuItems.slice(0, 3) },
    { title: t("admin.sections.vacations"), items: menuItems.slice(3, 6) },
    { title: t("admin.sections.settings"), items: menuItems.slice(6) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("admin.menu.title")}</h1>
      </div>

      {loading ? (
        <Card className="p-10 text-center animate-pulse text-zinc-500">{t("common.loading")}</Card>
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">{section.title}</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
                  >
                    <div className="mb-3 flex w-full items-center justify-between">
                      <div className={`grid h-12 w-12 place-items-center rounded-xl ${item.bgColor} ${item.iconColor}`}>
                        {item.icon}
                      </div>
                      {item.alert && (
                        <span className="relative flex h-3 w-3">
                          <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-orange-400 opacity-75"></span>
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-500"></span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-zinc-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.desc}</p>
                    {item.meta && (
                      <p className="mt-2 text-xs font-medium text-zinc-400 dark:text-zinc-500">{item.meta}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
