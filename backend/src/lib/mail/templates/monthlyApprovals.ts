import { renderEmailLayout } from '../layout';
import {
    button,
    escapeHtml,
    fallbackLink,
    interpolate,
    paragraph,
} from '../helpers';
import type { EmailLanguage } from '../types';

export interface MonthlyApprovalPeriod {
    year: number;
    month: number; // 1-12
}

const MONTH_NAMES: Record<EmailLanguage, string[]> = {
    ca: [
        'gener',
        'febrer',
        'març',
        'abril',
        'maig',
        'juny',
        'juliol',
        'agost',
        'setembre',
        'octubre',
        'novembre',
        'desembre',
    ],
    es: [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
    ],
    en: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ],
};

/** "agost 2026" / "agosto 2026" / "August 2026". */
export function periodLabel(lang: EmailLanguage, period: MonthlyApprovalPeriod): string {
    const names = MONTH_NAMES[lang] ?? MONTH_NAMES.ca;
    const name = names[period.month - 1] ?? String(period.month);
    return `${name} ${period.year}`;
}

interface BaseVars {
    companyName: string;
    period: MonthlyApprovalPeriod;
}

interface AdminReviewVars extends BaseVars {
    reviewUrl: string;
}

interface WorkerApprovalVars extends BaseVars {
    name: string;
    approveUrl: string;
}

// --- Admin monthly review -------------------------------------------------

const ADMIN_REVIEW_COPY: Record<
    EmailLanguage,
    { subject: string; greeting: string; intro: string; cta: string; outro: string; signature: string }
> = {
    ca: {
        subject: 'Registre de jornada: revisa el registre mensual de {period}',
        greeting: "Hola equip d'administració,",
        intro:
            "Ha finalitzat {period}. Revisa els registres de jornada del mes i, quan tot sigui correcte, obre'l perquè cada persona treballadora confirmi el seu registre mensual des de l'aplicació.",
        cta: 'Revisar {period}',
        outro:
            'Recordeu que els mesos amb anomalies pendents no es poden obrir per a la confirmació.',
        signature: 'Salutacions,',
    },
    en: {
        subject: 'Time tracking: review the monthly records of {period}',
        greeting: 'Hello admin team,',
        intro:
            '{period} has ended. Review the monthly time records and, once everything is correct, open the month so each worker can confirm their monthly record from the app.',
        cta: 'Review {period}',
        outro:
            'Remember that months with pending anomalies cannot be opened for confirmation.',
        signature: 'Best regards,',
    },
    es: {
        subject: 'Registro de jornada: revisa el registro mensual de {period}',
        greeting: 'Hola equipo de administración,',
        intro:
            'Ha finalizado {period}. Revisa los registros de jornada del mes y, cuando todo sea correcto, ábrelo para que cada persona trabajadora confirme su registro mensual desde la aplicación.',
        cta: 'Revisar {period}',
        outro:
            'Recordad que los meses con anomalías pendientes no se pueden abrir para la confirmación.',
        signature: 'Un saludo,',
    },
};

export function buildAdminMonthlyReviewMessage(
    lang: EmailLanguage,
    vars: AdminReviewVars
): { subject: string; text: string; html: string } {
    const copy = ADMIN_REVIEW_COPY[lang] ?? ADMIN_REVIEW_COPY.ca;
    const period = periodLabel(lang, vars.period);
    const textVars = { companyName: vars.companyName, period };
    const htmlVars = {
        companyName: escapeHtml(vars.companyName),
        period: escapeHtml(period),
    };

    const bodyHtml =
        paragraph(interpolate(copy.greeting, htmlVars)) +
        paragraph(interpolate(copy.intro, htmlVars)) +
        button(vars.reviewUrl, interpolate(copy.cta, htmlVars)) +
        fallbackLink(vars.reviewUrl) +
        paragraph(interpolate(copy.outro, htmlVars)) +
        paragraph(interpolate(copy.signature, htmlVars));

    return {
        subject: interpolate(copy.subject, textVars),
        text: [
            interpolate(copy.greeting, textVars),
            '',
            interpolate(copy.intro, textVars),
            vars.reviewUrl,
            '',
            interpolate(copy.outro, textVars),
            '',
            interpolate(copy.signature, textVars),
        ].join('\n'),
        html: renderEmailLayout({
            lang,
            companyName: vars.companyName,
            bodyHtml,
        }),
    };
}

// --- Worker approval request / reminder -----------------------------------

