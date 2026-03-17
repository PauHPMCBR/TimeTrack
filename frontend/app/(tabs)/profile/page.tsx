"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link"; 
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";
import { WorkSession } from "@/types";
import { usePathname } from "next/navigation";

function fmtHM(hours: number, t: (k: string) => string) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const labelH = t("time.h") || "h";
  const labelM = t("time.m") || "m";
  return `${h}${labelH} ${m}${labelM}`;
}

export default function ProfilePage() {
  const { t, lang } = useI18n();
  const pathname = usePathname();

  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);

  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [timeFmt, setTimeFmt] = useState<"24" | "12">("24");

  // 1. CARREGUEM L'USUARI
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setUser(null); 
      setSessions([]);

      try {
        const currentUser = await apiClient.getCurrentUser();
        
        if (currentUser) {
          setUser(currentUser);
          
          const today = new Date();
          const res = await apiClient.getDailyRecords(currentUser._id, today);
          if (res.data && res.data.workSessions) {
            setSessions(res.data.workSessions);
          }
        }
      } catch (error) {
        console.error("Error carregant perfil:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [pathname]);

  // 2. Preferències
  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") as "light" | "dark") || "dark";
    const savedFmt = (localStorage.getItem("time_format") as "24" | "12") || "24";
    setTheme(savedTheme);
    setTimeFmt(savedFmt);
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const changeTimeFmt = (fmt: "24" | "12") => {
    setTimeFmt(fmt);
    localStorage.setItem("time_format", fmt);
  };

  // 3. CÀLCULS
  const workedHoursToday = useMemo(() => {
    let totalMs = 0;
    let lastIn: Date | null = null;
    
    const sorted = [...sessions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    sorted.forEach(s => {
        if (s.type === 'check_in') lastIn = new Date(s.timestamp);
        else if (s.type === 'check_out' && lastIn) {
            totalMs += new Date(s.timestamp).getTime() - lastIn.getTime();
            lastIn = null;
        }
    });
    
    if (lastIn) totalMs += Date.now() - (lastIn as Date).getTime();
    return totalMs / 3_600_000;
  }, [sessions]);

  const isCheckedIn = useMemo(() => {
     if (sessions.length === 0) return false;
     const last = sessions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[sessions.length - 1];
     return last.type === 'check_in';
  }, [sessions]);

  const checkedInDuration = useMemo(() => {
      if (!isCheckedIn || sessions.length === 0) return "";
      const last = sessions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[sessions.length - 1];
      const ms = Date.now() - new Date(last.timestamp).getTime();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      
      const labelH = t("time.h") || "h";
      const labelM = t("time.m") || "m";
      return `${h}${labelH} ${m}${labelM}`;
  }, [isCheckedIn, sessions, t]);


  if (loading) return <div className="p-10 text-center text-zinc-500 animate-pulse">{t("common.loading")}</div>;
  if (!user) return <div className="p-10 text-center text-red-500">Error carregant usuari</div>;

  const displayName = user.name || "Usuari";
  const initials = user.email 
    ? user.email.trim()[0].toUpperCase() 
    : (user.name ? user.name.trim()[0].toUpperCase() : "U");

  return (
    <section className="space-y-6 pb-20">
      {/* --- CAPÇALERA USUARI --- */}
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-indigo-600 text-white shadow-lg">
          <span className="text-2xl font-bold">{initials}</span>
        </div>
        <div>
          <div className="text-lg font-semibold text-zinc-900 dark:text-white">{displayName}</div>
          <div className="text-sm text-zinc-500">{user.email}</div>
          <div className="mt-1 inline-block rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
             {user.role || "Employee"}
          </div>
        </div>
      </div>

      {/* --- ESTADÍSTIQUES (AVUI) --- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">{t("profile.hoursToday")}</div> 
          <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{fmtHM(workedHoursToday, t)}</div>
        </div>
        
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">{t("profile.status")}</div>
          <div className="mt-1 text-base text-zinc-900 dark:text-zinc-100">
            {isCheckedIn ? (
              <span className="inline-flex items-center gap-2 text-green-600 font-medium">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-sm" />
                {t("profile.status.checkedInAgo").replace("{time}", checkedInDuration)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-zinc-500">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" />
                {t("checkin.notIn")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* --- LINK A VACANCES (NOU) --- */}
      <Link 
        href="/vacations" 
        className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:bg-zinc-50 hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50 dark:hover:border-indigo-700"
      >
        <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
                {/* Icona Maleta/Sol */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-8a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v8"/><path d="M23 21v-8a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v8"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="12" cy="12" r="10"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/></svg>
            </div>
            <div>
                <div className="font-semibold text-zinc-900 dark:text-white text-lg">
                    {t("vacations.title")}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t("vacations.manageDesc") || "Demanar festa i veure l'historial"}
                </div>
            </div>
        </div>
        
        {/* Fletxa dreta */}
        <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </Link>
      
      {/* --- LINK A GRUPS --- */}
      <Link 
        href="/groups" 
        className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:bg-zinc-50 hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50 dark:hover:border-indigo-700"
      >
        <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
                <div className="font-semibold text-zinc-900 dark:text-white text-lg">
                    {t("tabs.groups")}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t("groups.subtitle")}
                </div>
            </div>
        </div>
        
        <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </Link>

      {/* --- PREFERÈNCIES --- */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 text-sm font-medium text-zinc-900 dark:text-white">{t("profile.preferences")}</div>
        
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-zinc-700 dark:text-zinc-300">{t("profile.theme")}</div>
          <button onClick={toggleTheme} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300">
            {theme === 'dark' ? (lang === 'en' ? 'Dark' : (lang === 'es' ? 'Oscuro' : 'Fosc')) : (lang === 'en' ? 'Light' : (lang === 'es' ? 'Claro' : 'Clar'))}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-700 dark:text-zinc-300">{t("profile.timeFormat")}</div>
          <div className="flex gap-2">
            <button onClick={() => changeTimeFmt("24")} className={`rounded-lg border px-3 py-1.5 text-sm ${timeFmt === "24" ? "border-indigo-600 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" : "border-zinc-300 dark:border-zinc-700"}`}>24h</button>
            <button onClick={() => changeTimeFmt("12")} className={`rounded-lg border px-3 py-1.5 text-sm ${timeFmt === "12" ? "border-indigo-600 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" : "border-zinc-300 dark:border-zinc-700"}`}>12h</button>
          </div>
        </div>
      </div>

      {/* --- ZONA D'ADMINISTRACIÓ (NOMÉS ADMINS) --- */}
      {user.role === 'admin' && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-900/10">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-indigo-900 dark:text-indigo-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            {t("profile.admin.title")}
          </div>
          
          <div className="text-sm text-indigo-800/80 dark:text-indigo-200/70 mb-4">
            {t("profile.admin.description")}
          </div>

          <Link 
            href="/admin" 
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            {t("profile.admin.title")}
          </Link>
        </div>
      )}

    </section>
  );
}