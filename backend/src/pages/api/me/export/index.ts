import { withApi } from '@/lib/api-handler';
import { buildExportPayload } from '@/lib/export/build';
import { formatExport } from '@/lib/export/format';
import { responseErrorPost } from '@/lib/response-error-generator';
import { ExportRequestSchema } from 'shared/src/schemas/export';
import type { ExportRequest } from 'shared/src/schemas/export';

export default withApi(
    {
        method: 'POST',
        body: ExportRequestSchema,
        audit: {
            action: 'export_work_sessions',
            targetType: 'work_session_export',
            metadata: (_req, ctx) => {
                const body = ctx.body as ExportRequest;
                return {
                    users: 1,
                    year: body.year,
                    month: body.month,
                    documents: body.documents.join(','),
                    format: body.format,
                };
            },
        },
    },
    async (req, res, ctx) => {
        try {
            const body = ctx.body;
            const payload = await buildExportPayload({
                userIds: [req.user!.userId as string],
                year: body.year,
                month: body.month,
                documents: body.documents,
                generatedBy: req.user!.userId as string,
                language: body.language,
                logo: body.logo,
                appName: body.appName,
            });

            ctx.auditExtra.rows = Object.values(
                payload.manifest.rowCounts
            ).reduce((total, count) => total + (count ?? 0), 0);

            const formatted = await formatExport(body.format, payload);
            res.setHeader('Content-Type', formatted.contentType);
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${formatted.filename}"`
            );
            res.status(200).send(formatted.body);
        } catch (error) {
            console.error('Personal export error:', error);
            return responseErrorPost(res);
        }
    }
);
