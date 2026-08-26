"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import Card from "@/components/ui/Card";
import { UserPlus, Users, Calendar, UserMinus, Timer, Building2, ChevronLeft, CalendarOff } from "lucide-react";

export default function AdminDashboard() {
  const { t } = useI18n();

  const [stats, setStats] = useState({
    usersCount: 0,
    groupsCount: 0,
    pendingVacations: 0,
    currentlyWorking: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [usersRes, groupsRes, vacationsRes, workingRes] = await Promise.all([
          apiClient.getCompanyUsers(),
          apiClient.getAllGroups(),
          apiClient.getAllPendingVacations(),
          apiClient.getCurrentlyWorking()
        ]);

        const usersCount = (usersRes.data as any)?.users?.length || (Array.isArray(usersRes.data) ? usersRes.data.length : 0);
        const groupsCount = (groupsRes.data as any)?.groups?.length || (Array.isArray(groupsRes.data) ? groupsRes.data.length : 0);
        
        const vacationsList = (vacationsRes.data as any)?.vacations || [];
        const pendingVacations = vacationsList.filter((v: any) => v.status === 'pending').length;

        const currentlyWorking = (workingRes.data as any)?.count || 0;

        setStats({ usersCount, groupsCount, pendingVacations, currentlyWorking });

      } catch (error) {
        console.error("Error carregant dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const menuItems = [
    {
      title: t("admin.menu.users.title"),
      desc: t("admin.menu.users.desc"),
      href: "/admin/users",
      iconColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      icon: (
        <UserPlus size={24} />
      )
    },
    {
      title: t("admin.menu.groups.title"),
      desc: t("admin.menu.groups.desc"),
      href: "/admin/groups",
      iconColor: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
      icon: (
        <Users size={24} />
      )
    },
    {
      title: t("admin.menu.vacations.title"),
      desc: t("admin.menu.vacations.desc"),
      href: "/admin/vacations",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
      alert: stats.pendingVacations > 0,
      icon: (
        <CalendarOff size={24} />
      )
    },
    {
      title: t("admin.menu.calendar.title"),
      desc: t("admin.menu.calendar.desc"),
      href: "/admin/calendar",
      iconColor: "text-pink-600 dark:text-pink-400", // Color Rosa/Vermellós
      bgColor: "bg-pink-50 dark:bg-pink-900/20",
      icon: (
        <Calendar size={24} />
      )
    },
    {
      title: t("admin.menu.yearlyvacations.title"),
      desc: t("admin.menu.yearlyvacations.desc"),
      href: "/admin/yearly-vacations",
      iconColor: "text-pink-600 dark:text-pink-400", // Color Rosa/Vermellós
      bgColor: "bg-pink-50 dark:bg-pink-900/20",
      icon: (
        <Calendar size={24} />
      )
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      
      <header className="flex w-full items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
        <Link href="/profile" className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t("common.back")}
        </Link>
        <div className="flex items-center gap-4">
            <h1 className="text-sm font-semibold text-zinc-900 dark:text-white hidden sm:block">
                {t("admin.menu.title")}
            </h1>
            <LanguageSwitcher />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        
        <div className="mb-8">
          {/* TRADUÏT */}
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("admin.dashboard.summaryTitle")}</h2>
          <p className="text-zinc-500 text-sm">{t("admin.dashboard.summaryDesc")}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
            
            {/* KPI: EMPLEATS */}
            <Card className="relative overflow-hidden p-6">
                <dt>
                    <div className="absolute rounded-md bg-blue-500 p-3">
                        <UserMinus className="h-6 w-6 text-white" />
                    </div>
                    <p className="ml-16 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">{t("admin.stats.totalUsers")}</p>
                </dt>
                <dd className="ml-16 flex items-baseline">
                    <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
                        {loading ? "-" : stats.usersCount}
                    </p>
                </dd>
            </Card>

            {/* KPI: WORKING NOW */}
            <Card className="relative overflow-hidden p-6">
                <dt>
                    <div className="absolute rounded-md bg-indigo-500 p-3">
                        <Timer className="h-6 w-6 text-white" />
                    </div>
                    <p className="ml-16 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">{t("admin.stats.workingNow")}</p>
                </dt>
                <dd className="ml-16 flex items-baseline">
                    <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
                        {loading ? "-" : stats.currentlyWorking}
                    </p>
                </dd>
            </Card>

            {/* KPI: VACANCES PENDENTS */}
            <Card className="relative overflow-hidden p-6">
                <dt>
                    <div className={`absolute rounded-md p-3 ${stats.pendingVacations > 0 ? 'bg-orange-500' : 'bg-green-500'}`}>
                        <Calendar className="h-6 w-6 text-white" />
                    </div>
                    <p className="ml-16 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">{t("admin.stats.pendingVacations")}</p>
                </dt>
                <dd className="ml-16 flex items-baseline">
                    <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
                        {loading ? "-" : stats.pendingVacations}
                    </p>
                    {stats.pendingVacations > 0 && (
                        <span className="ml-2 text-sm font-medium text-orange-600">{t("admin.stats.review")}</span>
                    )}
                </dd>
            </Card>

            {/* KPI: GRUPS */}
            <Card className="relative overflow-hidden p-6">
                <dt>
                    <div className="absolute rounded-md bg-purple-500 p-3">
                        <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <p className="ml-16 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">{t("admin.stats.departments")}</p>
                </dt>
                <dd className="ml-16 flex items-baseline">
                    <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
                        {loading ? "-" : stats.groupsCount}
                    </p>
                </dd>
            </Card>
        </div>


        <div className="mb-6">
          {/* TRADUÏT */}
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{t("admin.dashboard.quickActions")}</h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {menuItems.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className="group relative flex flex-col items-start rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
            >
              <div className="flex w-full items-center justify-between mb-4">
                  <div className={`grid h-12 w-12 place-items-center rounded-xl ${item.bgColor} ${item.iconColor}`}>
                    {item.icon}
                  </div>
                  {item.alert && (
                      <span className="flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                      </span>
                  )}
              </div>
              
              <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400 transition-colors">
                {item.title}
              </h3>
              
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {item.desc}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}