interface WorkerCopy {
    subject: string;
    greeting: string;
    intro: string;
    cta: string;
    contactAdmin: string;
    signature: string;
}

const APPROVAL_REQUEST_COPY: Record<EmailLanguage, WorkerCopy> = {
    ca: {
        subject: 'Registre de jornada: confirma el teu registre de {period}',
        greeting: 'Hola {name},',
        intro:
            "L'administració ha revisat el teu registre de jornada de {period} i et demana que el confirmis des de l'aplicació.",
        cta: 'Revisar i confirmar',
        contactAdmin:
            'Si detectes qualsevol error, contacta amb l\'administració abans de confirmar.',
        signature: 'Salutacions,',
    },
    en: {
        subject: 'Time tracking: confirm your {period} record',
        greeting: 'Hello {name},',
        intro:
            'The administration has reviewed your {period} time record and asks you to confirm it from the app.',
        cta: 'Review and confirm',
        contactAdmin:
            'If you find any mistake, contact the administration before confirming.',
        signature: 'Best regards,',
    },
    es: {
        subject: 'Registro de jornada: confirma tu registro de {period}',
        greeting: 'Hola {name},',
        intro:
            'La administración ha revisado tu registro de jornada de {period} y te pide que lo confirmes desde la aplicación.',
        cta: 'Revisar y confirmar',
        contactAdmin:
            'Si detectas algún error, contacta con la administración antes de confirmar.',
        signature: 'Un saludo,',
    },
};

const APPROVAL_REMINDER_COPY: Record<EmailLanguage, WorkerCopy> = {
    ca: {
        subject: 'Recordatori: confirma el teu registre de {period}',
        greeting: 'Hola {name},',
        intro:
            'Encara no has confirmat el teu registre de jornada de {period}. El pots revisar i confirmar des de l\'aplicació.',
        cta: 'Revisar i confirmar',
        contactAdmin:
            'Si detectes qualsevol error, contacta amb l\'administració.',
        signature: 'Salutacions,',
    },
    en: {
        subject: 'Reminder: confirm your {period} record',
        greeting: 'Hello {name},',
        intro:
            'You have not confirmed your {period} time record yet. You can review and confirm it from the app.',
        cta: 'Review and confirm',
        contactAdmin:
            'If you find any mistake, contact the administration.',
        signature: 'Best regards,',
    },
    es: {
        subject: 'Recordatorio: confirma tu registro de {period}',
        greeting: 'Hola {name},',
        intro:
            'Todavía no has confirmado tu registro de jornada de {period}. Puedes revisarlo y confirmarlo desde la aplicación.',
        cta: 'Revisar y confirmar',
        contactAdmin:
            'Si detectas algún error, contacta con la administración.',
        signature: 'Un saludo,',
    },
};

export function buildWorkerMonthlyApprovalMessage(
    kind: 'request' | 'reminder',
    lang: EmailLanguage,
    vars: WorkerApprovalVars
): { subject: string; text: string; html: string } {
    const copy =
        (kind === 'request'
            ? APPROVAL_REQUEST_COPY[lang]
            : APPROVAL_REMINDER_COPY[lang]) ??
        (kind === 'request'
            ? APPROVAL_REQUEST_COPY.ca
            : APPROVAL_REMINDER_COPY.ca);
    const period = periodLabel(lang, vars.period);
    const textVars = {
        companyName: vars.companyName,
        name: vars.name,
        period,
    };
    const htmlVars = {
        companyName: escapeHtml(vars.companyName),
        name: escapeHtml(vars.name),
        period: escapeHtml(period),
    };

    const bodyHtml =
        paragraph(interpolate(copy.greeting, htmlVars)) +
        paragraph(interpolate(copy.intro, htmlVars)) +
        button(vars.approveUrl, interpolate(copy.cta, htmlVars)) +
        fallbackLink(vars.approveUrl) +
        paragraph(interpolate(copy.contactAdmin, htmlVars)) +
        paragraph(interpolate(copy.signature, htmlVars));

    return {
        subject: interpolate(copy.subject, textVars),
        text: [
            interpolate(copy.greeting, textVars),
            '',
            interpolate(copy.intro, textVars),
            vars.approveUrl,
            '',
            interpolate(copy.contactAdmin, textVars),
            '',
            interpolate(copy.signature, textVars),
        ].join('\n'),
        html: renderEmailLayout({
            lang,
            companyName: vars.companyName,
            bodyHtml,
        }),
    };
}
