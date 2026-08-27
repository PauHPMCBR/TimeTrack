import type { ReactNode } from 'react';

export default function EmptyState({
    icon,
    title,
    description,
    action,
}: {
    icon: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                {icon}
            </div>
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {title}
            </div>
            {description && (
                <div className="max-w-xs text-sm text-zinc-500">
                    {description}
                </div>
            )}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}
