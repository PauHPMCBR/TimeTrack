'use client';

import { useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { initConfiguredTimezone } from '@/lib/timezone';
import { DEFAULT_TIMEZONE } from 'shared/src/lib/defaults';

export function CompanyTimezoneInit() {
    useEffect(() => {
        let cancelled = false;
        apiClient.getPublicSettings().then((res) => {
            if (cancelled) return;
            initConfiguredTimezone(
                res.data?.settings?.timezone || DEFAULT_TIMEZONE
            );
        });
        return () => {
            cancelled = true;
        };
    }, []);
    return null;
}
