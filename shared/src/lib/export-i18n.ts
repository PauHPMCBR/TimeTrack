import type { WorkSessionRowStatus } from '../schemas/api';
import type {
    SourceKind,
    WorkDayClassification,
    WorkSessionAnomaly,
    WorkSessionType,
} from '../schemas/database';
import type { Language } from './constants';
import type { ExportDocumentId } from '../schemas/export';

export type ExportHeaderKey =
    | 'user'
    | 'date'
    | 'time'
    | 'entry'
    | 'leave'
    | 'worked'
    | 'type'
    | 'classification'
    | 'sessions'
    | 'totalHours'
    | 'overtimeHours'
    | 'expectedHours'
    | 'difference'
    | 'anomalies'
    | 'source'
    | 'overtime'
    | 'notes'
    | 'checkInNotes'
    | 'checkOutNotes'
    | 'edited'
    | 'year'
    | 'month'
    | 'daysWithSessions'
    | 'electiveVacationDays'
    | 'obligatoryVacationDays'
    | 'authorizedLeaveDays'
    | 'anomalyCount'
    | 'confirmed'
    | 'approvedAt'
    | 'version'
    | 'versionStatus'
    | 'editedBy'
    | 'editReason'
    | 'replacedByVersion'
    | 'editedAt'
    | 'field'
    | 'value'
    | 'generatedAt'
    | 'generatedBy'
    | 'users'
    | 'documents'
    | 'timezone'
    | 'rowCounts'
    | 'integrity';

interface ExportTerms {
    title: string;
    headers: Record<ExportHeaderKey, string>;
    status: Record<WorkSessionRowStatus, string>;
    versionStatus: Record<'active' | 'replaced', string>;
    classification: Record<WorkDayClassification, string>;
    source: Record<SourceKind, string>;
    sessionType: Record<WorkSessionType, string>;
    anomaly: Record<WorkSessionAnomaly, string>;
    yes: string;
    no: string;
    noData: string;
    problem: string;
    workedHours: string;
    vacations: string;
    documents: Record<ExportDocumentId, string>;
}

