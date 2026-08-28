import nodemailer from 'nodemailer';
import type { WorkSessionAnomaly } from 'shared/src/schemas/api';
import type { EmailLanguage } from './types';
import { RESET_TOKEN_TTL_HOURS } from 'shared/src/lib/defaults';
import {
    buildRegistrationMessage,
    RegistrationVars,
} from './templates/registration';
import {
    buildPasswordResetMessage,
    PasswordResetVars,
} from './templates/passwordReset';
import {
    buildInconsistencyReminderMessage,
    InconsistencyReminderVars,
    ReminderSessionTime,
} from './templates/inconsistencyReminder';

export type { EmailLanguage };
export type {
    RegistrationVars,
    PasswordResetVars,
    InconsistencyReminderVars,
    ReminderSessionTime,
};

export type EmailKind =
    | 'registration'
    | 'passwordReset'
    | 'inconsistencyReminder';

const SUPPORTED_LANGUAGES: EmailLanguage[] = ['ca', 'en', 'es'];
const DEFAULT_LANGUAGE: EmailLanguage = 'ca';

export function getCompanyLanguage(): EmailLanguage {
    const raw = process.env.COMPANY_LANGUAGE?.trim().toLowerCase();
    return (SUPPORTED_LANGUAGES as string[]).includes(raw ?? '')
        ? (raw as EmailLanguage)
        : DEFAULT_LANGUAGE;
}

export function getCompanyName(): string {
    return process.env.COMPANY_NAME || 'TimeTrack360';
}

/** "<Company> Registre Jornada" — translated sender display name for the From header. */
const SENDER_TAGLINES: Record<EmailLanguage, string> = {
    ca: 'Registre Jornada',
    es: 'Registro Jornada',
    en: 'Time tracking',
};

export function getSenderDisplayName(): string {
    return `${getCompanyName()} ${SENDER_TAGLINES[getCompanyLanguage()]}`;
}

type AnyVars =
    | RegistrationVars
    | PasswordResetVars
    | InconsistencyReminderVars;

export function buildMessage(
    kind: EmailKind,
    lang: EmailLanguage,
    vars: AnyVars
): { subject: string; text: string; html: string } {
    switch (kind) {
        case 'registration':
            return buildRegistrationMessage(lang, vars as RegistrationVars);
        case 'passwordReset':
            return buildPasswordResetMessage(lang, vars as PasswordResetVars);
        case 'inconsistencyReminder':
            return buildInconsistencyReminderMessage(
                lang,
                vars as InconsistencyReminderVars
            );
    }
}

// Lazily-created SMTP transport (Brevo relay). Null until SMTP_HOST is set so
// dev/test environments without mail configuration never attempt to send.
let transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter | null {
    const host = process.env.SMTP_HOST;
    if (!host) {
        return null;
    }
    if (!transport) {
        const port = Number(process.env.SMTP_PORT || 587);
        transport = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: process.env.SMTP_USER
                ? {
                      user: process.env.SMTP_USER,
                      pass: process.env.SMTP_PASS,
                  }
                : undefined,
        });
    }
    return transport;
}

interface SendMailInput {
    to: string;
    subject: string;
    text: string;
    html: string;
}

export async function sendMail(input: SendMailInput): Promise<void> {
    const smtp = getTransport();
    if (!smtp) {
        console.warn(
            `[mail] SMTP not configured (SMTP_HOST missing); skipping email to ${input.to}`
        );
        return;
    }

    const fromName = getSenderDisplayName();
    const from = process.env.EMAIL_FROM || 'no-reply@registrejornada.fyi';

    await smtp.sendMail({
        from: `"${fromName}" <${from}>`,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
    });
}

interface SendEmailInput {
    to: string;
    vars: AnyVars;
}

// Best-effort: never rejects, so an email failure can't break the request
// that triggered it.
export async function sendEmail(
    kind: EmailKind,
    input: SendEmailInput
): Promise<void> {
    const lang = getCompanyLanguage();
    const message = buildMessage(kind, lang, input.vars);

    try {
        await sendMail({
            to: input.to,
            subject: message.subject,
            text: message.text,
            html: message.html,
        });
    } catch (error) {
        console.error(`[mail] Failed to send ${kind} email:`, error);
    }
}

export interface RegistrationInviteInput {
    to: string;
    name: string;
    registrationLink: string;
    companyName?: string;
}

export function sendRegistrationInvite(
    input: RegistrationInviteInput
): Promise<void> {
    const vars: RegistrationVars = {
        name: input.name,
        companyName:
            input.companyName || process.env.COMPANY_NAME || getCompanyName(),
        registrationLink: input.registrationLink,
    };
    return sendEmail('registration', { to: input.to, vars });
}

export interface PasswordResetInput {
    to: string;
    name: string;
    resetLink: string;
    expiresHours?: number;
    companyName?: string;
}

export function sendPasswordReset(input: PasswordResetInput): Promise<void> {
    const vars: PasswordResetVars = {
        name: input.name,
        companyName:
            input.companyName || process.env.COMPANY_NAME || getCompanyName(),
        resetLink: input.resetLink,
        expiresHours: input.expiresHours ?? RESET_TOKEN_TTL_HOURS,
    };
    return sendEmail('passwordReset', { to: input.to, vars });
}

export interface InconsistencyReminderInput {
    to: string;
    name: string;
    date: string;
    anomalies: WorkSessionAnomaly[];
    times: ReminderSessionTime[]; // the day's actual check-in/out times, in order
    autoTimetable: string; // human-readable, e.g. "09:00 – 17:00" or "09:00 – 13:00, 15:00 – 19:00"
    applyAutoUrl: string;
    companyName?: string;
}

export function sendInconsistencyReminder(
    input: InconsistencyReminderInput
): Promise<void> {
    const vars: InconsistencyReminderVars = {
        name: input.name,
        companyName:
            input.companyName || process.env.COMPANY_NAME || getCompanyName(),
        date: input.date,
        anomalies: input.anomalies,
        times: input.times,
        autoTimetable: input.autoTimetable,
        applyAutoUrl: input.applyAutoUrl,
    };
    return sendEmail('inconsistencyReminder', { to: input.to, vars });
}