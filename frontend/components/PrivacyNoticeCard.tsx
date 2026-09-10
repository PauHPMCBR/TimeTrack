'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import Card from '@/components/ui/Card';

// Read-only company privacy notice on the profile page: the notice stays
// available to the data subject after registration and acknowledgment
// (RGPD arts. 13-14), not only in the registration flow.
export default function PrivacyNoticeCard() {
    const { t } = useI18n();
    const [notice, setNotice] = useState<string>('');

    useEffect(() => {
        let cancelled = false;
        apiClient.getPublicPrivacyNotice().then((res) => {
            if (!cancelled && res.data?.privacyNoticeText) {
                setNotice(res.data.privacyNoticeText);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    if (!notice) return null;

    return (
        <Card className="p-4">
            <div className="mb-2 text-sm font-medium text-zinc-900 dark:text-white">
                {t('privacyNotice.gateTitle')}
            </div>
            <div className="max-h-60 overflow-y-auto whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">
                {notice}
            </div>
        </Card>
    );
}
