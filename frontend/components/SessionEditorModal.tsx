'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { useDirty } from '@/lib/useDirty';
import { AdminWorkSessionRow } from '@/types';
import { formatDateKey, localeTag } from '@/lib/datetime';
import { configuredTimezone } from '@/lib/timezone';
import {
    CHECK_IN,
    CHECK_OUT,
    HOUR_MINUTE_KEY_REGEX,
} from 'shared/src/lib/constants';
import { timeToMinutes } from 'shared/src/lib/expected-timetable';
import type { TimeKey } from 'shared/src/lib/time-key';
import {
    DEFAULT_CHECK_IN_TIME,
    DEFAULT_CHECK_OUT_TIME,
} from 'shared/src/lib/defaults';
import type {
    WorkSessionType,
    WorkDayClassification,
} from 'shared/src/schemas/database';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import { LogIn, LogOut, Plus, Trash2, Loader2, Clock } from 'lucide-react';

const DAY_CLASSIFICATIONS: WorkDayClassification[] = [
    'workday',
    'nonWorkingWeekday',
    'electiveVacation',
    'obligatoryVacation',
    'authorizedLeave',
];

const EDITABLE_CLASSIFICATIONS = (
    row: AdminWorkSessionRow
): WorkDayClassification[] =>
    DAY_CLASSIFICATIONS.filter(
        (c) => c !== 'obligatoryVacation' || c === row.dayClassification
    );

type Props = {
    row: AdminWorkSessionRow;
    onClose: () => void;
    onSaved: () => void;
};

type EditableSession = {
    type: WorkSessionType;
    time: TimeKey;
    overtime: boolean;
    notes?: string;
};

