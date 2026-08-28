'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { WorkSessionRequest } from '@/schemas/api';
import { WorkSession, WorksessionReason, User } from '@/types';
import { toLocalDateKey, formatHM } from '@/lib/datetime';
import { computeDayHours } from 'shared/src/lib/work-hours';
import { NOW_REFRESH_INTERVAL_MS } from '@/lib/constants';
import {
    CHECK_IN,
    CHECK_OUT,
    DATE_KEY_REGEX,
    MS_PER_HOUR,
} from 'shared/src/lib/constants';
import {
    DEFAULT_CHECK_IN_TIME,
    DEFAULT_CHECK_OUT_TIME,
} from 'shared/src/lib/defaults';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/Modal';
import AutoTimetableModal from '@/components/autoTimetable/AutoTimetableModal';
import TimetableList from '@/components/autoTimetable/TimetableList';
import { timetableText } from '@/lib/timetable';
import { Zap } from 'lucide-react';

export default function CheckInPage() {
    const { t, lang } = useI18n();
    const searchParams = useSearchParams();

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [workSessionReasons, setWorkSessionReasons] = useState<
        WorksessionReason[]
    >([]);

    const [now, setNow] = useState(() => Date.now());

    // Automatic timetable config (list of check-in/check-out intervals).
    const [autoTimetable, setAutoTimetable] = useState<
        { checkIn: string; checkOut: string }[]
    >([{ checkIn: DEFAULT_CHECK_IN_TIME, checkOut: DEFAULT_CHECK_OUT_TIME }]);
    const [autoModalOpen, setAutoModalOpen] = useState(false);
    const [autoApplyOpen, setAutoApplyOpen] = useState(false);
    const [autoApplyDate, setAutoApplyDate] = useState(() =>
        toLocalDateKey(new Date())
    );
    const [autoApplying, setAutoApplying] = useState(false);
    const [autoMessage, setAutoMessage] = useState<string | null>(null);
    const [autoError, setAutoError] = useState<string | null>(null);

    const refreshSessions = async (user: User) => {
        if (!user) return;
        try {
            const today = new Date();
            const sessionsResponse = await apiClient.getDailyRecords(
                user._id,
                today
            );
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

    const getCurrentReasons = (): WorksessionReason[] => {
        const currentType = activeSession ? CHECK_OUT : CHECK_IN;
        return workSessionReasons.filter(
            (reason) => reason.type === currentType
        );
    };

    const getReasonText = (reason: WorksessionReason) => {
        switch (lang) {
            case 'es':
                return reason.spanishText;
            case 'ca':
                return reason.catalanText;
            default:
                return reason.englishText;
        }
    };

    const todaySessions = useMemo(() => {
        const todayString = toLocalDateKey(new Date());
        return workSessions
            .filter(
                (session) => toLocalDateKey(session.timestamp) === todayString
            )
            .sort(
                (a, b) =>
                    new Date(a.timestamp).getTime() -
                    new Date(b.timestamp).getTime()
            );
    }, [workSessions]);

    const activeSession = useMemo(() => {
        let lastCheckIn: WorkSession | null = null;

        for (const session of todaySessions) {
            if (session.type === CHECK_IN) {
                lastCheckIn = session;
            } else if (session.type === CHECK_OUT && lastCheckIn) {
                lastCheckIn = null;
            }
        }
        return lastCheckIn;
    }, [todaySessions]);

    const isActiveSession = Boolean(activeSession);
    useEffect(() => {
        if (!isActiveSession) return;
        setNow(Date.now());
        const interval = setInterval(
            () => setNow(Date.now()),
            NOW_REFRESH_INTERVAL_MS
        );
        return () => clearInterval(interval);
    }, [isActiveSession]);

    const todaySummary = useMemo(() => {
        const totalHours = computeDayHours(todaySessions, {
            countOpenUntil: new Date(now),
            round: false,
        }).totalHours;

        return {
            totalHours,
            totalMs: Math.round(totalHours * MS_PER_HOUR),
            sessions: todaySessions,
        };
    }, [todaySessions, now]);

    const currentElapsed = useMemo(() => {
        if (!activeSession) return null;
        const ms = now - new Date(activeSession.timestamp).getTime();
        return formatHM(ms, t);
    }, [activeSession, t, now]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const user = await apiClient.getCurrentUser();
                if (user) {
                    setCurrentUser(user);
                    await Promise.all([
                        refreshSessions(user),
                        fetchWorkSessionReasons(),
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

    // Prefill the automatic timetable from the user's stored config and, when
    // the user arrives via the reminder email (?applyAuto=1&date=...), open the
    // same confirmation dialog so the fix is one or two clicks.
    useEffect(() => {
        if (!currentUser || loading) return;
        setAutoTimetable(
            currentUser.autoTimetable && currentUser.autoTimetable.length > 0
                ? currentUser.autoTimetable
                : [
                      {
                          checkIn: DEFAULT_CHECK_IN_TIME,
                          checkOut: DEFAULT_CHECK_OUT_TIME,
                      },
                  ]
        );

        if (searchParams.get('applyAuto') === '1') {
            const d = searchParams.get('date');
            setAutoApplyDate(
                d && DATE_KEY_REGEX.test(d) ? d : toLocalDateKey(new Date())
            );
            setAutoApplyOpen(true);
            // Drop the flag so a refresh doesn't re-open the dialog.
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [currentUser, loading, searchParams]);

    const saveAutoSchedule = async (
        next: { checkIn: string; checkOut: string }[]
    ) => {
        if (!currentUser) return false;
        const res = await apiClient.updateMyProfile({ autoTimetable: next });
        if (res.data) {
            setAutoTimetable(next);
            setCurrentUser((prev) =>
                prev ? { ...prev, autoTimetable: next } : prev
            );
            return true;
        }
        return false;
    };

    const applyAutoSchedule = async () => {
        if (!currentUser) return;
        if (autoApplyDate > toLocalDateKey(new Date())) {
            setAutoError(t('checkin.autoFutureDate'));
            return;
        }
        setAutoApplying(true);
        setAutoError(null);
        const res = await apiClient.applyAutoSchedule({ date: autoApplyDate });
        setAutoApplying(false);
        if (res.data) {
            setAutoApplyOpen(false);
            setAutoMessage(t('checkin.autoApplied'));
            await refreshSessions(currentUser);
        } else {
            setAutoError(t('checkin.autoApplyFailed'));
        }
    };

    const handleCheckInOut = async () => {
        if (!currentUser) return;
        setIsChecking(true);
        try {
            const request: WorkSessionRequest = {
                type: activeSession ? CHECK_OUT : CHECK_IN,
                notes: notes || undefined,
            };

            const response = await apiClient.addWorkRecordTimestamp(request);

            if (response.data) {
                await refreshSessions(currentUser);
                setNotes('');
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
        return (
            <div className="p-5 animate-pulse text-zinc-500">
                {t('common.loading')}
            </div>
        );
    }

    return (
        <section className="space-y-6">
            <Card className="p-5">
                <h1 className="text-lg font-semibold">
                    {t('checkin.todaySummary')}
                </h1>
                <div className="mt-3 grid grid-cols-2 gap-4">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-indigo-600">
                            {formatHM(todaySummary.totalMs, t)}
                        </div>
                        <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
                            {t('checkin.totalHours')}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">
                            {
                                todaySummary.sessions.filter(
                                    (s) => s.type === CHECK_IN
                                ).length
                            }
                        </div>
                        <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
                            {t('checkin.sessions')}
                        </div>
                    </div>
                </div>
            </Card>

            <Card className="p-5">
                <h2 className="text-lg font-semibold">{t('checkin.title')}</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                    {activeSession
                        ? `${t('checkin.inProgress')}: ${currentElapsed}`
                        : t('checkin.notIn')}
                </p>

                <div className="mt-4">
                    <button
                        onClick={handleCheckInOut}
                        disabled={isChecking}
                        className={`w-full rounded-xl px-4 py-3 text-white font-semibold text-lg ${
                            activeSession
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-green-600 hover:bg-green-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                    >
                        {activeSession
                            ? t('checkin.btnOut')
                            : t('checkin.btnIn')}
                    </button>
                </div>

                {currentReasons.length > 0 && (
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                            {t('checkin.reasonLabel')}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {currentReasons.map((reason) => (
                                <button
                                    key={reason._id}
                                    type="button"
                                    onClick={() => setNotes(getReasonText(reason))}
                                    className="p-3 rounded-lg border text-sm text-center transition-colors border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                >
                                    {getReasonText(reason)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-4">
                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                        {t('checkin.notesLabel')} {t('common.optional')}
                    </label>
                    <textarea
                        rows={3}
                        className="w-full rounded-lg border border-zinc-300 bg-transparent p-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 transition-colors"
                        placeholder={t('checkin.notesPlaceholder')}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>
            </Card>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
                <Button
                    variant="primary"
                    onClick={() => {
                        setAutoError(null);
                        setAutoMessage(null);
                        setAutoApplyOpen(true);
                    }}
                    className="relative w-full flex-none overflow-hidden rounded-2xl px-5 py-4 sm:w-48 sm:px-6 sm:py-5"
                >
                    <Zap
                        size={100}
                        strokeWidth={1.25}
                        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20"
                    />
                    <span className="relative text-xl font-semibold leading-tight">
                        {t('checkin.autoApply')}
                    </span>
                </Button>

                <Card className="flex-1 p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                            <h2 className="text-lg font-semibold">
                                {t('checkin.autoTitle')}
                            </h2>
                            <TimetableList timetable={autoTimetable} />
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setAutoModalOpen(true)}
                        >
                            {t('checkin.autoConfigure')}
                        </Button>
                    </div>
                </Card>
            </div>

            {autoMessage && (
                <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    {autoMessage}
                </div>
            )}
            {autoError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {autoError}
                </div>
            )}

            {todaySummary.sessions.length > 0 && (
                <Card className="p-5">
                    <h3 className="text-lg font-semibold mb-3">
                        {t('checkin.todaySessions')}
                    </h3>
                    <div className="space-y-3">
                        {todaySummary.sessions
                            .sort(
                                (a, b) =>
                                    new Date(b.timestamp).getTime() -
                                    new Date(a.timestamp).getTime()
                            )
                            .map((session, index) => {
                                return (
                                    <div
                                        key={session._id || index}
                                        className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div
                                                className={`w-3 h-3 rounded-full ${
                                                    session.type === CHECK_IN
                                                        ? 'bg-green-500'
                                                        : 'bg-red-500'
                                                }`}
                                            ></div>
                                            <div>
                                                <div className="font-medium">
                                                    {session.type === CHECK_IN
                                                        ? t('checkin.checkIn')
                                                        : t('checkin.checkOut')}
                                                </div>
                                                {session.notes && (
                                                    <div className="text-sm text-zinc-500 mt-1">
                                                        {session.notes}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-sm text-zinc-500">
                                            {new Date(
                                                session.timestamp
                                            ).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </Card>
            )}

            <AutoTimetableModal
                open={autoModalOpen}
                timetable={autoTimetable}
                onClose={() => setAutoModalOpen(false)}
                onSave={saveAutoSchedule}
            />

            <Modal
                open={autoApplyOpen}
                title={t('checkin.autoApplyConfirmTitle')}
                onClose={() => setAutoApplyOpen(false)}
            >
                <div className="space-y-4">
                    <label className="block text-sm text-zinc-700 dark:text-zinc-300">
                        {t('checkin.autoApplyDate')}
                        <input
                            type="date"
                            value={autoApplyDate}
                            max={toLocalDateKey(new Date())}
                            onChange={(e) => setAutoApplyDate(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 transition-colors"
                        />
                    </label>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {t('checkin.autoApplyConfirmBody', {
                            date: autoApplyDate,
                            timetable: timetableText(autoTimetable),
                        })}
                    </p>

                    {autoError && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                            {autoError}
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setAutoApplyOpen(false)}
                        >
                            {t('checkin.autoApplyConfirmCancel')}
                        </Button>
                        <Button
                            variant="primary"
                            disabled={autoApplying}
                            onClick={applyAutoSchedule}
                        >
                            {autoApplying
                                ? t('common.saving')
                                : t('checkin.autoApplyConfirmConfirm')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </section>
    );
}
