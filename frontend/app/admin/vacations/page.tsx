"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api"; 
import LanguageSwitcher from "../../../components/LanguageSwitcher"; 
import { ElectiveVacation, User } from "@/types";
import { Alert } from "@/components/ui/Alert";

// 1. DEFINIM EL TIPUS PER A LES VACANCES AGRUPADES
type GroupedRequest = {
  ids: string[];        // Array amb totes les IDs dels dies individuals
  userId: string;
  startDate: Date;
  endDate: Date;
  daysCount: number;
  status: string;
  reason?: string;
};

export default function AdminVacationsPage() {
  const { t } = useI18n();
  
  const [requests, setRequests] = useState<ElectiveVacation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [obligatoryDays, setObligatoryDays] = useState<Date[]>([]);
  const [processingIds, setProcessingIds] = useState<string[]>([]); // Per evitar doble click

  const usersMap = useMemo(() => {
    const map: Record<string, User> = {};
    users.forEach(user => {
      map[user._id] = user;
    });
    return map;
  }, [users]);

  const getUserInfo = (userId: string): User | null => {
    return usersMap[userId] || null;
  };

  const fetchVacations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [resVacations, resUsers] = await Promise.allSettled([
        apiClient.getAllVacationsYearAdmin(year),
        apiClient.getCompanyUsers()
      ]);

      if (resVacations.status === 'fulfilled' && resVacations.value.data) {
        setRequests(resVacations.value.data.electives || []);
        setObligatoryDays(resVacations.value.data.yearlyVacationDays?.obligatoryDays || []);
      } else if (resVacations.status === 'rejected') {
        console.error("Error loading vacations:", resVacations.reason);
        setError(t("error.GetError") || "Error loading vacations");
      }

      if (resUsers.status === 'fulfilled' && resUsers.value.data?.users) {
        setUsers(resUsers.value.data.users);
      }

    } catch (error) {
      console.error("Unexpected error:", error);
      setError(t("error.GetError") || "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVacations();
  }, [year]);

  const handleYearChange = (newYear: number) => {
    setYear(newYear);
  };

  // 2. LÒGICA D'AGRUPACIÓ (NOVA)
  const groupRequests = (rawRequests: ElectiveVacation[]): GroupedRequest[] => {
    if (rawRequests.length === 0) return [];

    // Ordenem per USUARI i després per DATA (Importantíssim)
    const sorted = [...rawRequests].sort((a, b) => {
        if (a.userId !== b.userId) return a.userId.localeCompare(b.userId);
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    const groups: GroupedRequest[] = [];

    sorted.forEach((vac) => {
        const vacDate = new Date(vac.date);
        vacDate.setHours(0, 0, 0, 0);

        const lastGroup = groups[groups.length - 1];

        // Comprovem si podem agrupar amb l'anterior
        if (lastGroup && lastGroup.userId === vac.userId && lastGroup.status === vac.status) {
            const groupEndDate = new Date(lastGroup.endDate);
            groupEndDate.setHours(0,0,0,0);

            // Diferència en dies
            const diffTime = vacDate.getTime() - groupEndDate.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            // Si és consecutiu (1 dia de diferència) O té el mateix motiu (opcional, però ajuda si hi ha caps de setmana)
            const sameReason = (lastGroup.reason || "") === (vac.reason || "");
            
            // Agrupem si són consecutius O si tenen mateix motiu i estan a prop (< 4 dies, per saltar cap de setmana)
            if (diffDays === 1 || (diffDays <= 4 && sameReason)) {
                lastGroup.endDate = new Date(vac.date);
                lastGroup.ids.push(vac._id);
                lastGroup.daysCount += 1;
                return;
            }
        }

        // Si no encaixa, grup nou
        groups.push({
            ids: [vac._id],
            userId: vac.userId,
            startDate: new Date(vac.date),
            endDate: new Date(vac.date),
            daysCount: 1,
            status: vac.status,
            reason: vac.reason
        });
    });

    return groups;
  };

  // 3. ACCIÓ EN LOT (BULK RESOLVE)
  const handleBulkResolve = async (ids: string[], status: 'approved' | 'rejected') => {
    if (ids.length === 0) return;
    
    // Evitem doble click
    setProcessingIds(prev => [...prev, ...ids]);

    try {
      // Optimistic Update: Actualitzem la UI immediatament
      setRequests(prev => prev.map(req => 
        ids.includes(req._id) ? { ...req, status: status } : req
      ));

      // Enviem totes les peticions alhora al backend
      await Promise.all(ids.map(id => apiClient.resolveVacation(id, status)));
      
      // Opcional: Refresquem per assegurar consistència
      // await fetchVacations(); 

    } catch (error) {
      console.error("Error resolving group:", error);
      await fetchVacations(); // Si falla, recarreguem l'estat real
      setError(t("error.PostError") || "Connection error");
    } finally {
        setProcessingIds(prev => prev.filter(id => !ids.includes(id)));
    }
  };

  // 4. APLIQUEM L'AGRUPACIÓ
  // Primer filtrem per estat, DESPRÉS agrupem
  const pendingGroups = useMemo(() => groupRequests(requests.filter(r => r.status === 'pending')), [requests]);
  const approvedGroups = useMemo(() => groupRequests(requests.filter(r => r.status === 'approved')), [requests]);
  const rejectedGroups = useMemo(() => groupRequests(requests.filter(r => r.status === 'rejected')), [requests]);
  const cancelledGroups = useMemo(() => groupRequests(requests.filter(r => r.status === 'cancelled')), [requests]);

  // Statistics (Basat en dies individuals, no grups)
  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    cancelled: requests.filter(r => r.status === 'cancelled').length,
    obligatoryDays: obligatoryDays.length,
  }), [requests, obligatoryDays]);

  const formatDateRange = (start: Date, end: Date) => {
    const s = start.toLocaleDateString();
    const e = end.toLocaleDateString();
    if (s === e) return s;
    return `${s} - ${e}`;
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
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("admin.vacations.title")}</h1>
              <p className="mt-1 text-sm text-zinc-500">{t("admin.vacations.subtitle")}</p>
            </div>
            
            {/* Year selector */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleYearChange(year - 1)}
                className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                disabled={loading}
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
                disabled={loading}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Statistics */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">{t("admin.vacations.total")}</div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.total}</div>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
              <div className="text-sm text-orange-600 dark:text-orange-400">{t("admin.vacations.pending")}</div>
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{stats.pending}</div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
              <div className="text-sm text-green-600 dark:text-green-400">{t("admin.vacations.approved")}</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.approved}</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <div className="text-sm text-red-600 dark:text-red-400">{t("admin.vacations.rejected")}</div>
              <div className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.rejected}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/20">
              <div className="text-sm text-gray-600 dark:text-gray-400">{t("admin.vacations.cancelled")}</div>
              <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{stats.cancelled}</div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <div className="text-sm text-blue-600 dark:text-blue-400">{t("calendar.obligatoryVacation")}</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.obligatoryDays}</div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <Alert 
            variant="destructive" 
            onClose={() => setError(null)} 
          >
            {error}
          </Alert>
        )}

        {loading ? (
           <div className="p-10 text-center animate-pulse text-zinc-500">{t("common.loading")}</div>
        ) : (
           <div className="space-y-10">
             
             {/* --- PENDING (AGRUPAT) --- */}
             <section>
                <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-orange-400"></span>
                    {t("admin.vacations.pending")} ({pendingGroups.length})
                </h2>
                
                {pendingGroups.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
                        {t("admin.vacations.empty")}
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {pendingGroups.map((group, idx) => {
                          const user = getUserInfo(group.userId);
                          const userName = user?.name || t("admin.vacations.unknownUser");
                          const userEmail = user?.email || "";
                          const userInitial = userName.charAt(0).toUpperCase() || "?";
                          const isProcessing = group.ids.some(id => processingIds.includes(id));

                          return (
                            <div key={`${group.userId}-${idx}`} className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900">
                                
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                                            {userInitial}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-zinc-900 dark:text-white">
                                                {userName}
                                            </div>
                                            {userEmail && (
                                                <div className="text-xs text-zinc-400">{userEmail}</div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="mt-3 flex items-center gap-4 text-sm">
                                        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                                            <span>📅</span>
                                            {formatDateRange(group.startDate, group.endDate)}
                                        </div>
                                        {group.daysCount > 1 && (
                                            <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full dark:bg-orange-900/30 dark:text-orange-400">
                                                {group.daysCount} {t("vacations.days")}
                                            </span>
                                        )}
                                        {group.reason && (
                                            <div className="text-zinc-500 italic">"{group.reason}"</div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleBulkResolve(group.ids, 'approved')}
                                        disabled={isProcessing}
                                        className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        {t("admin.vacations.approve")}
                                    </button>
                                    <button 
                                        onClick={() => handleBulkResolve(group.ids, 'rejected')}
                                        disabled={isProcessing}
                                        className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors dark:bg-transparent dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        {t("admin.vacations.reject")}
                                    </button>
                                </div>
                            </div>
                          );
                        })}
                    </div>
                )}
             </section>

             {/* --- APPROVED VACATIONS (AGRUPAT) --- */}
             {approvedGroups.length > 0 && (
               <section>
                 <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                   <span className="h-2 w-2 rounded-full bg-green-400"></span>
                   {t("admin.vacations.approved")}
                 </h2>
                 <div className="rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 overflow-hidden">
                   {approvedGroups.map((group, idx) => {
                     const user = getUserInfo(group.userId);
                     const userName = user?.name || t("admin.vacations.unknownUser");
                     
                     return (
                       <div key={`${group.userId}-${idx}`} className={`flex items-center justify-between p-4 ${idx !== approvedGroups.length - 1 ? 'border-b border-zinc-200 dark:border-zinc-800' : ''}`}>
                         <div className="flex items-center gap-3">
                           <div className="h-2 w-2 rounded-full bg-green-500"></div>
                           <div>
                             <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                               {userName}
                             </div>
                             <div className="text-xs text-zinc-500 flex gap-2">
                               <span>{formatDateRange(group.startDate, group.endDate)}</span>
                               {group.daysCount > 1 && <span className="font-semibold">({group.daysCount}d)</span>}
                               {group.reason && <span className="italic border-l border-zinc-300 pl-2">"{group.reason}"</span>}
                             </div>
                           </div>
                         </div>
                         <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                           {t("admin.vacations.status.approved")}
                         </span>
                       </div>
                     );
                   })}
                 </div>
               </section>
             )}

             {/* --- REJECTED (AGRUPAT) --- */}
             {rejectedGroups.length > 0 && (
                 <section>
                    <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500">{t("admin.vacations.history")}</h2>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 overflow-hidden">
                        {rejectedGroups.map((group, idx) => {
                          const user = getUserInfo(group.userId);
                          const userName = user?.name || t("admin.vacations.unknownUser");
                          
                          return (
                            <div key={`${group.userId}-${idx}`} className={`flex items-center justify-between p-4 ${idx !== rejectedGroups.length - 1 ? 'border-b border-zinc-200 dark:border-zinc-800' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                    <div>
                                        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                            {userName}
                                        </div>
                                        <div className="text-xs text-zinc-500 flex gap-2">
                                            <span>{formatDateRange(group.startDate, group.endDate)}</span>
                                            {group.daysCount > 1 && <span className="font-semibold">({group.daysCount}d)</span>}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                        {t("admin.vacations.status.rejected")}
                                    </span>
                                </div>
                            </div>
                          );
                        })}
                    </div>
                 </section>
             )}

             {/* --- OBLIGATORY DAYS INFO --- */}
             {obligatoryDays.length > 0 && (
               <section>
                 <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                   <span className="h-2 w-2 rounded-full bg-blue-400"></span>
                   {t("calendar.obligatoryVacation")} ({obligatoryDays.length})
                 </h2>
                 <div className="rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 overflow-hidden">
                   <div className="p-4">
                     <div className="flex flex-wrap gap-2">
                       {obligatoryDays.slice(0, 10).map((date, index) => (
                         <div key={index} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                           <span>🏖️</span>
                           {new Date(date).toLocaleDateString()}
                         </div>
                       ))}
                       {obligatoryDays.length > 10 && (
                         <div className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                           +{obligatoryDays.length - 10} {t("common.more")}
                         </div>
                       )}
                     </div>
                   </div>
                 </div>
               </section>
             )}

           </div>
        )}
      </div>
    </div>
  );
}