"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";
import LanguageSwitcher from "../../components/LanguageSwitcher";

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
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
      )
    },
    {
      title: t("admin.menu.groups.title"),
      desc: t("admin.menu.groups.desc"),
      href: "/admin/groups",
      iconColor: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
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
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h10"/><path d="M9 4v16"/><path d="M3 9l3 3-3 3"/><path d="M14 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2"/></svg>
      )
    },
    {
      title: t("admin.menu.calendar.title"),
      desc: t("admin.menu.calendar.desc"),
      href: "/admin/calendar",
      iconColor: "text-pink-600 dark:text-pink-400", // Color Rosa/Vermellós
      bgColor: "bg-pink-50 dark:bg-pink-900/20",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      )
    },
    {
      title: t("admin.menu.yearlyvacations.title"),
      desc: t("admin.menu.yearlyvacations.desc"),
      href: "/admin/yearly-vacations",
      iconColor: "text-pink-600 dark:text-pink-400", // Color Rosa/Vermellós
      bgColor: "bg-pink-50 dark:bg-pink-900/20",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      
      <header className="flex w-full items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
        <Link href="/profile" className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
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
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <dt>
                    <div className="absolute rounded-md bg-blue-500 p-3">
                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                    <p className="ml-16 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">{t("admin.stats.totalUsers")}</p>
                </dt>
                <dd className="ml-16 flex items-baseline">
                    <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
                        {loading ? "-" : stats.usersCount}
                    </p>
                </dd>
            </div>

            {/* KPI: WORKING NOW */}
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <dt>
                    <div className="absolute rounded-md bg-indigo-500 p-3">
                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="ml-16 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">{t("admin.stats.workingNow")}</p>
                </dt>
                <dd className="ml-16 flex items-baseline">
                    <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
                        {loading ? "-" : stats.currentlyWorking}
                    </p>
                </dd>
            </div>

            {/* KPI: VACANCES PENDENTS */}
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <dt>
                    <div className={`absolute rounded-md p-3 ${stats.pendingVacations > 0 ? 'bg-orange-500' : 'bg-green-500'}`}>
                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
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
            </div>

            {/* KPI: GRUPS */}
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <dt>
                    <div className="absolute rounded-md bg-purple-500 p-3">
                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                    <p className="ml-16 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">{t("admin.stats.departments")}</p>
                </dt>
                <dd className="ml-16 flex items-baseline">
                    <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
                        {loading ? "-" : stats.groupsCount}
                    </p>
                </dd>
            </div>
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