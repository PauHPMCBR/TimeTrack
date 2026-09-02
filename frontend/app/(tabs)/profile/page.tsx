'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { WorkSession, User } from '@/types';
import { formatHM, toLocalDateKey } from '@/lib/datetime';
import {
    applyTheme,
    DEFAULT_THEME_FLAVOR,
    ThemeFlavor,
} from '@/lib/theme';
import { THEME_KEY } from '@/lib/storage';
import { TimetableEntry } from '@/lib/timetable';
import AutoTimetableModal from '@/components/autoTimetable/AutoTimetableModal';
import TimetableList from '@/components/autoTimetable/TimetableList';
import { NOW_REFRESH_INTERVAL_MS } from '@/lib/constants';
import {
    AVATAR_MAX_BYTES,
    CHECK_IN,
    CHECK_OUT,
    MS_PER_HOUR,
} from 'shared/src/lib/constants';
import { usePathname, useRouter } from 'next/navigation';
import { Users, ChevronRight, Camera, LogOut } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Avatar from '@/components/Avatar';
import PasswordField from '@/components/ui/PasswordField';

const AVATAR_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/tiff',
    'image/bmp',
];

const FLAVORS = [
    { id: 'latte', base: '#eff1f5', labelKey: 'profile.theme.light' },
    { id: 'frappe', base: '#303446', labelKey: 'profile.theme.dark' },
] as const;

