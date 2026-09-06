'use client';

import { useI18n } from '@/app/i18n';
import type { FileSortField, FileSortOrder } from '@/schemas/api';

export const selectClass =
    'rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white';

/** Field selector + asc/desc toggle shared by the admin files page and the
 *  personal files page. */
export default function FileSortControls({
    sortBy,
    order,
    onSortBy,
    onOrder,
}: {
    sortBy: FileSortField;
    order: FileSortOrder;
    onSortBy: (value: FileSortField) => void;
    onOrder: (value: FileSortOrder) => void;
}) {
    const { t } = useI18n();

    return (
        <>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {t('files.sort.label')}:
            </span>

            <select
                value={sortBy}
                onChange={(e) => onSortBy(e.target.value as FileSortField)}
                className={selectClass}
                aria-label={t('files.sort.label')}
            >
                <option value="uploadedAt">{t('files.sort.date')}</option>
                <option value="originalName">{t('files.sort.name')}</option>
            </select>

            <button
                onClick={() => onOrder(order === 'asc' ? 'desc' : 'asc')}
                className={`${selectClass} w-[3.5rem] text-center`}
                title={
                    order === 'asc'
                        ? t('files.order.asc')
                        : t('files.order.desc')
                }
            >
                {order === 'asc' ? '↑' : '↓'}
            </button>
        </>
    );
}