function addOneHourToWallTime(hm: TimeKey): TimeKey {
    const [h, m] = hm.split(':').map(Number);
    const total = Math.min((h || 0) * 60 + (m || 0) + 60, 23 * 60 + 59);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}` as TimeKey;
}

function nextExpectedType(sessions: EditableSession[]): WorkSessionType {
    if (sessions.length === 0) return CHECK_IN;
    return sessions[sessions.length - 1].type === CHECK_IN
        ? CHECK_OUT
        : CHECK_IN;
}

function isCoherent(sessions: EditableSession[]): boolean {
    let expected: WorkSessionType = CHECK_IN;
    for (const s of sessions) {
        if (s.type !== expected) return false;
        expected = s.type === CHECK_IN ? CHECK_OUT : CHECK_IN;
    }
    return true;
}

/**
 * Admin editor for a single day+user set of check-in/out timestamps.
 * All edits are kept locally and only persisted when Save is pressed, after
 * validating that the sequence is ordered and alternates check_in/check_out.
 * Reusable anywhere a day's sessions need editing.
 */
export default function SessionEditorModal({
    row,
    onClose,
    onSaved,
}: Props) {
    const { t, lang } = useI18n();
    const locale = localeTag(lang);
    const isAdminPanel = usePathname().startsWith('/admin');

    const [sessions, setSessions] = useState<EditableSession[]>(
        row.sessions.map((s) => ({
            type: s.type,
            time: s.time,
            overtime: s.overtime === true,
            notes: s.notes,
        }))
    );
    const [reason, setReason] = useState('');
    const [classification, setClassification] = useState<WorkDayClassification>(
        row.dayClassification
    );
    const [leaveNotes, setLeaveNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { dirty, markDirty, resetDirty } = useDirty();

    const requestClose = () => {
        if (dirty && !window.confirm(t('common.unsavedChangesConfirm'))) return;
        onClose();
    };

    const lastEditReason =
        row.source === 'userManual' || row.source === 'adminManual'
            ? (row.editReason ??
              [...row.sessions].reverse().find((s) => s.notes)?.notes)
            : undefined;

    const expected = nextExpectedType(sessions);

    const validate = (): string | null => {
        for (const session of sessions) {
            if (!HOUR_MINUTE_KEY_REGEX.test(session.time)) {
                return t('error.IncorrectParameter.reason.InvalidTimestamp');
            }
        }
        for (let i = 1; i < sessions.length; i++) {
            if (
                timeToMinutes(sessions[i].time) <=
                timeToMinutes(sessions[i - 1].time)
            ) {
                return t('error.IncorrectParameter.reason.NotInOrder');
            }
        }
        if (!isCoherent(sessions)) {
            return t('error.IncorrectParameter.reason.NotInOrder');
        }
        return null;
    };

    const handleChangeTime = (idx: number, value: string) => {
        setSessions((prev) =>
            prev.map((s, i) =>
                i === idx ? { ...s, time: value as TimeKey } : s
            )
        );
        markDirty();
    };

    const handleAdd = () => {
        const last = sessions[sessions.length - 1];
        const nextTime = last
            ? addOneHourToWallTime(last.time)
            : expected === CHECK_IN
              ? (DEFAULT_CHECK_IN_TIME as TimeKey)
              : (DEFAULT_CHECK_OUT_TIME as TimeKey);

        const next = {
            type: expected,
            time: nextTime,
            overtime: false,
        };
        setSessions((prev) => [...prev, next]);
        markDirty();
    };

    const handleDelete = (idx: number) => {
        setSessions((prev) => prev.filter((_, i) => i !== idx));
        markDirty();
    };

    const handleToggleOvertime = (idx: number) => {
        setSessions((prev) =>
            prev.map((s, i) =>
                i === idx ? { ...s, overtime: !s.overtime } : s
            )
        );
        markDirty();
    };

    const handleSave = async () => {
        const validation = validate();
        if (validation) {
            setError(validation);
            return;
        }

        setSaving(true);
        setError(null);
        const payload = sessions.map((s) => ({
            type: s.type,
            time: s.time,
            overtime: s.overtime,
            ...(s.notes !== undefined ? { notes: s.notes } : {}),
        }));
        const res = isAdminPanel
            ? await apiClient.replaceDayWorkSessions(
                  row.userId,
                  row.date,
                  payload,
                  reason.trim()
              )
            : await apiClient.replaceMyDayWorkSessions(
                  row.date,
                  payload,
                  reason.trim()
              );
        setSaving(false);

        if (res.error) {
            if (
                res.error === 'IncorrectParameter' &&
                Array.isArray(res.details?.reasons) &&
                res.details.reasons.length > 0
            ) {
                const key = `error.IncorrectParameter.reason.${res.details.reasons[0]}`;
                const text = t(key);
                setError(
                    text !== key ? text : t('error.IncorrectParameter.message')
                );
            } else {
                setError(
                    t(`error.${res.error}`) === `error.${res.error}`
                        ? t('error.PutError')
                        : t(`error.${res.error}`)
                );
            }
            return;
        }

        if (isAdminPanel && classification !== row.dayClassification) {
            if (classification === 'authorizedLeave') {
                const leaveRes = await apiClient.createAuthorizedLeave({
                    userId: row.userId,
                    startDate: row.date,
                    endDate: row.date,
                    notes: leaveNotes.trim() || undefined,
                });
                if (leaveRes.error) {
                    setError(
                        t(`error.${leaveRes.error}`) ===
                            `error.${leaveRes.error}`
                            ? t('error.PutError')
                            : t(`error.${leaveRes.error}`)
                    );
                    setSaving(false);
                    return;
                }
            } else {
                const recordRes = await apiClient.updateWorkDayRecord(
                    row.userId,
                    row.date,
                    classification,
                    reason.trim()
                );
                if (recordRes.error) {
                    setError(
                        t(`error.${recordRes.error}`) ===
                            `error.${recordRes.error}`
                            ? t('error.PutError')
                            : t(`error.${recordRes.error}`)
                    );
                    setSaving(false);
                    return;
                }
            }
        }

        onSaved();
        resetDirty();
        onClose();
    };

    const dateLabel = formatDateKey(row.date, locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    return (
        <Modal
            open={typeof document !== 'undefined'}
            title={t('admin.sessionEditor.title')}
            subtitle={`${row.userName} · ${dateLabel}`}
            onClose={requestClose}
            footer={
                <div className="flex justify-end gap-2">
                    <Button
                        onClick={onClose}
                        disabled={saving}
                        variant="secondary"
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        variant="primary"
                    >
                        {saving ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : null}
                        {t('common.save')}
                    </Button>
                </div>
            }
        >
            {error && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

            {row.anomalies.length > 0 && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    <span className="font-medium">
                        {t('admin.sessionEditor.anomalies')}:
                    </span>{' '}
                    {row.anomalies
                        .map((a) => t(`monthlyApprovals.anomaly.${a}`))
                        .join(', ')}
                </div>
            )}

            {lastEditReason && (
                <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    <span className="font-medium">
                        {t('admin.sessionEditor.lastEdit')}
                    </span>
                    {row.createdAt
                        ? ` · ${new Date(row.createdAt).toLocaleString(locale, {
                              timeZone: configuredTimezone(),
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                          })}`
                        : null}
                    : {lastEditReason}
                </div>
            )}

            <div className="space-y-2">
                {sessions.length === 0 && (
                    <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
                        {t('admin.sessionEditor.noSessions')}
                    </div>
                )}

                {sessions.map((session, idx) => {
                    const removable = isCoherent(
                        sessions.filter((_, i) => i !== idx)
                    );
                    return (
                        <div
                            key={idx}
                            className="rounded-xl border border-zinc-200 p-2 dark:border-zinc-800"
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${
                                        session.type === CHECK_IN
                                            ? 'bg-green-500'
                                            : 'bg-red-500'
                                    }`}
                                >
                                    {session.type === CHECK_IN ? (
                                        <LogIn size={14} />
                                    ) : (
                                        <LogOut size={14} />
                                    )}
                                </span>
                                <input
                                    type="time"
                                    value={session.time}
                                    disabled={saving}
                                    onChange={(e) =>
                                        handleChangeTime(idx, e.target.value)
                                    }
                                    className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white"
                                />
                                {session.type === CHECK_IN && (
                                    <button
                                        onClick={() =>
                                            handleToggleOvertime(idx)
                                        }
                                        disabled={saving}
                                        aria-pressed={session.overtime}
                                        title={t('admin.sessionEditor.overtime')}
                                        className={`rounded-lg p-2 ${
                                            session.overtime
                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
                                                : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                        } disabled:opacity-30`}
                                    >
                                        <Clock size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(idx)}
                                    disabled={!removable || saving}
                                    className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-red-900/20"
                                    title={
                                        removable
                                            ? t(
                                                  'admin.sessionEditor.remove'
                                              )
                                            : t(
                                                  'admin.sessionEditor.removeLocked'
                                              )
                                    }
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            {session.notes && (
                                <p className="mt-1.5 px-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    <span className="font-medium">
                                        {t('admin.sessionEditor.notes')}:
                                    </span>{' '}
                                    {session.notes}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            <Button
                onClick={handleAdd}
                disabled={saving}
                variant="soft"
                className="mt-4 w-full"
            >
                <Plus size={16} />
                {expected === CHECK_IN
                    ? t('admin.sessionEditor.addIn')
                    : t('admin.sessionEditor.addOut')}
            </Button>

            <div className="mt-4">
                <label
                    htmlFor="session-editor-reason"
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                    {t('admin.sessionEditor.reason')}
                </label>
                <textarea
                    id="session-editor-reason"
                    value={reason}
                    onChange={(e) => {
                        setReason(e.target.value);
                        markDirty();
                    }}
                    maxLength={500}
                    rows={2}
                    disabled={saving}
                    placeholder={t('admin.sessionEditor.reasonPlaceholder')}
                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white"
                />
            </div>

            {isAdminPanel && (
                <div className="mt-4 space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <label
                        htmlFor="session-editor-classification"
                        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                        {t('admin.sessionEditor.classificationLabel')}
                    </label>
                    <select
                        id="session-editor-classification"
                        value={classification}
                        disabled={saving}
                        onChange={(e) => {
                            setClassification(
                                e.target.value as WorkDayClassification
                            );
                            markDirty();
                        }}
                        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white"
                    >
                        {EDITABLE_CLASSIFICATIONS(row).map((c) => (
                            <option key={c} value={c}>
                                {t(`admin.sessionEditor.classification.${c}`)}
                            </option>
                        ))}
                    </select>
                    {classification === 'authorizedLeave' && (
                        <>
                            <label
                                htmlFor="session-editor-leave-notes"
                                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                            >
                                {t('admin.sessionEditor.leaveNotes')}
                            </label>
                            <textarea
                                id="session-editor-leave-notes"
                                value={leaveNotes}
                                onChange={(e) => {
                                    setLeaveNotes(e.target.value);
                                    markDirty();
                                }}
                                maxLength={2000}
                                rows={2}
                                disabled={saving}
                                placeholder={t(
                                    'admin.sessionEditor.leaveNotesPlaceholder'
                                )}
                                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white"
                            />
                        </>
                    )}
                    {classification !== row.dayClassification && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {t('admin.sessionEditor.classificationHint')}
                        </p>
                    )}
                </div>
            )}

            <p className="mt-3 text-xs text-zinc-400">
                {!isAdminPanel
                    ? t('admin.sessionEditor.hintSelf')
                    : t('admin.sessionEditor.hint')}
            </p>
        </Modal>
    );
}