export default function ProfilePage() {
    const { t } = useI18n();
    const pathname = usePathname();
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [sessions, setSessions] = useState<WorkSession[]>([]);
    const [loading, setLoading] = useState(true);

    const [theme, setTheme] = useState<ThemeFlavor>(DEFAULT_THEME_FLAVOR);
    const [now, setNow] = useState(() => Date.now());

    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [pwdCurrent, setPwdCurrent] = useState('');
    const [pwdNew, setPwdNew] = useState('');
    const [pwdConfirm, setPwdConfirm] = useState('');
    const [pwdSaving, setPwdSaving] = useState(false);
    const [pwdError, setPwdError] = useState<string | null>(null);
    const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

    const [autoModalOpen, setAutoModalOpen] = useState(false);

    const readFileAsDataURL = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        setUploadSuccess(false);
        setUploadError(null);

        if (file.type && !AVATAR_TYPES.includes(file.type)) {
            setUploadError(t('profile.avatar.invalidFormat'));
            return;
        }
        if (file.size > AVATAR_MAX_BYTES) {
            setUploadError(t('profile.avatar.tooLarge'));
            return;
        }

        setUploading(true);
        try {
            const dataUrl = await readFileAsDataURL(file);
            const res = await apiClient.uploadAvatar(dataUrl);
            if (res.error) {
                setUploadError(t('profile.avatar.uploadError'));
            } else {
                setUser((prev) =>
                    prev ? { ...prev, avatar: res.data!.avatar } : prev
                );
                setUploadSuccess(true);
            }
        } catch {
            setUploadError(t('profile.avatar.uploadError'));
        } finally {
            setUploading(false);
        }
    };

    // Sorted copy computed once — reused by isCheckedIn / workedHoursToday /
    // checkedInDuration instead of re-sorting on every 30s tick.
    const sortedSessions = useMemo(() => {
        return [...sessions].sort(
            (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
        );
    }, [sessions]);

    const isCheckedIn = useMemo(() => {
        if (sessions.length === 0) return false;
        return sortedSessions[sortedSessions.length - 1].type === CHECK_IN;
    }, [sessions, sortedSessions]);

    useEffect(() => {
        if (!isCheckedIn) return;
        setNow(Date.now());
        const interval = setInterval(
            () => setNow(Date.now()),
            NOW_REFRESH_INTERVAL_MS
        );
        return () => clearInterval(interval);
    }, [isCheckedIn]);

    useEffect(() => {
        let cancelled = false;
        const loadData = async () => {
            setLoading(true);
            setUser(null);
            setSessions([]);

            try {
                const currentUser = await apiClient.getCurrentUser();

                if (currentUser) {
                    setUser(currentUser);

                    const today = new Date();
                    const res = await apiClient.getDailyRecords(
                        currentUser._id,
                        today
                    );
                    if (cancelled) return;
                    if (res.data && res.data.workSessions) {
                        setSessions(res.data.workSessions);
                    }
                }
            } catch (error) {
                console.error('Error carregant perfil:', error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadData();
        return () => {
            cancelled = true;
        };
    }, [pathname]);

    useEffect(() => {
        const saved = localStorage.getItem(THEME_KEY) || DEFAULT_THEME_FLAVOR;
        // Only Latte (light) and Frappé (dark) are exposed now; map any legacy
        // value (macchiato/mocha/"dark"/...) to the dark flavor.
        const savedTheme: ThemeFlavor =
            saved === DEFAULT_THEME_FLAVOR || saved === 'light'
                ? DEFAULT_THEME_FLAVOR
                : 'frappe';
        setTheme(savedTheme);
        applyTheme(savedTheme);
    }, []);

    const changeTheme = (next: ThemeFlavor) => {
        setTheme(next);
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
    };

    const saveAutoSchedule = async (next: TimetableEntry[]) => {
        const res = await apiClient.updateMyProfile({ autoTimetable: next });
        if (res.data) {
            setUser((prev) =>
                prev ? { ...prev, autoTimetable: next } : prev
            );
            return true;
        }
        return false;
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwdError(null);
        setPwdSuccess(null);

        if (pwdNew !== pwdConfirm) {
            setPwdError(t('register.error.match'));
            return;
        }

        setPwdSaving(true);
        try {
            const res = await apiClient.updateMyProfile({
                currentPassword: pwdCurrent,
                password: pwdNew,
            });
            if (res.error) {
                if (res.error === 'IncorrectParameter') {
                    const reasons = res.details?.reasons || [];
                    const reasonMsgs = reasons
                        .map((r) =>
                            t(`error.IncorrectParameter.reason.${r}`) !==
                            `error.IncorrectParameter.reason.${r}`
                                ? t(`error.IncorrectParameter.reason.${r}`)
                                : null
                        )
                        .filter(Boolean);
                    setPwdError(
                        reasonMsgs.length > 0
                            ? reasonMsgs.join(', ')
                            : t('error.IncorrectParameter.message')
                    );
                } else {
                    setPwdError(
                        t(`error.${res.error}`) ||
                            res.error ||
                            t('error.PutError')
                    );
                }
            } else {
                setPwdCurrent('');
                setPwdNew('');
                setPwdConfirm('');
                setPwdSuccess(t('profile.password.changed'));
                setTimeout(() => setPwdSuccess(null), 3000);
            }
        } catch (err) {
            console.error(err);
            setPwdError(t('error.PutError'));
        } finally {
            setPwdSaving(false);
        }
    };

    const workedHoursToday = useMemo(() => {
        let totalMs = 0;
        let lastIn: Date | null = null;

        const todaySessions = sortedSessions.filter(
            (s) => toLocalDateKey(s.timestamp) === toLocalDateKey(new Date())
        );

        todaySessions.forEach((s) => {
            if (s.type === CHECK_IN) lastIn = new Date(s.timestamp);
            else if (s.type === CHECK_OUT && lastIn) {
                totalMs += new Date(s.timestamp).getTime() - lastIn.getTime();
                lastIn = null;
            }
        });

        if (lastIn) totalMs += now - (lastIn as Date).getTime();
        return totalMs / MS_PER_HOUR;
    }, [sortedSessions, now]);

    const checkedInDuration = useMemo(() => {
        if (!isCheckedIn || sessions.length === 0) return '';
        const last = sortedSessions[sortedSessions.length - 1];
        const ms = now - new Date(last.timestamp).getTime();
        return formatHM(ms, t);
    }, [isCheckedIn, sortedSessions, t, now]);

    if (loading)
        return (
            <div className="p-10 text-center text-zinc-500 animate-pulse">
                {t('common.loading')}
            </div>
        );
    if (!user)
        return (
            <div className="p-10 text-center text-red-500">
                {t('profile.errorLoading')}
            </div>
        );

    const displayName = user.name || t('profile.fallbackUser');
    const initials = user.email
        ? user.email.trim()[0].toUpperCase()
        : user.name
          ? user.name.trim()[0].toUpperCase()
          : 'U';

    return (
        <section className="space-y-6 pb-20">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <Avatar
                        userId={user._id}
                        version={user.avatar}
                        alt={displayName}
                        fallback={initials}
                        className="h-16 w-16 rounded-full object-cover shadow-lg"
                        fallbackClassName="h-16 w-16 rounded-full bg-indigo-600 text-white shadow-lg"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-zinc-900 text-white shadow transition-transform hover:scale-110 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                        title={t('profile.avatar.change')}
                    >
                        <Camera size={12} />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={AVATAR_TYPES.join(',')}
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>
                <div>
                    <div className="text-lg font-semibold text-zinc-900 dark:text-white">
                        {displayName}
                    </div>
                    <div className="text-sm text-zinc-500">{user.email}</div>
                    <div className="mt-1 inline-block rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                        {user.role || 'Employee'}
                    </div>
                    {(uploading || uploadSuccess || uploadError) && (
                        <div
                            className={`mt-1 text-xs ${
                                uploadError
                                    ? 'text-red-600 dark:text-red-400'
                                    : uploadSuccess
                                      ? 'text-green-600 dark:text-green-400'
                                      : 'text-zinc-500'
                            }`}
                        >
                            {uploading
                                ? t('profile.avatar.uploading')
                                : uploadError || t('profile.avatar.updated')}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Card className="p-4">
                    <div className="text-sm text-zinc-500">
                        {t('profile.hoursToday')}
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                        {formatHM(workedHoursToday * MS_PER_HOUR, t)}
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="text-sm text-zinc-500">
                        {t('profile.status.label')}
                    </div>
                    <div className="mt-1 text-base text-zinc-900 dark:text-zinc-100">
                        {isCheckedIn ? (
                            <span className="inline-flex items-center gap-2 text-green-600 font-medium">
                                <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-sm" />
                                {t('profile.status.checkedInAgo').replace(
                                    '{time}',
                                    checkedInDuration
                                )}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-2 text-zinc-500">
                                <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" />
                                {t('checkin.notIn')}
                            </span>
                        )}
                    </div>
                </Card>
            </div>

            <Link
                href="/groups"
                className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:bg-zinc-50 hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50 dark:hover:border-indigo-700"
            >
                <div className="flex items-center gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                        <Users size={24} />
                    </div>
                    <div>
                        <div className="font-semibold text-zinc-900 dark:text-white text-lg">
                            {t('tabs.groups')}
                        </div>
                        <div className="text-sm text-zinc-500 dark:text-zinc-400">
                            {t('groups.subtitle')}
                        </div>
                    </div>
                </div>

                <ChevronRight className="h-5 w-5 text-zinc-400" />
            </Link>

            <div className="grid gap-4 sm:grid-cols-2">
                <Card className="p-4">
                    <div className="mb-3 text-sm font-medium text-zinc-900 dark:text-white">
                        {t('profile.password.title')}
                    </div>

                    <form
                        onSubmit={handlePasswordChange}
                        className="space-y-3"
                    >
                        <PasswordField
                            placeholder={t('profile.password.current')}
                            autoComplete="current-password"
                            value={pwdCurrent}
                            onChange={(e) => setPwdCurrent(e.target.value)}
                            required
                        />
                        <PasswordField
                            placeholder={t('profile.password.new')}
                            autoComplete="new-password"
                            value={pwdNew}
                            onChange={(e) => setPwdNew(e.target.value)}
                            required
                        />
                        <PasswordField
                            placeholder={t('profile.password.confirm')}
                            autoComplete="new-password"
                            value={pwdConfirm}
                            onChange={(e) => setPwdConfirm(e.target.value)}
                            required
                        />

                        {pwdError && (
                            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                {pwdError}
                            </div>
                        )}

                        {pwdSuccess && (
                            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
                                {pwdSuccess}
                            </div>
                        )}

                        <Button
                            type="submit"
                            variant="secondary"
                            disabled={pwdSaving}
                            className="w-full"
                        >
                            {pwdSaving
                                ? t('common.saving')
                                : t('profile.password.submit')}
                        </Button>
                    </form>
                </Card>

                <Card className="p-4">
                    <div className="mb-3 text-sm font-medium text-zinc-900 dark:text-white">
                        {t('profile.theme.label')}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {FLAVORS.map((flavor) => (
                            <button
                                key={flavor.id}
                                onClick={() => changeTheme(flavor.id)}
                                className={`rounded-lg border p-2 text-center transition-colors ${
                                    theme === flavor.id
                                        ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                                        : 'border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50'
                                }`}
                            >
                                <span
                                    className="mx-auto mb-1 block h-5 w-5 rounded-full border border-black/10"
                                    style={{ backgroundColor: flavor.base }}
                                />
                                <span
                                    className={`text-xs ${theme === flavor.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-600 dark:text-zinc-400'}`}
                                >
                                    {t(flavor.labelKey)}
                                </span>
                            </button>
                        ))}
                    </div>
                </Card>
            </div>

            <Card className="p-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-2">
                        <div className="text-sm font-medium text-zinc-900 dark:text-white">
                            {t('checkin.autoTitle')}
                        </div>
                        <TimetableList timetable={user.autoTimetable || []} />
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setAutoModalOpen(true)}
                    >
                        {t('profile.autoTimetable.edit')}
                    </Button>
                </div>
            </Card>

            <Button
                variant="danger"
                className="w-full"
                onClick={async () => {
                    await apiClient.logoff();
                    router.push('/');
                }}
            >
                <LogOut size={16} />
                {t('profile.signOut')}
            </Button>

            <AutoTimetableModal
                open={autoModalOpen}
                timetable={user.autoTimetable || []}
                onClose={() => setAutoModalOpen(false)}
                onSave={saveAutoSchedule}
            />
        </section>
    );
}
