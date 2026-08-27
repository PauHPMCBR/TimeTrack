import nodemailer from 'nodemailer';

// Official email language per company. Controlled by the COMPANY_LANGUAGE env
// (set from the company config file's `language` entry during onboarding).
// Start with ca/en; add more languages (and their dictionaries) later.
export type EmailLanguage = 'ca' | 'en';

const SUPPORTED_LANGUAGES: EmailLanguage[] = ['ca', 'en'];
const DEFAULT_LANGUAGE: EmailLanguage = 'ca';

export interface RegistrationInviteVars {
    name: string;
    companyName: string;
    registrationLink: string;
}

interface EmailCopy {
    subject: string;
    greeting: string;
    intro: string;
    body: string;
    cta: string;
    linkHint: string;
    signature: string;
    footer: string;
}

const EMAIL_COPY: Record<EmailLanguage, EmailCopy> = {
    ca: {
        subject: 'Has estat convidat/da a {companyName}',
        greeting: 'Hola {name},',
        intro: "Se t'ha creat un compte al registre de jornada de {companyName}.",
        body: 'Per activar-lo, crea la teva contrasenya amb aquest enllaç:',
        cta: 'Crea la meva contrasenya',
        linkHint:
            "Si el botó no funciona, copia i enganxa aquest enllaç al teu navegador:",
        signature: 'Salutacions,',
        footer: '{companyName} — Registre de jornada',
    },
    en: {
        subject: 'You have been invited to {companyName}',
        greeting: 'Hello {name},',
        intro: "An account has been created for you in {companyName}'s time tracking system.",
        body: 'To activate it, create your password using this link:',
        cta: 'Create my password',
        linkHint:
            'If the button does not work, copy and paste this link into your browser:',
        signature: 'Best regards,',
        footer: '{companyName} — Time tracking',
    },
};

export function getCompanyLanguage(): EmailLanguage {
    const raw = process.env.COMPANY_LANGUAGE?.trim().toLowerCase();
    return (SUPPORTED_LANGUAGES as string[]).includes(raw ?? '')
        ? (raw as EmailLanguage)
        : DEFAULT_LANGUAGE;
}

export function getCompanyName(): string {
    return process.env.COMPANY_NAME || 'TimeTrack360';
}

function interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildRegistrationHtml(lang: EmailLanguage, vars: RegistrationInviteVars): string {
    const copy = EMAIL_COPY[lang];
    const text = {
        companyName: escapeHtml(vars.companyName),
        name: escapeHtml(vars.name),
        registrationLink: escapeHtml(vars.registrationLink),
    };
    const link = text.registrationLink;

    return `<!DOCTYPE html>
<html lang="${lang}">
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#18181b;">${interpolate(copy.greeting, text)}</p>
              <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">${interpolate(copy.intro, text)}</p>
              <p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.6;">${interpolate(copy.body, text)}</p>
              <p style="margin:0 0 24px;text-align:center;">
                <a href="${link}" style="display:inline-block;padding:12px 24px;border-radius:8px;background-color:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${interpolate(copy.cta, text)}</a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#71717a;line-height:1.5;">${interpolate(copy.linkHint, text)}</p>
              <p style="margin:0 0 24px;font-size:13px;color:#71717a;word-break:break-all;">${link}</p>
              <p style="margin:0 0 4px;font-size:15px;color:#3f3f46;">${interpolate(copy.signature, text)}</p>
              <p style="margin:0;font-size:13px;color:#71717a;">${interpolate(copy.footer, text)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildRegistrationText(lang: EmailLanguage, vars: RegistrationInviteVars): string {
    const copy = EMAIL_COPY[lang];
    const text = {
        companyName: vars.companyName,
        name: vars.name,
        registrationLink: vars.registrationLink,
    };
    return [
        interpolate(copy.greeting, text),
        '',
        interpolate(copy.intro, text),
        interpolate(copy.body, text),
        vars.registrationLink,
        '',
        interpolate(copy.signature, text),
        interpolate(copy.footer, text),
    ].join('\n');
}

export function buildRegistrationMessage(
    lang: EmailLanguage,
    vars: RegistrationInviteVars
): { subject: string; text: string; html: string } {
    return {
        subject: interpolate(EMAIL_COPY[lang].subject, {
            companyName: vars.companyName,
        }),
        text: buildRegistrationText(lang, vars),
        html: buildRegistrationHtml(lang, vars),
    };
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

    const fromName = process.env.EMAIL_FROM_NAME || getCompanyName();
    const from = process.env.EMAIL_FROM || 'no-reply@registrejornada.fyi';

    await smtp.sendMail({
        from: `"${fromName}" <${from}>`,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
    });
}

export interface RegistrationInviteInput {
    to: string;
    name: string;
    registrationLink: string;
    companyName?: string;
}

// Best-effort: never rejects, so an email failure can't break user creation.
export async function sendRegistrationInvite(
    input: RegistrationInviteInput
): Promise<void> {
    const lang = getCompanyLanguage();
    const companyName = input.companyName || getCompanyName();
    const message = buildRegistrationMessage(lang, {
        name: input.name,
        companyName,
        registrationLink: input.registrationLink,
    });

    try {
        await sendMail({
            to: input.to,
            subject: message.subject,
            text: message.text,
            html: message.html,
        });
    } catch (error) {
        console.error('[mail] Failed to send registration invite:', error);
    }
}