"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";
import { ElectiveVacation, YearlyVacationDays } from "@/types";

// Tipus per a les vacances agrupades
type GroupedVacation = {
  ids: string[];
  startDate: Date;
  endDate: Date;
  daysCount: number;
  status: string;
  reason?: string;
};

export default function MyVacationsPage() {
  const { t } = useI18n();
  
  const [vacations, setVacations] = useState<ElectiveVacation[]>([]);
  const [stats, setStats] = useState<YearlyVacationDays | null>(null);
  const [loading, setLoading] = useState(true);

  // Estats del formulari
  const [date, setDate] = useState("");
  const [daysCount, setDaysCount] = useState(1);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // Estats per missatges
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  // Modal Cancel·lar
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [vacationsToCancel, setVacationsToCancel] = useState<string[]>([]);
  const [isCancelling, setIsCancelling] = useState(false);

  // 1. Carregar dades
  const fetchData = async () => {
    try {
      const user = await apiClient.getCurrentUser();
      if (user) {
        const currentYear = new Date().getFullYear();
        const res = await apiClient.getUserVacations(user._id, currentYear);
        
        if (res.data) {
          setVacations(res.data.electives || []);
          setStats(res.data.yearlyVacationDays || null);
        }
      }
    } catch (error) {
      console.error("Error carregant vacances:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- LÒGICA D'AGRUPACIÓ CORREGIDA ---
  const groupedVacations = useMemo(() => {
    if (vacations.length === 0) return [];

    // 1. Ordenem de MÉS NOU a MÉS VELL
    const sorted = [...vacations].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const groups: GroupedVacation[] = [];
    
    sorted.forEach((vac) => {
        const vacDate = new Date(vac.date);
        // Normalitzem hores per evitar problemes si es van crear a hores diferents
        vacDate.setHours(0, 0, 0, 0);

        const lastGroup = groups[groups.length - 1];

        if (lastGroup) {
            // IMPORTANT: Com que anem cap enrere en el temps, hem de comparar 
            // amb la data d'INICI del grup (que és la més "vella" del grup actualment)
            const groupStartDate = new Date(lastGroup.startDate);
            groupStartDate.setHours(0, 0, 0, 0);

            // Calculem la diferència en mil·lisegons
            const diffTime = groupStartDate.getTime() - vacDate.getTime();
            // Convertim a dies
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            // Si la diferència és exactament 1 dia, és consecutiu
            const isConsecutive = diffDays === 1; 
            const sameStatus = lastGroup.status === vac.status;
            const sameReason = (lastGroup.reason || "") === (vac.reason || "");

            if (isConsecutive && sameStatus && sameReason) {
                // Actualitzem la data d'inici perquè "vacDate" és anterior
                lastGroup.startDate = new Date(vac.date); 
                lastGroup.ids.push(vac._id);
                lastGroup.daysCount += 1;
                return;
            }
        }

        // Si no encaixa, creem grup nou
        groups.push({
            ids: [vac._id],
            startDate: new Date(vac.date),
            endDate: new Date(vac.date),
            daysCount: 1,
            status: vac.status,
            reason: vac.reason
        });
    });

    return groups;
  }, [vacations]);

  // 2. Enviar sol·licitud
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    
    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    setWarningMsg(null);

    try {
      const startDate = new Date(date);
      const reasonToSend = reason.trim() || undefined; 
      
      let createdCount = 0;
      let errorCount = 0;
      let limitExceeded = false;

      for (let i = 0; i < daysCount; i++) {
        const dateToSend = new Date(startDate);
        dateToSend.setDate(startDate.getDate() + i);

        const res = await apiClient.createVacation({
          date: dateToSend, 
          reason: reasonToSend
        });

        if (res.error) {
          errorCount++;
          if (res.error === 'IllegalAction' || res.error === 'AllVacationsUsed') {
            limitExceeded = true;
          }
        } else {
          createdCount++;
        }
      }

      if (createdCount > 0) {
        await fetchData();
        setDate("");
        setDaysCount(1);
        setReason("");
      }

      if (createdCount > 0 && errorCount === 0) {
        setSuccessMsg(t("vacations.success")); 
        setTimeout(() => setSuccessMsg(null), 3000);
      } else if (createdCount > 0 && errorCount > 0) {
        const msg = t("error.partialVacation")
            .replace("{created}", createdCount.toString())
            .replace("{failed}", errorCount.toString());
        setWarningMsg(msg);
      } else {
        if (limitExceeded) setErrorMsg(t("error.vacationLimit"));
        else setErrorMsg(t("error.PostError"));
      }

    } catch (error) {
      console.error(error);
      setErrorMsg(t("error.PostError"));
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Modals
  const openCancelModal = (ids: string[]) => {
    setVacationsToCancel(ids);
    setIsCancelModalOpen(true);
  };

  const closeCancelModal = () => {
    setIsCancelModalOpen(false);
    setVacationsToCancel([]);
  };

  const confirmCancel = async () => {
    if (vacationsToCancel.length === 0) return;
    
    setIsCancelling(true);
    try {
      await Promise.all(vacationsToCancel.map(id => apiClient.cancelVacation(id)));
      await fetchData(); 
      closeCancelModal(); 
    } catch (error) {
      console.error(error);
      alert("Error al cancel·lar");
    } finally {
      setIsCancelling(false);
    }
  };

  // Càlculs i Formats
  const totalDays = stats?.electiveDaysTotalCount || 22; 
  const usedDays = stats?.selectedElectiveDays?.length || 0;
  const remainingDays = totalDays - usedDays;

  const formatDateRange = (start: Date, end: Date) => {
    const s = start.toLocaleDateString();
    const e = end.toLocaleDateString();
    if (s === e) return s;
    return `${s} - ${e}`;
  };

  if (loading) return <div className="p-10 text-center animate-pulse text-zinc-500">{t("common.loading")}</div>;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-10 relative">
      
      {/* HEADER */}
      <header className="flex w-full items-center px-6 py-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
        <Link href="/profile" className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("common.back") || "Tornar"}
        </Link>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white mx-auto">
            {t("vacations.title")}
        </h1>
        <div className="w-10"></div> 
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <dt>
                    <div className="absolute rounded-md bg-indigo-500 p-3">
                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <p className="ml-16 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">{t("vacations.balance")}</p>
                </dt>
                <dd className="ml-16 flex items-baseline">
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">{remainingDays}</p>
                </dd>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <dt>
                    <div className="absolute rounded-md bg-zinc-100 p-3 dark:bg-zinc-800">
                        <svg className="h-6 w-6 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="ml-16 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">{t("vacations.used")}</p>
                </dt>
                <dd className="ml-16 flex items-baseline">
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">{usedDays}</p>
                </dd>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <dt>
                    <div className="absolute rounded-md bg-zinc-100 p-3 dark:bg-zinc-800">
                        <svg className="h-6 w-6 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <p className="ml-16 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">{t("vacations.total")}</p>
                </dt>
                <dd className="ml-16 flex items-baseline">
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalDays}</p>
                </dd>
            </div>
        </div>

        {/* --- FORMULARI SOL·LICITUD --- */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">{t("vacations.request")}</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1.5 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
                            {t("vacations.date")}
                        </label>
                        <input 
                            type="date" 
                            required
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white transition-all"
                        />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1.5 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
                            {t("vacations.consecutiveDays")}
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min="1"
                                max="30"
                                required
                                value={daysCount}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setDaysCount(isNaN(val) ? 1 : Math.max(1, val));
                                }}
                                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white transition-all"
                            />
                            <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none">
                                {daysCount === 1 ? t("vacations.day") : t("vacations.days")}
                            </span>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
                        {t("vacations.reason")}
                    </label>
                    <input 
                        type="text" 
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ex: Assumptes personals..."
                        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white transition-all"
                    />
                </div>

                {successMsg && (
                    <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {successMsg}
                    </div>
                )}
                
                {warningMsg && (
                    <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 flex items-center gap-2 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        {warningMsg}
                    </div>
                )}

                {errorMsg && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {errorMsg}
                    </div>
                )}

                <button 
                    type="submit"
                    disabled={submitting}
                    className="w-full mt-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-md hover:bg-zinc-800 disabled:opacity-50 transition-colors dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                    {submitting ? t("common.loading") : t("vacations.submit")}
                </button>
            </form>
        </div>

        {/* --- LLISTA HISTORIAL --- */}
        <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">{t("vacations.history")}</h2>
            
            {groupedVacations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 p-10 text-center text-sm text-zinc-400 dark:border-zinc-800">
                {t("vacations.empty")}
            </div>
            ) : (
            <div className="space-y-3">
                {groupedVacations.map((group, index) => (
                <div key={`${group.startDate.toString()}-${index}`} className="group flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-indigo-300 transition-colors dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-lg">📅</span>
                            <div className="font-semibold text-zinc-900 dark:text-white">
                                {formatDateRange(group.startDate, group.endDate)}
                            </div>
                            {/* BADGE DE DIES TOTALS */}
                            {group.daysCount > 1 && (
                                <span className="ml-2 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                    {group.daysCount} {t("vacations.days")}
                                </span>
                            )}
                        </div>
                        {group.reason && (
                            <div className="ml-8 text-xs text-zinc-500 mt-0.5">"{group.reason}"</div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            group.status === 'approved' 
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30' 
                            : group.status === 'rejected'
                            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30'
                            : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/30'
                        }`}>
                            {t(`vacations.status.${group.status}`)}
                        </span>

                        {group.status === 'pending' && (
                            <button 
                                onClick={() => openCancelModal(group.ids)}
                                className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors dark:hover:bg-red-900/20"
                                title={t("vacations.cancel")}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        )}
                    </div>
                </div>
                ))}
            </div>
            )}
        </div>

      </div>

      {/* --- MODAL DE CANCEL·LACIÓ --- */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
            
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>

            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {t("vacations.cancelModal.title")}
            </h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {t("vacations.cancelModal.body")}
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={closeCancelModal}
                disabled={isCancelling}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={confirmCancel}
                disabled={isCancelling}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none disabled:opacity-50"
              >
                {isCancelling ? t("common.loading") : t("vacations.cancelModal.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}