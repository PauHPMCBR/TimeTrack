import { renderEmailLayout } from '../layout';
import { button, escapeHtml, fallbackLink, interpolate, paragraph, smallLine } from '../helpers';
import type { EmailLanguage } from '../types';

export interface PasswordResetVars {
    name: string;
    companyName: string;
    resetLink: string;
    expiresHours: number;
}

interface Copy {
    subject: string;
    greeting: string;
    intro: string;
    body: string;
    cta: string;
    ignoreNote: string;
    linkHint: string;
    signature: string;
}

const COPY: Record<EmailLanguage, Copy> = {
    ca: {
        subject: 'Restableix la contrasenya del registre de jornada de {companyName}',
        greeting: 'Hola {name},',
        intro: 'Has demanat restablir la contrasenya del teu compte del registre de jornada de {companyName}.',
        body: 'Per establir una nova contrasenya, fes servir aquest enllaç (vàlid durant {expiresHours} h):',
        cta: 'Restableix la contrasenya',
        ignoreNote: "Si no has sol·licitat aquest canvi, ignora aquest correu.",
        linkHint:
            "Si el botó no funciona, copia i enganxa aquest enllaç al teu navegador:",
        signature: 'Salutacions,',
    },
    en: {
        subject: 'Reset your {companyName} time tracking password',
        greeting: 'Hello {name},',
        intro: 'You requested a password reset for your {companyName} time tracking account.',
        body: 'To set a new password, use this link (valid for {expiresHours} hour(s)):',
        cta: 'Reset my password',
        ignoreNote: "If you didn't request this, you can ignore this email.",
        linkHint:
            'If the button does not work, copy and paste this link into your browser:',
        signature: 'Best regards,',
    },
    es: {
        subject:
            'Restablece la contraseña del registro de jornada de {companyName}',
        greeting: 'Hola {name},',
        intro: 'Has solicitado restablecer la contraseña de tu cuenta del registro de jornada de {companyName}.',
        body: 'Para establecer una nueva contraseña, usa este enlace (válido durante {expiresHours} h):',
        cta: 'Restablece la contraseña',
        ignoreNote: 'Si no has solicitado este cambio, ignora este correo.',
        linkHint:
            'Si el botón no funciona, copia y pega este enlace en tu navegador:',
        signature: 'Un saludo,',
    },
};

export function buildPasswordResetMessage(
    lang: EmailLanguage,
    vars: PasswordResetVars
): { subject: string; text: string; html: string } {
    const copy = COPY[lang] ?? COPY.ca;
    const textVars = {
        companyName: vars.companyName,
        name: vars.name,
        resetLink: vars.resetLink,
        expiresHours: vars.expiresHours,
    };
    const htmlVars = {
        companyName: escapeHtml(vars.companyName),
        name: escapeHtml(vars.name),
        expiresHours: vars.expiresHours,
    };

    const bodyHtml =
        paragraph(interpolate(copy.greeting, htmlVars)) +
        paragraph(interpolate(copy.intro, htmlVars)) +
        paragraph(interpolate(copy.body, htmlVars)) +
        button(vars.resetLink, interpolate(copy.cta, htmlVars)) +
        paragraph(interpolate(copy.ignoreNote, htmlVars)) +
        smallLine(interpolate(copy.linkHint, htmlVars)) +
        fallbackLink(vars.resetLink) +
        paragraph(interpolate(copy.signature, htmlVars));

    return {
        subject: interpolate(copy.subject, textVars),
        text: [
            interpolate(copy.greeting, textVars),
            '',
            interpolate(copy.intro, textVars),
            interpolate(copy.body, textVars),
            vars.resetLink,
            '',
            interpolate(copy.ignoreNote, textVars),
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