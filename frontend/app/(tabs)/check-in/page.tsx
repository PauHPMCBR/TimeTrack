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

export default function CheckInPage() {
    const { t, lang } = useI18n();
    const searchParams = useSearchParams();

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReason, setSelectedReason] = useState('work');
    const [notes, setNotes] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [workSessionReasons, setWorkSessionReasons] = useState<
        WorksessionReason[]
    >([]);

    const [now, setNow] = useState(() => Date.now());

    // Automatic timetable config (list of check-in/check-out intervals).
    const [autoTimetable, setAutoTimetable] = useState<
        { checkIn: string; checkOut: string }[]
    >([
        { checkIn: DEFAULT_CHECK_IN_TIME, checkOut: DEFAULT_CHECK_OUT_TIME },
    ]);
    const [autoSaving, setAutoSaving] = useState(false);
    const [autoApplying, setAutoApplying] = useState(false);
    const [autoMessage, setAutoMessage] = useState<string | null>(null);
    const [autoError, setAutoError] = useState<string | null>(null);
    const [showAutoConfirm, setShowAutoConfirm] = useState(false);
    const [applyDate, setApplyDate] = useState<string | null>(null);

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
            setApplyDate(
                d && DATE_KEY_REGEX.test(d)
                    ? d
                    : toLocalDateKey(new Date())
            );
            setShowAutoConfirm(true);
            // Drop the flag so a refresh doesn't re-open the dialog.
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [currentUser, loading, searchParams]);

    const updateTimetableEntry = (
        index: number,
        field: 'checkIn' | 'checkOut',
        value: string
    ) => {
        setAutoTimetable((prev) =>
            prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
        );
    };

    const addTimetableInterval = () => {
        setAutoTimetable((prev) => [
            ...prev,
            {
                checkIn: DEFAULT_CHECK_IN_TIME,
                checkOut: DEFAULT_CHECK_OUT_TIME,
            },
        ]);
    };

    const removeTimetableInterval = (index: number) => {
        setAutoTimetable((prev) =>
            prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
        );
    };

    const timetableText = autoTimetable
        .map((e) => `${e.checkIn} – ${e.checkOut}`)
        .join(', ');

    const saveAutoSchedule = async () => {
        if (!currentUser) return;
        setAutoSaving(true);
        setAutoMessage(null);
        setAutoError(null);
        const res = await apiClient.updateMyProfile({ autoTimetable });
        if (res.data) {
            setCurrentUser((prev) =>
                prev ? { ...prev, autoTimetable } : prev
            );
            setAutoMessage(t('checkin.autoSaved'));
        } else {
            setAutoError(t('checkin.autoSaveFailed'));
        }
        setAutoSaving(false);
    };

    const applyAutoSchedule = async () => {
        if (!applyDate || !currentUser) return;
        setAutoApplying(true);
        setAutoMessage(null);
        setAutoError(null);
        const res = await apiClient.applyAutoSchedule({ date: applyDate });
        if (res.data) {
            setShowAutoConfirm(false);
            setAutoMessage(t('checkin.autoApplied'));
            await refreshSessions(currentUser);
        } else {
            setAutoError(t('checkin.autoApplyFailed'));
        }
        setAutoApplying(false);
    };

    const handleCheckInOut = async () => {
        if (!currentUser) return;
        setIsChecking(true);
        try {
            const request: WorkSessionRequest = {
                type: activeSession ? CHECK_OUT : CHECK_IN,
                reason: selectedReason,
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
                                    onClick={() =>
                                        setSelectedReason(reason.reasonId)
                                    }
                                    className={`p-3 rounded-lg border text-sm text-center transition-colors ${
                                        selectedReason === reason.reasonId
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                                            : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                                    }`}
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

            <Card className="p-5">
                <h2 className="text-lg font-semibold">{t('checkin.autoTitle')}</h2>
                <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                    {t('checkin.autoSubtitle')}
                </p>

                <div className="space-y-3">
                    {autoTimetable.map((entry, index) => (
                        <div
                            key={index}
                            className="flex items-end gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                        >
                            <div className="flex-1">
                                <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                    {t('checkin.autoCheckIn')}
                                </label>
                                <input
                                    type="time"
                                    value={entry.checkIn}
                                    onChange={(e) =>
                                        updateTimetableEntry(
                                            index,
                                            'checkIn',
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 transition-colors"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                    {t('checkin.autoCheckOut')}
                                </label>
                                <input
                                    type="time"
                                    value={entry.checkOut}
                                    onChange={(e) =>
                                        updateTimetableEntry(
                                            index,
                                            'checkOut',
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 transition-colors"
                                />
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={autoTimetable.length <= 1}
                                onClick={() => removeTimetableInterval(index)}
                            >
                                {t('checkin.autoRemoveInterval')}
                            </Button>
                        </div>
                    ))}
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={addTimetableInterval}
                    >
                        {t('checkin.autoAddInterval')}
                    </Button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                        variant="secondary"
                        disabled={autoSaving}
                        onClick={saveAutoSchedule}
                    >
                        {t('checkin.autoSave')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            setApplyDate(toLocalDateKey(new Date()));
                            setShowAutoConfirm(true);
                        }}
                    >
                        {t('checkin.autoApply')}
                    </Button>
                </div>

                {autoMessage && (
                    <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                        {autoMessage}
                    </div>
                )}
                {autoError && (
                    <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {autoError}
                    </div>
                )}
            </Card>

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
                                const sessionReason = workSessionReasons.find(
                                    (r) =>
                                        r.type === session.type &&
                                        r.reasonId === session.reason
                                );

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
                                                {session.reason &&
                                                    sessionReason && (
                                                        <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                                            {getReasonText(
                                                                sessionReason
                                                            )}
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

            {showAutoConfirm && applyDate && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
                    onClick={() => setShowAutoConfirm(false)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold">
                            {t('checkin.autoApplyConfirmTitle')}
                        </h3>
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                            {t('checkin.autoApplyConfirmBody', {
                                date: applyDate,
                                timetable: timetableText,
                            })}
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => setShowAutoConfirm(false)}
                            >
                                {t('checkin.autoApplyConfirmCancel')}
                            </Button>
                            <Button
                                variant="primary"
                                disabled={autoApplying}
                                onClick={applyAutoSchedule}
                            >
                                {t('checkin.autoApplyConfirmConfirm')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
