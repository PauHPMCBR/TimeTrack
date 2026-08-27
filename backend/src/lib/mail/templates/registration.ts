import { renderEmailLayout } from '../layout';
import { button, escapeHtml, fallbackLink, interpolate, paragraph, smallLine } from '../helpers';
import type { EmailLanguage } from '../types';

export interface RegistrationVars {
    name: string;
    companyName: string;
    registrationLink: string;
}

interface Copy {
    subject: string;
    greeting: string;
    intro: string;
    body: string;
    cta: string;
    linkHint: string;
    signature: string;
}

const COPY: Record<EmailLanguage, Copy> = {
    ca: {
        subject: 'Has estat convidat/da al registre de jornada de {companyName}',
        greeting: 'Hola {name},',
        intro: "Se t'ha creat un compte al registre de jornada de {companyName}.",
        body: 'Per activar-lo, crea la teva contrasenya amb aquest enllaç:',
        cta: 'Crea la meva contrasenya',
        linkHint:
            "Si el botó no funciona, copia i enganxa aquest enllaç al teu navegador:",
        signature: 'Salutacions,',
    },
    en: {
        subject: 'You have been invited to {companyName} time tracking',
        greeting: 'Hello {name},',
        intro: "An account has been created for you in {companyName}'s time tracking system.",
        body: 'To activate it, create your password using this link:',
        cta: 'Create my password',
        linkHint:
            'If the button does not work, copy and paste this link into your browser:',
        signature: 'Best regards,',
    },
    es: {
        subject:
            'Has sido invitado/a al registro de jornada de {companyName}',
        greeting: 'Hola {name},',
        intro: 'Se te ha creado una cuenta en el registro de jornada de {companyName}.',
        body: 'Para activarla, crea tu contraseña con este enlace:',
        cta: 'Crea mi contraseña',
        linkHint:
            'Si el botón no funciona, copia y pega este enlace en tu navegador:',
        signature: 'Un saludo,',
    },
};

export function buildRegistrationMessage(
    lang: EmailLanguage,
    vars: RegistrationVars
): { subject: string; text: string; html: string } {
    const copy = COPY[lang] ?? COPY.ca;
    const textVars = {
        companyName: vars.companyName,
        name: vars.name,
        registrationLink: vars.registrationLink,
    };
    const htmlVars = {
        companyName: escapeHtml(vars.companyName),
        name: escapeHtml(vars.name),
    };

    const bodyHtml =
        paragraph(interpolate(copy.greeting, htmlVars)) +
        paragraph(interpolate(copy.intro, htmlVars)) +
        paragraph(interpolate(copy.body, htmlVars)) +
        button(vars.registrationLink, interpolate(copy.cta, htmlVars)) +
        smallLine(interpolate(copy.linkHint, htmlVars)) +
        fallbackLink(vars.registrationLink) +
        paragraph(interpolate(copy.signature, htmlVars));

    return {
        subject: interpolate(copy.subject, textVars),
        text: [
            interpolate(copy.greeting, textVars),
            '',
            interpolate(copy.intro, textVars),
            interpolate(copy.body, textVars),
            vars.registrationLink,
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