'use client';

import { useRef, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { useDirty } from '@/lib/useDirty';
import { AdminWorkSessionRow } from '@/types';
import { localeTag } from '@/lib/datetime';
import { CHECK_IN, CHECK_OUT, MS_PER_HOUR } from 'shared/src/lib/constants';
import {
    DEFAULT_CHECK_IN_HOUR,
    DEFAULT_CHECK_OUT_HOUR,
} from 'shared/src/lib/defaults';
import type { WorkSessionType } from 'shared/src/schemas/database';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import { LogIn, LogOut, Plus, Trash2, Loader2 } from 'lucide-react';

type Props = {
    row: AdminWorkSessionRow;
    onClose: () => void;
    onSaved: () => void;
};

// Times are kept as datetime-local strings ("YYYY-MM-DDTHH:mm") while editing.
type EditableSession = {
    _id: string;
    type: WorkSessionType;
    timestamp: string;
};

function toDatetimeLocal(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
export default function SessionEditorModal({ row, onClose, onSaved }: Props) {
    const { t, lang } = useI18n();
    const locale = localeTag(lang);
    const tempId = useRef(0);

    const [sessions, setSessions] = useState<EditableSession[]>(
        row.sessions.map((s) => ({
            _id: s._id,
            type: s.type,
            timestamp: toDatetimeLocal(s.timestamp),
        }))
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { dirty, markDirty, resetDirty } = useDirty();

    const requestClose = () => {
        if (dirty && !window.confirm(t('common.unsavedChangesConfirm'))) return;
        onClose();
    };

    const expected = nextExpectedType(sessions);

    const validate = (): string | null => {
        const dayStart = new Date(`${row.date}T00:00:00`);
        const dayEnd = new Date(`${row.date}T23:59:59.999`);
        const times = sessions.map((s) => new Date(s.timestamp));

        for (let i = 0; i < times.length; i++) {
            if (sessions[i].timestamp === '' || isNaN(times[i].getTime())) {
                return t('error.IncorrectParameter.reason.InvalidTimestamp');
            }
            if (times[i] < dayStart || times[i] > dayEnd) {
                return t('error.IncorrectParameter.reason.OutOfDay');
            }
        }
        for (let i = 1; i < sessions.length; i++) {
            if (times[i].getTime() <= times[i - 1].getTime()) {
                return t('error.IncorrectParameter.reason.NotInOrder');
            }
        }
        if (!isCoherent(sessions)) {
            return t('error.IncorrectParameter.reason.NotInOrder');
        }
        return null;
    };

    const handleChangeTime = (session: EditableSession, value: string) => {
        setSessions((prev) =>
            prev.map((s) =>
                s._id === session._id ? { ...s, timestamp: value } : s
            )
        );
        markDirty();
    };

    const handleAdd = () => {
        const last = sessions[sessions.length - 1];
        let ts: Date;
        if (last) {
            ts = new Date(new Date(last.timestamp).getTime() + MS_PER_HOUR);
        } else {
            ts = new Date(`${row.date}T00:00`);
            ts.setHours(
                expected === CHECK_IN
                    ? DEFAULT_CHECK_IN_HOUR
                    : DEFAULT_CHECK_OUT_HOUR,
                0,
                0,
                0
            );
        }
        const dayStart = new Date(`${row.date}T00:00`);
        const dayEnd = new Date(`${row.date}T23:59`);
        if (ts < dayStart) ts = dayStart;
        if (ts > dayEnd) ts = dayEnd;

        const next = {
            _id: `new-${tempId.current++}`,
            type: expected,
            timestamp: toDatetimeLocal(ts),
        };
        setSessions((prev) => [...prev, next]);
        markDirty();
    };

    const handleDelete = (session: EditableSession) => {
        setSessions((prev) => prev.filter((s) => s._id !== session._id));
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
        const res = await apiClient.replaceDayWorkSessions(
            row.userId,
            row.date,
            sessions.map((s) => ({ type: s.type, timestamp: s.timestamp }))
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

        onSaved();
        resetDirty();
        onClose();
    };

    const dateLabel = new Date(`${row.date}T00:00:00`).toLocaleDateString(
        locale,
        {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }
    );

    return (
        <Modal
            open={typeof document !== 'undefined'}
            title={t('admin.sessionEditor.title')}
            subtitle={`${row.userName} · ${dateLabel}`}
            onClose={requestClose}
            footer={
                <div className="flex justify-end gap-2">
                    <Button
                        onClick={requestClose}
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
                            key={session._id}
                            className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800"
                        >
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
                                value={
                                    session.timestamp.split('T')[1] ??
                                    ''
                                }
                                disabled={saving}
                                onChange={(e) =>
                                    handleChangeTime(
                                        session,
                                        `${row.date}T${e.target.value}`
                                    )
                                }
                                className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white"
                            />
                            <button
                                onClick={() => handleDelete(session)}
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

            <p className="mt-3 text-xs text-zinc-400">
                {t('admin.sessionEditor.hint')}
            </p>
        </Modal>
    );
}
