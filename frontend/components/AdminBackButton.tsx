'use client';

import Link from 'next/link';
import { useI18n } from '@/app/i18n';
import { ChevronLeft } from 'lucide-react';

/** Consistent "back to the admin panel" link for admin sub-pages. */
export default function AdminBackButton() {
    const { t } = useI18n();
    return (
        <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
            <ChevronLeft className="h-4 w-4" />
            {t('common.back')}
        </Link>
    );
}
