"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api"; 
import LanguageSwitcher from "../../../components/LanguageSwitcher"; 

export default function GlobalCalendarPage() {
  const { t, lang } = useI18n();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [vacations, setVacations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await apiClient.getAllVacationsYearAdmin(); //FIXME
        if (res.data && res.data.vacations) {
          setVacations(res.data.vacations);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // --- LÒGICA DEL CALENDARI ---
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1; 
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate.setMonth(currentDate.getMonth() + offset));
    setCurrentDate(new Date(newDate));
  };

  // --- CANVI AQUÍ: FORMAT PERSONALITZAT "MES ANY" ---
  const locale = lang === 'en' ? 'en-US' : (lang === 'ca' ? 'ca-ES' : 'es-ES');
  
  // 1. Obtenim només el nom del mes (ex: "desembre")
  const monthOnly = currentDate.toLocaleString(locale, { month: 'long' });
  
  // 2. Posem la primera lletra en Majúscula (ex: "Desembre")
  const monthCapitalized = monthOnly.charAt(0).toUpperCase() + monthOnly.slice(1);
  
  // 3. Ajuntem Mes + Any (Sense "de" ni "del") -> "Desembre 2025"
  const monthName = `${monthCapitalized} ${currentDate.getFullYear()}`;

  // `t("calendar.weekDays")` is stored as a comma-separated string in the dictionaries.
  // Ensure we always have an array to call `.map` on during render (avoid prerender errors).
  const _weekDaysRaw = t("calendar.weekDays");
  let weekDays: string[] = ["Dl", "Dt", "Dc", "Dj", "Dv", "Ds", "Dg"];
  if (Array.isArray(_weekDaysRaw)) {
    weekDays = _weekDaysRaw as string[];
  } else if (typeof _weekDaysRaw === "string") {
    weekDays = _weekDaysRaw.split(",").map(s => s.trim()).filter(Boolean);
  }
  
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const blanks = Array(firstDay).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      
      <header className="flex w-full items-center justify-between px-6 py-4">
        <Link href="/admin" className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t("common.back")}
        </Link>
        <LanguageSwitcher />
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        
        {/* TITOL I CONTROLS */}
        <div className="mb-8 flex items-center justify-between">
            {/* Ara monthName ja ve net sense el "de" */}
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{monthName}</h1>
            
            <div className="flex gap-2">
                <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                    <svg className="h-5 w-5 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={() => changeMonth(1)} className="p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                    <svg className="h-5 w-5 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
        </div>

        {/* CALENDARI */}
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
            <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                {weekDays.map((day) => (
                    <div key={day} className="py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 auto-rows-fr">
                {blanks.map((_, i) => (
                    <div key={`blank-${i}`} className="min-h-[120px] border-b border-r border-zinc-100 bg-zinc-50/50 p-2 dark:border-zinc-800 dark:bg-zinc-900/20"></div>
                ))}

                {days.map((day) => {
                    const currentDayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                    const dayVacations = vacations.filter(v => {
                        const vDate = new Date(v.date);
                        return vDate.getDate() === day && 
                               vDate.getMonth() === currentDate.getMonth() && 
                               vDate.getFullYear() === currentDate.getFullYear();
                    });

                    return (
                        <div key={day} className="min-h-[120px] border-b border-r border-zinc-100 p-2 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/30">
                            <div className="mb-2 text-sm font-medium text-zinc-400">
                                {day}
                            </div>
                            
                            <div className="space-y-1">
                                {dayVacations.map((v) => (
                                    <div 
                                        key={v._id} 
                                        className={`truncate rounded px-1.5 py-0.5 text-xs font-medium ${
                                            v.status === 'approved' 
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                                                : v.status === 'rejected'
                                                ? 'bg-red-50 text-red-400 line-through opacity-50'
                                                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                        }`}
                                        title={`${v.userId?.name} (${v.status})`}
                                    >
                                        {v.userId?.name || "???"}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
}