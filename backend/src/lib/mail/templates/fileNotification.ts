import { renderEmailLayout } from '../layout';
import {
    button,
    escapeHtml,
    fallbackLink,
    interpolate,
    paragraph,
} from '../helpers';
import type { EmailLanguage } from '../types';

export interface NewFileVars {
    companyName: string;
    name: string;
    fileName: string;
    description?: string;
    filesUrl: string;
}

interface Copy {
    subject: string;
    greeting: string;
    intro: string;
    descriptionLabel: string;
    cta: string;
    signature: string;
}

const COPY: Record<EmailLanguage, Copy> = {
    ca: {
        subject: 'Registre de jornada: un nou fitxer compartit amb tu',
        greeting: 'Hola {name},',
        intro:
            "L'administració ha compartit un nou fitxer amb tu: {fileName}.",
        descriptionLabel: 'Descripció: {description}',
        cta: 'Veure els meus fitxers',
        signature: 'Salutacions,',
    },
    en: {
        subject: 'Time tracking: a new file has been shared with you',
        greeting: 'Hello {name},',
        intro: 'The administration has shared a new file with you: {fileName}.',
        descriptionLabel: 'Description: {description}',
        cta: 'View my files',
        signature: 'Best regards,',
    },
    es: {
        subject: 'Registro de jornada: se ha compartido un nuevo archivo contigo',
        greeting: 'Hola {name},',
        intro:
            'La administración ha compartido un nuevo archivo contigo: {fileName}.',
        descriptionLabel: 'Descripción: {description}',
        cta: 'Ver mis archivos',
        signature: 'Un saludo,',
    },
};

export function buildNewFileMessage(
    lang: EmailLanguage,
    vars: NewFileVars
): { subject: string; text: string; html: string } {
    const copy = COPY[lang] ?? COPY.ca;
    const textVars = {
        companyName: vars.companyName,
        name: vars.name,
        fileName: vars.fileName,
        description: vars.description ?? '',
    };
    const htmlVars = {
        companyName: escapeHtml(vars.companyName),
        name: escapeHtml(vars.name),
        fileName: escapeHtml(vars.fileName),
        description: escapeHtml(vars.description ?? ''),
    };

    const descriptionHtml = vars.description
        ? paragraph(interpolate(copy.descriptionLabel, htmlVars))
        : '';
    const descriptionText = vars.description
        ? [interpolate(copy.descriptionLabel, textVars)]
        : [];

    const bodyHtml =
        paragraph(interpolate(copy.greeting, htmlVars)) +
        paragraph(interpolate(copy.intro, htmlVars)) +
        descriptionHtml +
        button(vars.filesUrl, interpolate(copy.cta, htmlVars)) +
        fallbackLink(vars.filesUrl) +
        paragraph(interpolate(copy.signature, htmlVars));

    return {
        subject: interpolate(copy.subject, textVars),
        text: [
            interpolate(copy.greeting, textVars),
            '',
            interpolate(copy.intro, textVars),
            ...descriptionText,
            vars.filesUrl,
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
