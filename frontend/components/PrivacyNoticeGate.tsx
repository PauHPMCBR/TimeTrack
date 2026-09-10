'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';

/**
 * Blocking privacy-notice gate for the authenticated app: when the company
 * has configured a privacy notice and the current user has not acknowledged
 * it yet, the notice is shown (RGPD arts. 13-14) and the app stays blocked
 * until they acknowledge it (timestamp stored server-side, idempotent).
 */
export default function PrivacyNoticeGate({
    children,
}: {
    children: React.ReactNode;
}) {
    const { t } = useI18n();
    const [notice, setNotice] = useState<string | null>(null);
    const [acknowledging, setAcknowledging] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [settingsRes, user] = await Promise.all([
                apiClient.getPublicSettings(),
                apiClient.getCurrentUser(),
            ]);
            if (cancelled) return;
            const text = settingsRes.data?.settings.privacyNoticeText ?? '';
            const acknowledgedAt = user?.privacyNoticeAcknowledgedAt;
            if (text && !acknowledgedAt) {
                setNotice(text);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const acknowledge = async () => {
        setAcknowledging(true);
        try {
            const res = await apiClient.acknowledgePrivacyNotice();
            if (!res.error) {
                setNotice(null);
            }
        } finally {
            setAcknowledging(false);
        }
    };

    return (
        <>
            {children}
            <Modal
                open={notice !== null}
                title={t('privacyNotice.gateTitle')}
                // Deliberately blocking: there is no way around the notice;
                // the only way forward is acknowledging it.
                onClose={() => {}}
            >
                <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-200 p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    {notice}
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                    {t('privacyNotice.gateHint')}
                </p>
                <div className="mt-4 flex justify-end">
                    <Button
                        variant="primary"
                        disabled={acknowledging}
                        onClick={acknowledge}
                    >
                        {acknowledging
                            ? t('common.loading')
                            : t('privacyNotice.acknowledge')}
                    </Button>
                </div>
            </Modal>
        </>
    );
}
