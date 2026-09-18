import {
    Ban,
    CheckCircle2,
    AlertTriangle,
    Palmtree,
    PartyPopper,
    Pencil,
    ShieldCheck,
    User,
    Zap,
    Clock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SourceKind } from '@/schemas/database';
import type { WorkSessionRowStatus } from '@/schemas/api';
import {
    SOURCE_ADMIN_MANUAL,
    SOURCE_USER_AUTOMATIC,
    SOURCE_USER_CLICK,
    SOURCE_USER_MANUAL,
} from 'shared/src/lib/constants';

const sourceIcons: Record<SourceKind, LucideIcon> = {
    [SOURCE_ADMIN_MANUAL]: ShieldCheck,
    [SOURCE_USER_AUTOMATIC]: Zap,
    [SOURCE_USER_MANUAL]: Pencil,
    [SOURCE_USER_CLICK]: User,
};

export const sourceIconOf = (source: SourceKind): LucideIcon =>
    sourceIcons[source];

const statusRowClasses: Record<WorkSessionRowStatus, string> = {
    electiveVacation: 'border-l-4 border-l-blue-500 bg-blue-100/90 dark:bg-blue-900/40',
    obligatoryVacation:
        'border-l-4 border-l-sky-500 bg-sky-100/90 dark:bg-sky-900/40',
    authorizedLeave:
        'border-l-4 border-l-violet-500 bg-violet-100/90 dark:bg-violet-900/40',
    ok: 'border-l-4 border-l-green-500 bg-green-100/90 dark:bg-green-900/40',
    planned:
        'border-l-4 border-l-zinc-300 bg-zinc-100/60 dark:bg-zinc-800/40 dark:border-l-zinc-700',
    nonWorkingDay:
        'border-l-4 border-l-zinc-300 bg-zinc-100/80 dark:bg-zinc-800/60 dark:border-l-zinc-600',
    anomaly: 'border-l-4 border-l-red-500 bg-red-100/90 dark:bg-red-900/40',
};

export const statusRowClass = (status: WorkSessionRowStatus): string =>
    statusRowClasses[status];

const statusDotClasses: Record<WorkSessionRowStatus, string> = {
    electiveVacation: 'bg-blue-500',
    obligatoryVacation: 'bg-sky-500',
    authorizedLeave: 'bg-violet-500',
    ok: 'bg-green-500',
    planned: 'bg-zinc-300 dark:bg-zinc-600',
    nonWorkingDay: 'bg-zinc-400',
    anomaly: 'bg-red-500',
};

export const statusDotClass = (status: WorkSessionRowStatus): string =>
    statusDotClasses[status];

const statusIcons: Record<WorkSessionRowStatus, LucideIcon> = {
    ok: CheckCircle2,
    anomaly: AlertTriangle,
    electiveVacation: Palmtree,
    obligatoryVacation: PartyPopper,
    authorizedLeave: ShieldCheck,
    planned: Clock,
    nonWorkingDay: Ban,
};

const statusIconClasses: Record<WorkSessionRowStatus, string> = {
    ok: 'text-green-600 dark:text-green-400',
    anomaly: 'text-red-600 dark:text-red-400',
    electiveVacation: 'text-blue-600 dark:text-blue-400',
    obligatoryVacation: 'text-sky-600 dark:text-sky-400',
    authorizedLeave: 'text-violet-600 dark:text-violet-400',
    planned: 'text-zinc-400',
    nonWorkingDay: 'text-zinc-400',
};

export const statusIconOf = (
    status: WorkSessionRowStatus
): { Icon: LucideIcon; className: string } => ({
    Icon: statusIcons[status],
    className: `h-4 w-4 ${statusIconClasses[status]}`,
});
