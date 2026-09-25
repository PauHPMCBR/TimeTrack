import { z } from 'zod';
import {
    SourceKindSchema,
    WorkDayClassificationSchema,
    WorkSessionAnomalySchema,
    WorkSessionTypeSchema,
} from './database';
import { DaySessionRowSchema } from './api';
import { DateKeySchema } from '../lib/day-key';
import { TimeKeySchema } from '../lib/time-key';
import {
    LANGUAGES,
    MAX_VALID_YEAR,
    MIN_VALID_YEAR,
} from '../lib/constants';

export const ExportDocumentIdSchema = z.enum([
    'daily',
    'detailed',
    'overtime',
    'monthly',
    'history',
]);
export type ExportDocumentId = z.infer<typeof ExportDocumentIdSchema>;

export const ExportFormatSchema = z.enum(['csv', 'json', 'xlsx', 'pdf']);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

export const ExportLanguageSchema = z.enum(LANGUAGES);
export type ExportLanguage = z.infer<typeof ExportLanguageSchema>;

export const ExportRequestSchema = z.object({
    year: z.number().int().min(MIN_VALID_YEAR).max(MAX_VALID_YEAR),
    month: z.number().int().min(1).max(12),
    userIds: z.array(z.string().min(1)).optional(),
    documents: z.array(ExportDocumentIdSchema).min(1),
    format: ExportFormatSchema,
    language: ExportLanguageSchema.default('ca'),
    // Optional company logo (data URI) sent by the frontend for the PDF header.
    logo: z.string().max(3_000_000).optional(),
    // Optional company/app name sent by the frontend for the PDF title.
    appName: z.string().max(200).optional(),
});
export type ExportRequest = z.infer<typeof ExportRequestSchema>;

export const ExportManifestSchema = z.object({
    generatedAt: z.date(),
    generatedBy: z.string(),
    year: z.number().int(),
    month: z.number().int(),
    userIds: z.array(z.string()),
    documents: z.array(ExportDocumentIdSchema),
    rowCounts: z.record(ExportDocumentIdSchema, z.number().int().gte(0)),
    timezone: z.string(),
    integrity: z.record(ExportDocumentIdSchema, z.string()),
    language: ExportLanguageSchema.default('ca'),
    logo: z.string().optional(),
    appName: z.string().optional(),
});
export type ExportManifest = z.infer<typeof ExportManifestSchema>;

export const ExportDailyRowSchema = z.object({
    userId: z.string(),
    userName: z.string(),
    date: DateKeySchema,
    dayClassification: WorkDayClassificationSchema,
    sessions: z.array(DaySessionRowSchema),
    totalHours: z.number().gte(0),
    overtimeHours: z.number().gte(0),
    expectedHours: z.number().gte(0),
    anomalies: z.array(WorkSessionAnomalySchema),
    source: SourceKindSchema.optional(),
    edited: z.boolean(),
});
export type ExportDailyRow = z.infer<typeof ExportDailyRowSchema>;

export const ExportDetailedRowSchema = z.object({
    userId: z.string(),
    userName: z.string(),
    date: DateKeySchema,
    time: TimeKeySchema,
    type: WorkSessionTypeSchema,
    source: SourceKindSchema,
    overtime: z.boolean(),
    notes: z.string().optional(),
    version: z.number().int().min(1),
    edited: z.boolean(),
    confirmed: z.boolean(),
});
export type ExportDetailedRow = z.infer<typeof ExportDetailedRowSchema>;

export const ExportOvertimeRowSchema = z.object({
    userId: z.string(),
    userName: z.string(),
    date: DateKeySchema,
    entry: TimeKeySchema.nullable(),
    leave: TimeKeySchema.nullable(),
    worked: z.string(),
    entryNotes: z.string().optional(),
    leaveNotes: z.string().optional(),
});
export type ExportOvertimeRow = z.infer<typeof ExportOvertimeRowSchema>;

export const ExportMonthlyRowSchema = z.object({
    userId: z.string(),
    userName: z.string(),
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    daysWithSessions: z.number().int().gte(0),
    totalHours: z.number().gte(0),
    overtimeHours: z.number().gte(0),
    expectedHours: z.number().gte(0),
    electiveVacationDays: z.number().int().gte(0),
    obligatoryVacationDays: z.number().int().gte(0),
    authorizedLeaveDays: z.number().int().gte(0),
    anomalyCount: z.number().int().gte(0),
    confirmed: z.boolean(),
    approvedAt: z.date().optional(),
});
export type ExportMonthlyRow = z.infer<typeof ExportMonthlyRowSchema>;

export const ExportHistoryRowSchema = z.object({
    userId: z.string(),
    userName: z.string(),
    date: DateKeySchema,
    version: z.number().int().min(1),
    status: z.enum(['active', 'replaced']),
    source: SourceKindSchema,
    editedBy: z.string().optional(),
    editedByName: z.string().optional(),
    editReason: z.string().optional(),
    replacedByVersion: z.number().int().min(1).optional(),
    editedAt: z.date().optional(),
    sessions: z.array(DaySessionRowSchema),
});
export type ExportHistoryRow = z.infer<typeof ExportHistoryRowSchema>;

export const ExportDocumentRowsSchema = z.object({
    daily: z.array(ExportDailyRowSchema),
    detailed: z.array(ExportDetailedRowSchema),
    overtime: z.array(ExportOvertimeRowSchema),
    monthly: z.array(ExportMonthlyRowSchema),
    history: z.array(ExportHistoryRowSchema),
});
export type ExportDocumentRows = z.infer<typeof ExportDocumentRowsSchema>;

export const ExportPayloadSchema = z.object({
    manifest: ExportManifestSchema,
    documents: ExportDocumentRowsSchema,
});
export type ExportPayload = z.infer<typeof ExportPayloadSchema>;
