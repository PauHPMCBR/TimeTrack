'use client';

import type { ReactNode } from 'react';
import { useI18n } from '@/app/i18n';

interface LoadingStateProps {
    className?: string;
    children?: ReactNode;
}

export default function LoadingState({
    className = 'p-10',
    children,
}: LoadingStateProps) {
    const { t } = useI18n();

    return (
        <div
            className={`${className} text-center text-sm text-zinc-500 animate-pulse`}
        >
            {children ?? t('common.loading')}
        </div>
    );
}