export const EXPORT_TERMS: Record<Language, ExportTerms> = {
    ca: {
        title: 'Registre de jornada',
        headers: {
            user: 'Persona',
            date: 'Data',
            time: 'Hora',
            entry: 'Entrada',
            leave: 'Sortida',
            worked: 'Treballat',
            type: 'Tipus',
            classification: 'Classificació',
            sessions: 'Sessions',
            totalHours: 'Treballat',
            overtimeHours: 'Extra',
            expectedHours: 'Previstes',
            difference: 'Diferència',
            anomalies: 'Anomalies',
            source: 'Origen',
            overtime: 'Extra',
            notes: 'Notes',
            checkInNotes: "Notes d'entrada",
            checkOutNotes: 'Notes de sortida',
            edited: 'Editada',
            year: 'Any',
            month: 'Mes',
            daysWithSessions: 'Dies amb registre',
            electiveVacationDays: 'Dies de vacances',
            obligatoryVacationDays: 'Dies de festiu obligatori',
            authorizedLeaveDays: 'Dies de permís',
            anomalyCount: 'Dies amb anomalies',
            confirmed: 'Confirmat',
            approvedAt: 'Confirmat el',
            version: 'Versió',
            versionStatus: 'Estat',
            editedBy: 'Editada per',
            editReason: "Motiu de l'edició",
            replacedByVersion: 'Substituïda per la versió',
            editedAt: 'Editada el',
            field: 'Camp',
            value: 'Valor',
            generatedAt: 'Generat el',
            generatedBy: 'Generat per',
            users: 'Persones',
            documents: 'Documents',
            timezone: 'Zona horària',
            rowCounts: 'Files',
            integrity: 'Integritat (sha256)',
        },
        status: {
            ok: 'Correcte',
            anomaly: 'Anomalia',
            nonWorkingDay: 'No laborable',
            electiveVacation: 'Vacances',
            obligatoryVacation: 'Festiu obligatori',
            authorizedLeave: 'Permís autoritzat',
            planned: 'Planificat',
        },
        versionStatus: {
            active: 'Activa',
            replaced: 'Substituïda',
        },
        classification: {
            workday: 'Laborable',
            nonWorkingWeekday: 'No laborable',
            electiveVacation: 'Vacances',
            obligatoryVacation: 'Festiu obligatori',
            authorizedLeave: 'Permís autoritzat',
        },
        source: {
            userClick: 'Fitxatge',
            userAutomatic: 'Automàtic',
            userManual: 'Edició pròpia',
            adminManual: 'Administració',
        },
        sessionType: {
            check_in: 'Entrada',
            check_out: 'Sortida',
        },
        anomaly: {
            forgot_check_out: 'Sortida oblidada',
            forgot_check_in: 'Entrada oblidada',
            hours_short: 'Hores insuficients',
            hours_over: 'Hores excessives',
            timetable_check_in_late: 'Entrada tardana',
            timetable_check_in_early: 'Entrada avançada',
            timetable_check_out_late: 'Sortida tardana',
            timetable_check_out_early: 'Sortida avançada',
            timetable_shift_count: 'Nombre de torns',
            work_on_non_working_day: 'Feina en dia no laborable',
        },
        yes: 'Sí',
        no: 'No',
        noData: 'Sense dades',
        problem: 'Incidència',
        workedHours: 'Treballades',
        vacations: 'Vacances',
        documents: {
            daily: 'Resum diari',
            detailed: 'Fitxatges detallats',
            overtime: 'Hores extra',
            monthly: 'Estadístiques mensuals',
            history: "Historial d'edicions",
        },
    },
    es: {
        title: 'Registro de jornada',
        headers: {
            user: 'Persona',
            date: 'Fecha',
            time: 'Hora',
            entry: 'Entrada',
            leave: 'Salida',
            worked: 'Trabajado',
            type: 'Tipo',
            classification: 'Clasificación',
            sessions: 'Sesiones',
            totalHours: 'Trabajado',
            overtimeHours: 'Extra',
            expectedHours: 'Previstas',
            difference: 'Diferencia',
            anomalies: 'Anomalías',
            source: 'Origen',
            overtime: 'Extra',
            notes: 'Notas',
            checkInNotes: 'Notas de entrada',
            checkOutNotes: 'Notas de salida',
            edited: 'Editada',
            year: 'Año',
            month: 'Mes',
            daysWithSessions: 'Días con registro',
            electiveVacationDays: 'Días de vacaciones',
            obligatoryVacationDays: 'Días de festivo obligatorio',
            authorizedLeaveDays: 'Días de permiso',
            anomalyCount: 'Días con anomalías',
            confirmed: 'Confirmado',
            approvedAt: 'Confirmado el',
            version: 'Versión',
            versionStatus: 'Estado',
            editedBy: 'Editada por',
            editReason: 'Motivo de la edición',
            replacedByVersion: 'Sustituida por la versión',
            editedAt: 'Editada el',
            field: 'Campo',
            value: 'Valor',
            generatedAt: 'Generado el',
            generatedBy: 'Generado por',
            users: 'Personas',
            documents: 'Documentos',
            timezone: 'Zona horaria',
            rowCounts: 'Filas',
            integrity: 'Integridad (sha256)',
        },
        status: {
            ok: 'Correcto',
            anomaly: 'Anomalía',
            nonWorkingDay: 'No laborable',
            electiveVacation: 'Vacaciones',
            obligatoryVacation: 'Festivo obligatorio',
            authorizedLeave: 'Permiso autorizado',
            planned: 'Planificado',
        },
        versionStatus: {
            active: 'Activa',
            replaced: 'Sustituida',
        },
        classification: {
            workday: 'Laborable',
            nonWorkingWeekday: 'No laborable',
            electiveVacation: 'Vacaciones',
            obligatoryVacation: 'Festivo obligatorio',
            authorizedLeave: 'Permiso autorizado',
        },
        source: {
            userClick: 'Fichaje',
            userAutomatic: 'Automático',
            userManual: 'Edición propia',
            adminManual: 'Administración',
        },
        sessionType: {
            check_in: 'Entrada',
            check_out: 'Salida',
        },
        anomaly: {
            forgot_check_out: 'Salida olvidada',
            forgot_check_in: 'Entrada olvidada',
            hours_short: 'Horas insuficientes',
            hours_over: 'Horas excesivas',
            timetable_check_in_late: 'Entrada tardía',
            timetable_check_in_early: 'Entrada anticipada',
            timetable_check_out_late: 'Salida tardía',
            timetable_check_out_early: 'Salida anticipada',
            timetable_shift_count: 'Número de turnos',
            work_on_non_working_day: 'Trabajo en día no laborable',
        },
        yes: 'Sí',
        no: 'No',
        noData: 'Sin datos',
        problem: 'Incidencia',
        workedHours: 'Trabajadas',
        vacations: 'Vacaciones',
        documents: {
            daily: 'Resumen diario',
            detailed: 'Fichajes detallados',
            overtime: 'Horas extra',
            monthly: 'Estadísticas mensuales',
            history: 'Historial de ediciones',
        },
    },
    en: {
        title: 'Time record',
        headers: {
            user: 'User',
            date: 'Date',
            time: 'Time',
            entry: 'Entry',
            leave: 'Leave',
            worked: 'Worked',
            type: 'Type',
            classification: 'Classification',
            sessions: 'Sessions',
            totalHours: 'Worked',
            overtimeHours: 'Extra',
            expectedHours: 'Expected',
            difference: 'Difference',
            anomalies: 'Anomalies',
            source: 'Source',
            overtime: 'Overtime',
            notes: 'Notes',
            checkInNotes: 'Check-in notes',
            checkOutNotes: 'Check-out notes',
            edited: 'Edited',
            year: 'Year',
            month: 'Month',
            daysWithSessions: 'Days with sessions',
            electiveVacationDays: 'Elective vacation days',
            obligatoryVacationDays: 'Obligatory vacation days',
            authorizedLeaveDays: 'Authorized leave days',
            anomalyCount: 'Days with anomalies',
            confirmed: 'Confirmed',
            approvedAt: 'Approved at',
            version: 'Version',
            versionStatus: 'Status',
            editedBy: 'Edited by',
            editReason: 'Edit reason',
            replacedByVersion: 'Replaced by version',
            editedAt: 'Edited at',
            field: 'Field',
            value: 'Value',
            generatedAt: 'Generated at',
            generatedBy: 'Generated by',
            users: 'Users',
            documents: 'Documents',
            timezone: 'Timezone',
            rowCounts: 'Rows',
            integrity: 'Integrity (sha256)',
        },
        status: {
            ok: 'OK',
            anomaly: 'Anomaly',
            nonWorkingDay: 'Non-working day',
            electiveVacation: 'Vacation',
            obligatoryVacation: 'Obligatory holiday',
            authorizedLeave: 'Authorized leave',
            planned: 'Planned',
        },
        versionStatus: {
            active: 'Active',
            replaced: 'Replaced',
        },
        classification: {
            workday: 'Workday',
            nonWorkingWeekday: 'Non-working weekday',
            electiveVacation: 'Vacation',
            obligatoryVacation: 'Obligatory holiday',
            authorizedLeave: 'Authorized leave',
        },
        source: {
            userClick: 'Check-in',
            userAutomatic: 'Automatic',
            userManual: 'Self edit',
            adminManual: 'Admin',
        },
        sessionType: {
            check_in: 'Check-in',
            check_out: 'Check-out',
        },
        anomaly: {
            forgot_check_out: 'Forgot check-out',
            forgot_check_in: 'Forgot check-in',
            hours_short: 'Hours short',
            hours_over: 'Hours over',
            timetable_check_in_late: 'Late check-in',
            timetable_check_in_early: 'Early check-in',
            timetable_check_out_late: 'Late check-out',
            timetable_check_out_early: 'Early check-out',
            timetable_shift_count: 'Shift count',
            work_on_non_working_day: 'Work on non-working day',
        },
        yes: 'Yes',
        no: 'No',
        noData: 'No data',
        problem: 'Issue',
        workedHours: 'Worked',
        vacations: 'Vacations',
        documents: {
            daily: 'Daily summary',
            detailed: 'Detailed sessions',
            overtime: 'Overtime',
            monthly: 'Monthly stats',
            history: 'Edit history',
        },
    },
};
