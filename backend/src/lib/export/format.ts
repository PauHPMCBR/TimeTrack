import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { toCsv } from 'shared/src/lib/csv';
import { buildExportSheet } from 'shared/src/lib/export-sheets';
import { EXPORT_TERMS } from 'shared/src/lib/export-i18n';
import { buildPdf } from '@/lib/export/pdf';
import type {
    ExportDocumentId,
    ExportFormat,
    ExportManifest,
    ExportPayload,
} from 'shared/src/schemas/export';

export interface FormattedExport {
    filename: string;
    contentType: string;
    body: Buffer;
}

const CONTENT_TYPES: Record<ExportFormat, string> = {
    csv: 'application/zip',
    json: 'application/json; charset=utf-8',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: 'application/pdf',
};

const EXTENSIONS: Record<ExportFormat, string> = {
    csv: 'zip',
    json: 'json',
    xlsx: 'xlsx',
    pdf: 'pdf',
};

function csvFor(document: ExportDocumentId, payload: ExportPayload): string {
    const sheet = buildExportSheet(
        document,
        payload.documents,
        payload.manifest.language
    );
    return '\uFEFF' + toCsv(sheet.headers, sheet.rows);
}

async function buildCsvZip(payload: ExportPayload): Promise<Buffer> {
    const zip = new JSZip();
    for (const document of payload.manifest.documents) {
        zip.file(`${document}.csv`, csvFor(document, payload));
    }
    return zip.generateAsync({ type: 'nodebuffer' });
}

function manifestRows(manifest: ExportManifest): (string | number)[][] {
    const headers = EXPORT_TERMS[manifest.language].headers;
    return [
        [headers.generatedAt, manifest.generatedAt.toISOString()],
        [headers.generatedBy, manifest.generatedBy],
        [headers.year, manifest.year],
        [headers.month, manifest.month],
        [headers.users, manifest.userIds.length],
        [headers.documents, manifest.documents.join(', ')],
        [headers.timezone, manifest.timezone],
        [headers.rowCounts, JSON.stringify(manifest.rowCounts)],
        [headers.integrity, JSON.stringify(manifest.integrity)],
    ];
}

async function buildXlsx(payload: ExportPayload): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    for (const document of payload.manifest.documents) {
        const sheet = buildExportSheet(
            document,
            payload.documents,
            payload.manifest.language
        );
        const worksheet = workbook.addWorksheet(document);
        worksheet.addRow(sheet.headers);
        for (const row of sheet.rows) {
            worksheet.addRow(row);
        }
        worksheet.getRow(1).font = { bold: true };
    }
    const manifestSheet = workbook.addWorksheet('manifest');
    manifestSheet.addRow([
        EXPORT_TERMS[payload.manifest.language].headers.field,
        EXPORT_TERMS[payload.manifest.language].headers.value,
    ]);
    for (const row of manifestRows(payload.manifest)) {
        manifestSheet.addRow(row);
    }
    manifestSheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
}

export async function formatExport(
    format: ExportFormat,
    payload: ExportPayload
): Promise<FormattedExport> {
    const { year, month } = payload.manifest;
    const generatedDay = payload.manifest.generatedAt
        .toISOString()
        .slice(0, 10);
    const filename = `export_${year}-${String(month).padStart(2, '0')}_${generatedDay}.${EXTENSIONS[format]}`;

    let body: Buffer;
    if (format === 'json') {
        body = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
    } else if (format === 'csv') {
        body = await buildCsvZip(payload);
    } else if (format === 'xlsx') {
        body = await buildXlsx(payload);
    } else {
        body = await buildPdf(payload);
    }

    return { filename, contentType: CONTENT_TYPES[format], body };
}
