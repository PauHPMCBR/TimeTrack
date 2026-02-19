"use client";

import { useMemo, useState, useEffect } from "react";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";
import { WorkSessionRequest } from "@/schemas/api";
import { WorkSession, WorksessionReason } from "@/types";

function formatHM(ms: number, t: (k: string) => string) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const labelH = t ? t("time.h") : "h";
  const labelM = t ? t("time.m") : "m";
  return `${h}${labelH} ${m}${labelM}`; 
}

export default function CheckInPage() {
  const { t, lang } = useI18n();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReason, setSelectedReason] = useState("work");
  const [notes, setNotes] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [workSessionReasons, setWorkSessionReasons] = useState<WorksessionReason[]>([]);

  const [showNoteInput, setShowNoteInput] = useState(false); 
  const [noteSaved, setNoteSaved] = useState(false);
  const [timeFmt, setTimeFmt] = useState<"24" | "12">("24");

  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const refreshSessions = async (user: any) => {
    if (!user) return;
    try {
      const today = new Date();
      const sessionsResponse = await apiClient.getDailyRecords(user._id, today);
      if (sessionsResponse.data) {
        setWorkSessions(sessionsResponse.data.workSessions || []);
      }
    } catch (error) {
      console.error('Failed to refresh sessions:', error);
    }
  };

  const fetchWorkSessionReasons = async () => {
    try {
      const reasonsResponse = await apiClient.getWorkSessionReasons();
      if (reasonsResponse.data) {
        setWorkSessionReasons(reasonsResponse.data.reasons || []);
      }
    } catch (error) {
      console.error('Failed to fetch work session reasons:', error);
    }
  };

  const formatTimeOfDay = (dateStr: string | Date) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: timeFmt === "12" 
    });
  };

  const getCurrentReasons = (): WorksessionReason[] => {
    const currentType = activeSession ? 'check_out' : 'check_in';
    return workSessionReasons.filter(reason => reason.type === currentType);
  };

  const getReasonText = (reason: WorksessionReason) => {
    switch (lang) {
      case 'es': return reason.spanishText;
      case 'ca': return reason.catalanText;
      default: return reason.englishText;
    }
  };

  const activeSession = useMemo(() => {
    const todayString = getTodayString();
    const todaySessions = workSessions
      .filter(session => new Date(session.timestamp).toISOString().split('T')[0] === todayString)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let lastCheckIn: WorkSession | null = null;
    
    for (const session of todaySessions) {
      if (session.type === 'check_in') {
        lastCheckIn = session;
      } else if (session.type === 'check_out' && lastCheckIn) {
        lastCheckIn = null;
      }
    }
    return lastCheckIn;
  }, [workSessions]);

  const todaySummary = useMemo(() => {
    const todayString = getTodayString();
    const todaySessions = workSessions.filter(session => {
      const sessionDate = new Date(session.timestamp).toISOString().split('T')[0];
      return sessionDate === todayString;
    }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let totalMs = 0;
    let checkInTime: Date | null = null;

    todaySessions.forEach(session => {
      if (session.type === 'check_in') {
        checkInTime = new Date(session.timestamp);
      } else if (session.type === 'check_out' && checkInTime) {
        totalMs += new Date(session.timestamp).getTime() - checkInTime.getTime();
        checkInTime = null;
      }
    });

    if (checkInTime !== null) {
      totalMs += Date.now() - (checkInTime as Date).getTime();
    }

    return {
      totalHours: totalMs / 3_600_000,
      totalMs: totalMs,
      sessions: todaySessions
    };
  }, [workSessions]);

  const currentElapsed = useMemo(() => {
    if (!activeSession) return null;
    const ms = Date.now() - new Date(activeSession.timestamp).getTime();
    return formatHM(ms, t);
  }, [activeSession, t]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const savedFmt = (localStorage.getItem("time_format") as "24" | "12") || "24";
        setTimeFmt(savedFmt);

        const user = await apiClient.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          await Promise.all([
            refreshSessions(user),
            fetchWorkSessionReasons()
          ]);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCheckInOut = async () => {
    if (!currentUser) return;
    setIsChecking(true);
    try {
      const request: WorkSessionRequest = {
        type: activeSession ? 'check_out' : 'check_in',
        reason: selectedReason,
        notes: notes || undefined
      };

      const response = await apiClient.addWorkRecordTimestamp(request);
      
      if (response.data) {
        await refreshSessions(currentUser);
        setNotes("");
      } else {
        console.error('Failed to record time:', response.error);
      }
    } catch (error) {
      console.error('Error recording time:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const currentReasons = getCurrentReasons();

  if (loading) {
        return <div className="p-5 animate-pulse text-zinc-500">{t("common.loading")}</div>;
  }

  return (
    <section className="space-y-6">
      {/* Today's Summary Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold">{t("checkin.todaySummary")}</h1>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-indigo-600">
              {formatHM(todaySummary.totalMs, t)}
            </div>
            <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
              {t("checkin.totalHours")}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {todaySummary.sessions.filter(s => s.type === 'check_in').length}
            </div>
            <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
              {t("checkin.sessions")}
            </div>
          </div>
        </div>
      </div>

      {/* Main Check In/Out Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">{t("checkin.title")}</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          {activeSession 
            ? `${t("checkin.inProgress")}: ${currentElapsed}`
            : t("checkin.notIn")
          }
        </p>

        {/* Main Check In/Out Button */}
        <div className="mt-4">
          <button
            onClick={handleCheckInOut}
            disabled={isChecking}
            className={`w-full rounded-xl px-4 py-3 text-white font-semibold text-lg ${
              activeSession 
                ? "bg-red-500 hover:bg-red-600" 
                : "bg-green-600 hover:bg-green-700"
            } disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          >
            {activeSession ? t("checkin.btnOut") : t("checkin.btnIn")}
          </button>
        </div>

        {/* Reason Selection - Always Visible */}
        {currentReasons.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              {t("checkin.reasonLabel")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {currentReasons.map((reason) => (
                <button
                  key={reason._id}
                  type="button"
                  onClick={() => setSelectedReason(reason.reasonId)}
                  className={`p-3 rounded-lg border text-sm text-center transition-colors ${
                    selectedReason === reason.reasonId
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {getReasonText(reason)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes Section - Always Visible */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
            {t("checkin.notesLabel")} {t("common.optional")}
          </label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-zinc-300 bg-transparent p-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 transition-colors"
            placeholder={t("checkin.notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {/* Today's Sessions */}
      {todaySummary.sessions.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-lg font-semibold mb-3">{t("checkin.todaySessions")}</h3>
          <div className="space-y-3">
            {todaySummary.sessions
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map((session, index) => {
                const sessionReason = workSessionReasons.find(
                  r => r.type === session.type && r.reasonId === session.reason
                );
                
                return (
                  <div key={session._id || index} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        session.type === 'check_in' ? 'bg-green-500' : 'bg-red-400'
                      }`}></div>
                      <div>
                        <div className="font-medium">
                          {session.type === 'check_in' ? t("checkin.checkIn") : t("checkin.checkOut")}
                        </div>
                        {session.reason && sessionReason && (
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">
                            {getReasonText(sessionReason)}
                          </div>
                        )}
                        {session.notes && (
                          <div className="text-sm text-zinc-500 mt-1">
                            {session.notes}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-zinc-500">
                      {new Date(session.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </section>
  );
}