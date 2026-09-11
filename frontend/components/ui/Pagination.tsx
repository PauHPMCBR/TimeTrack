'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/app/i18n';

interface PaginationProps {
    offset: number;
    pageSize: number;
    total: number;
    onPageChange: (offset: number) => void;
}

export default function Pagination({
    offset,
    pageSize,
    total,
    onPageChange,
}: PaginationProps) {
    const { t } = useI18n();

    if (total <= pageSize) return null;

    const navButtonClass =
        'rounded-lg border border-zinc-300 bg-white p-2.5 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800';

    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {offset + 1}–{Math.min(offset + pageSize, total)} / {total}
            </span>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(Math.max(0, offset - pageSize))}
                    disabled={offset === 0}
                    className={navButtonClass}
                    aria-label={t('common.pagination.previous')}
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                    onClick={() => onPageChange(offset + pageSize)}
                    disabled={offset + pageSize >= total}
                    className={navButtonClass}
                    aria-label={t('common.pagination.next')}
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
