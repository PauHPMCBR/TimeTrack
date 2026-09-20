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
import { TONE_CLASSES, type SemanticTone } from '@/lib/semanticColors';
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

const statusTones: Record<WorkSessionRowStatus, SemanticTone> = {
    ok: 'ok',
    anomaly: 'anomaly',
    electiveVacation: 'electiveVacation',
    obligatoryVacation: 'obligatoryVacation',
    authorizedLeave: 'authorizedLeave',
    planned: 'planned',
    nonWorkingDay: 'nonWorking',
};

export const statusRowClass = (status: WorkSessionRowStatus): string =>
    TONE_CLASSES[statusTones[status]].row;

export const statusDotClass = (status: WorkSessionRowStatus): string =>
    TONE_CLASSES[statusTones[status]].dot;

const statusIcons: Record<WorkSessionRowStatus, LucideIcon> = {
    ok: CheckCircle2,
    anomaly: AlertTriangle,
    electiveVacation: Palmtree,
    obligatoryVacation: PartyPopper,
    authorizedLeave: ShieldCheck,
    planned: Clock,
    nonWorkingDay: Ban,
};

export const statusIconOf = (
    status: WorkSessionRowStatus
): { Icon: LucideIcon; className: string } => ({
    Icon: statusIcons[status],
    className: `h-4 w-4 ${TONE_CLASSES[statusTones[status]].icon}`,
});
