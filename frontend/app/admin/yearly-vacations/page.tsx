"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api"; 
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { YearlyVacationAdminRequest } from "@/schemas/api";

export default function AdminObligatoryVacationsPage() {
  const { t } = useI18n();
  
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [vacationDays, setVacationDays] = useState<YearlyVacationAdminRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Local state for editing
  const [obligatoryDays, setObligatoryDays] = useState<Date[]>([]);
  const [electiveDaysTotalCount, setElectiveDaysTotalCount] = useState<number>(0);
  const [newDate, setNewDate] = useState<string>("");

  // Fetch data for the selected year
  const fetchYearlyVacations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await apiClient.getYearlyVacationsGlobal(year);
      
      if (res.error) {
        if (res.error === 'EntryNotFound') {
          // No data exists for this year yet, create empty template
          setVacationDays(null);
          setObligatoryDays([]);
          setElectiveDaysTotalCount(0);
        } else {
          setError(t(`error.${res.error}`) || res.error || t("error.GetError"));
        }
      } else if (res.data?.vacations) {
        setVacationDays(res.data.vacations);
        setObligatoryDays(res.data.vacations.obligatoryDays.map(date => new Date(date)));
        setElectiveDaysTotalCount(res.data.vacations.electiveDaysTotalCount);
      }
    } catch (error) {
      console.error("Error loading yearly vacations:", error);
      setError(t("error.GetError") || "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYearlyVacations();
  }, [year]);

  // Handle year change
  const handleYearChange = (newYear: number) => {
    setYear(newYear);
  };

  // Add a new obligatory date
  const handleAddDate = () => {
    if (!newDate) return;
    
    const date = new Date(newDate);
    if (isNaN(date.getTime())) {
      setError(t("admin.vacationsSetup.invalidDate") || "Invalid date");
      return;
    }

    // Check if date already exists
    const exists = obligatoryDays.some(d => 
      d.getFullYear() === date.getFullYear() &&
      d.getMonth() === date.getMonth() &&
      d.getDate() === date.getDate()
    );

    if (exists) {
      setError(t("admin.vacationsSetup.dateExists") || "Date already exists");
      return;
    }

    // Add the date
    const newDays = [...obligatoryDays, date].sort((a, b) => a.getTime() - b.getTime());
    setObligatoryDays(newDays);
    setNewDate("");
    setError(null);
  };

  // Remove an obligatory date
  const handleRemoveDate = (index: number) => {
    const newDays = [...obligatoryDays];
    newDays.splice(index, 1);
    setObligatoryDays(newDays);
  };

  // Save changes
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const vacationData: YearlyVacationAdminRequest = {
        year,
        obligatoryDays,
        electiveDaysTotalCount,
      };

      const res = await apiClient.setYearlyVacationsAdmin(vacationData);
      
      if (res.error) {
        setError(res.error || t("error.PostError"));
      } else {
        const successMessage = vacationDays 
          ? t("admin.vacationsSetup.saveSubtitleUpdate").replace("{year}", year.toString())
          : t("admin.vacationsSetup.saveSubtitleCreate").replace("{year}", year.toString());
        setSuccess(successMessage);
        
        // Update local state with saved data
        setVacationDays(vacationData);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (error) {
      console.error("Error saving vacations:", error);
      setError(t("error.PostError") || "Error saving data");
    } finally {
      setSaving(false);
    }
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Group dates by month for better display
  const datesByMonth = () => {
    const groups: Record<string, Date[]> = {};
    
    obligatoryDays.forEach(date => {
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(date);
    });
    
    return groups;
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      
      {/* HEADER */}
      <header className="flex w-full items-center justify-between px-6 py-4">
        <Link href="/admin" className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("common.back")}
        </Link>
        <LanguageSwitcher />
      </header>

      {/* CONTENT */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {t("admin.vacationsSetup.title")}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {t("admin.vacationsSetup.subtitle")}
              </p>
            </div>
            
            {/* Year selector */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleYearChange(year - 1)}
                className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                disabled={loading || saving}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="min-w-[100px] text-center">
                <span className="text-lg font-semibold text-zinc-900 dark:text-white">{year}</span>
              </div>
              
              <button 
                onClick={() => handleYearChange(year + 1)}
                className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                disabled={loading || saving}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-sm underline"
            >
              {t("common.close")}
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg bg-green-50 p-4 text-green-600 dark:bg-green-900/20 dark:text-green-400">
            {success}
            <button 
              onClick={() => setSuccess(null)}
              className="ml-2 text-sm underline"
            >
              {t("common.close")}
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center animate-pulse text-zinc-500">
            {t("common.loading")}
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* --- OBLIGATORY VACATIONS --- */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-400"></span>
                  {t("admin.vacationsSetup.obligatoryTitle")}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {t("admin.vacationsSetup.obligatorySubtitle")}
                </p>
              </div>

              {/* Add new date form */}
              <div className="mb-6 flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t("admin.vacationsSetup.addDate")}
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:text-white"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddDate}
                    disabled={!newDate || saving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("admin.vacationsSetup.addButton")}
                  </button>
                </div>
              </div>

              {/* Dates list */}
              {obligatoryDays.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
                  {t("admin.vacationsSetup.noDates")}
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(datesByMonth()).map(([monthYear, dates]) => (
                    <div key={monthYear} className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                      <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-3">
                        <h3 className="font-medium text-zinc-900 dark:text-white">
                          {monthYear} <span className="text-sm text-zinc-500">({dates.length} days)</span>
                        </h3>
                      </div>
                      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {dates.map((date, index) => (
                          <div key={date.toISOString()} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                <span className="text-sm font-medium">{date.getDate()}</span>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-zinc-900 dark:text-white">
                                  {formatDate(date)}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {date.toLocaleDateString('en-US', { weekday: 'long' })}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveDate(obligatoryDays.indexOf(date))}
                              disabled={saving}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* --- ELECTIVE DAYS SETTINGS --- */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-400"></span>
                  {t("admin.vacationsSetup.electiveTitle")}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {t("admin.vacationsSetup.electiveSubtitle")}
                </p>
              </div>

              <div className="">
                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("admin.vacationsSetup.electiveDaysLabel")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="366"
                    value={electiveDaysTotalCount}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setElectiveDaysTotalCount(Math.min(30, Math.max(0, value)));
                    }}
                    className="w-24 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-center text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-zinc-700 dark:text-white"
                  />
                  <span className="text-sm text-zinc-500">
                    {t("admin.vacationsSetup.days")}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  {t("admin.vacationsSetup.electiveHelp")}
                </p>
              </div>
            </section>

            {/* --- SAVE BUTTON --- */}
            <div className="sticky bottom-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    {t("admin.vacationsSetup.saveTitle")}
                  </div>
                  <div className="text-sm text-zinc-500">
                    {vacationDays 
                      ? t("admin.vacationsSetup.saveSubtitleUpdate").replace("{year}", year.toString())
                      : t("admin.vacationsSetup.saveSubtitleCreate").replace("{year}", year.toString())}
                  </div>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t("common.saving") || "Saving..."}
                    </span>
                  ) : (
                    t("common.save")
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}