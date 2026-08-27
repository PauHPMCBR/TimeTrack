import { renderEmailLayout } from '../layout';
import { button, escapeHtml, interpolate, paragraph, smallLine } from '../helpers';
import type { EmailLanguage } from '../types';
import type { WorkSessionAnomaly } from 'shared/src/schemas/api';

export interface InconsistencyReminderVars {
    name: string;
    companyName: string;
    date: string; // YYYY-MM-DD (local)
    anomalies: WorkSessionAnomaly[];
    autoTimetable: string; // human-readable, e.g. "09:00 – 17:00"
    applyAutoUrl: string; // link that opens the confirmation on the check-in page
}

interface Copy {
    subject: string;
    greeting: string;
    intro: string;
    cta: string;
    autoTimes: string;
    contactAdmin: string;
    signature: string;
    anomalies: Record<WorkSessionAnomaly, string>;
}

const COPY: Record<EmailLanguage, Copy> = {
    ca: {
        subject: "Recordatori del registre de jornada: fitxatge inconsistent",
        greeting: 'Hola {name},',
        intro: "El teu fitxatge d'avui al registre de jornada de {companyName} no és coherent. Pots arreglar-ho amb un clic:",
        cta: "Aplica l'horari automàtic",
        autoTimes:
            "Es reemplaçaran els registres d'avui pels horaris automàtics: {autoTimetable}.",
        contactAdmin:
            "Si prefereixes, contacta amb l'administració perquè ho editi manualment.",
        signature: 'Salutacions,',
        anomalies: {
            forgot_check_out:
                'Anomalia: entrada sense sortida (has oblidat fer el check-out).',
            forgot_check_in:
                'Anomalia: sortida sense entrada (has oblidat fer el check-in).',
            hours_short: 'Anomalia: has treballat menys hores de les previstes.',
            hours_over: 'Anomalia: has treballat més hores de les previstes.',
        },
    },
    en: {
        subject: 'Time tracking reminder: inconsistent check-in',
        greeting: 'Hello {name},',
        intro: "Today's check-in/out at {companyName} is inconsistent. You can fix it in one click:",
        cta: 'Set automatic timetable',
        autoTimes:
            "It will replace today's records with your automatic timetable: {autoTimetable}.",
        contactAdmin:
            'If you prefer, contact the administration so they edit it manually.',
        signature: 'Best regards,',
        anomalies: {
            forgot_check_out:
                'Anomaly: unmatched check-in (forgot to check out).',
            forgot_check_in:
                'Anomaly: check-out with no check-in (forgot to check in).',
            hours_short: 'Anomaly: you worked fewer hours than expected.',
            hours_over: 'Anomaly: you worked more hours than expected.',
        },
    },
    es: {
        subject: 'Recordatorio del registro de jornada: fichaje inconsistente',
        greeting: 'Hola {name},',
        intro: 'Tu fichaje de hoy en el registro de jornada de {companyName} no es coherente. Puedes arreglarlo con un clic:',
        cta: 'Aplicar horario automático',
        autoTimes:
            'Se reemplazarán los registros de hoy por tu horario automático: {autoTimetable}.',
        contactAdmin:
            'Si lo prefieres, contacta con la administración para que lo edite manualmente.',
        signature: 'Un saludo,',
        anomalies: {
            forgot_check_out:
                'Anomalía: entrada sin salida (olvidaste hacer el check-out).',
            forgot_check_in:
                'Anomalía: salida sin entrada (olvidaste hacer el check-in).',
            hours_short: 'Anomalía: has trabajado menos horas de las previstas.',
            hours_over: 'Anomalía: has trabajado más horas de las previstas.',
        },
    },
};

export function buildInconsistencyReminderMessage(
    lang: EmailLanguage,
    vars: InconsistencyReminderVars
): { subject: string; text: string; html: string } {
    const copy = COPY[lang] ?? COPY.ca;
    const textVars = {
        companyName: vars.companyName,
        name: vars.name,
        date: vars.date,
        autoTimetable: vars.autoTimetable,
    };
    const htmlVars = {
        companyName: escapeHtml(vars.companyName),
        name: escapeHtml(vars.name),
        autoTimetable: escapeHtml(vars.autoTimetable),
    };

    const anomalyLines = vars.anomalies
        .map((a) => copy.anomalies[a] ?? a)
        .map((line) => smallLine(interpolate(line, htmlVars)))
        .join('');

    // Button first (remedy in 1-2 clicks); the details follow below it.
    const bodyHtml =
        paragraph(interpolate(copy.greeting, htmlVars)) +
        paragraph(interpolate(copy.intro, htmlVars)) +
        button(vars.applyAutoUrl, interpolate(copy.cta, htmlVars)) +
        anomalyLines +
        smallLine(interpolate(copy.autoTimes, htmlVars)) +
        paragraph(interpolate(copy.contactAdmin, htmlVars)) +
        paragraph(interpolate(copy.signature, htmlVars));

    return {
        subject: interpolate(copy.subject, textVars),
        text: [
            interpolate(copy.greeting, textVars),
            '',
            interpolate(copy.intro, textVars),
            vars.applyAutoUrl,
            ...vars.anomalies.map((a) => copy.anomalies[a] ?? a),
            interpolate(copy.autoTimes, textVars),
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