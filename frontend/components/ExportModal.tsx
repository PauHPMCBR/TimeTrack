'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { todayKey } from '@/lib/timezone';
import { useDirty } from '@/lib/useDirty';
import { usePersistedState } from '@/lib/usePersistedState';
import { EXPORT_DOCUMENTS, EXPORT_FORMAT } from '@/lib/storage';
import { APP_ICON_URL } from '@/lib/brand';
import {
    MAX_VALID_YEAR,
    MIN_VALID_YEAR,
} from 'shared/src/lib/constants';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import Label from '@/components/ui/Label';
import TextField from '@/components/ui/TextField';
import { Alert } from '@/components/ui/Alert';
import OptionPicker from '@/components/ui/OptionPicker';
import type { User } from '@/types';
import type {
    ExportDocumentId,
    ExportFormat,
} from '@/schemas/export';

const DOCUMENTS: ExportDocumentId[] = [
    'daily',
    'detailed',
    'overtime',
    'monthly',
    'history',
];
const FORMATS: ExportFormat[] = ['pdf', 'csv', 'json', 'xlsx'];

// The company logo comes from the frontend build (APP_ICON_URL); fetch it once
// and inline it as a data URI so the backend does not need to know branding.
let logoPromise: Promise<string | null> | null = null;

function fetchLogoDataUri(): Promise<string | null> {
    if (!APP_ICON_URL) return Promise.resolve(null);
    if (!logoPromise) {
        logoPromise = (async () => {
            try {
                const response = await fetch(APP_ICON_URL, {
                    credentials: 'same-origin',
                });
                if (!response.ok) return null;
                const blob = await response.blob();
                return await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(blob);
                });
            } catch {
                logoPromise = null;
                return null;
            }
        })();
    }
    return logoPromise;
}

function deserializeDocuments(raw: string): ExportDocumentId[] {
    try {
        const parsed = JSON.parse(raw);
        const valid = Array.isArray(parsed)
            ? parsed.filter((value): value is ExportDocumentId =>
                  DOCUMENTS.includes(value)
              )
            : [];
        return valid.length > 0 ? valid : ['daily'];
    } catch {
        return ['daily'];
    }
}

function deserializeFormat(raw: string): ExportFormat {
    try {
        const parsed = JSON.parse(raw);
        return FORMATS.includes(parsed) ? parsed : 'csv';
    } catch {
        return 'csv';
    }
}

export default function ExportModal({
    open,
    onClose,
    self = false,
    users = [],
    initialUserIds,
}: {
    open: boolean;
    onClose: () => void;
    self?: boolean;
    users?: User[];
    initialUserIds?: string[];
}) {
    const { t, lang } = useI18n();
    const { dirty, markDirty, resetDirty } = useDirty();

    const [year, setYear] = useState(() => Number(todayKey().slice(0, 4)));
    const [month, setMonth] = useState(() => Number(todayKey().slice(5, 7)));
    const [documents, setDocuments] = usePersistedState<ExportDocumentId[]>(
        EXPORT_DOCUMENTS,
        ['daily'],
        { deserialize: deserializeDocuments }
    );
    const [format, setFormat] = usePersistedState<ExportFormat>(
        EXPORT_FORMAT,
        'csv',
        { deserialize: deserializeFormat }
    );
    const [selectedUsers, setSelectedUsers] = useState<string[]>(
        initialUserIds ?? []
    );
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setError(null);
            setSelectedUsers(initialUserIds ?? users.map((u) => u._id));
            resetDirty();
        }
    }, [open]);

    const allSelected = useMemo(
        () => users.length > 0 && selectedUsers.length === users.length,
        [users.length, selectedUsers.length]
    );

    const toggleDocument = (document: ExportDocumentId) => {
        markDirty();
        setDocuments((prev) =>
            prev.includes(document)
                ? prev.filter((d) => d !== document)
                : [...prev, document]
        );
    };

    const toggleUser = (userId: string) => {
        markDirty();
        setSelectedUsers((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId]
        );
    };

    const toggleAllUsers = () => {
        markDirty();
        setSelectedUsers(allSelected ? [] : users.map((u) => u._id));
    };

    const requestClose = () => {
        if (dirty && !window.confirm(t('common.unsavedChangesConfirm'))) {
            return;
        }
        onClose();
    };

    const handleExport = async () => {
        if (documents.length === 0) {
            setError(t('export.noDocuments'));
            return;
        }
        if (!self && selectedUsers.length === 0) {
            setError(t('export.noUsers'));
            return;
        }
        setExporting(true);
        setError(null);
        const logo = format === 'pdf' ? await fetchLogoDataUri() : null;
        const res = await apiClient.exportData(
            {
                year,
                month,
                documents,
                format,
                language: lang,
                ...(logo ? { logo } : {}),
                ...(self ? {} : { userIds: selectedUsers }),
            },
            { self }
        );
        setExporting(false);
        if (res.error) {
            setError(t('export.error'));
            return;
        }
        resetDirty();
        onClose();
    };

    return (
        <Modal
            open={open}
            title={t('export.title')}
            onClose={requestClose}
            size="lg"
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={requestClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={handleExport} disabled={exporting}>
                        {exporting ? t('export.exporting') : t('export.button')}
                    </Button>
                </div>
            }
        >
            <div className="space-y-5">
                {error && <Alert variant="destructive">{error}</Alert>}

                <div className="grid grid-cols-2 gap-3">
                    <TextField
                        label={t('export.year')}
                        type="number"
                        min={MIN_VALID_YEAR}
                        max={MAX_VALID_YEAR}
                        value={year}
                        onChange={(e) => {
                            markDirty();
                            setYear(Number(e.target.value));
                        }}
                    />
                    <TextField
                        label={t('export.month')}
                        type="number"
                        min={1}
                        max={12}
                        value={month}
                        onChange={(e) => {
                            markDirty();
                            setMonth(Number(e.target.value));
                        }}
                    />
                </div>

                {!self && (
                    <div>
                        <div className="mb-1.5 flex items-center justify-between">
                            <Label>{t('export.users')}</Label>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {t('export.selectedCount', {
                                    count: selectedUsers.length,
                                })}
                            </span>
                        </div>
                        <label className="mb-2 flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={toggleAllUsers}
                            />
                            {t('export.selectAll')}
                        </label>
                        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
                            {users.map((user) => (
                                <label
                                    key={user._id}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedUsers.includes(
                                            user._id
                                        )}
                                        onChange={() => toggleUser(user._id)}
                                    />
                                    {user.name}
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <Label className="mb-1.5">{t('export.documents')}</Label>
                    <div className="space-y-1">
                        {DOCUMENTS.map((document) => (
                            <label
                                key={document}
                                className="flex items-center gap-2 text-sm"
                            >
                                <input
                                    type="checkbox"
                                    checked={documents.includes(document)}
                                    onChange={() => toggleDocument(document)}
                                />
                                {t(`export.document.${document}`)}
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <Label className="mb-1.5">{t('export.formatLabel')}</Label>
                    <OptionPicker
                        value={format}
                        onChange={(value) => {
                            markDirty();
                            setFormat(value);
                        }}
                        options={FORMATS.map((value) => ({
                            value,
                            label: t(`export.format.${value}`),
                        }))}
                    />
                </div>
            </div>
        </Modal>
    );
}
