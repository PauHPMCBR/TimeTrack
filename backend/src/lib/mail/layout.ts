import { escapeHtml } from './helpers';
import type { EmailLanguage } from './types';

/**
 * Shared email shell. Each template provides its own body HTML; this wrapper
 * adds the outer table, language attribute and the branded footer line.
 */
export function renderEmailLayout(opts: {
    lang: EmailLanguage;
    companyName: string;
    bodyHtml: string;
}): string {
    const tagline = opts.lang === 'en' ? 'Time tracking' : 'Registre de jornada';
    const brand = escapeHtml(opts.companyName || 'TimeTrack360');
    const footer = escapeHtml(`${brand} — ${tagline}`);

    return `<!DOCTYPE html>
<html lang="${opts.lang}">
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">
          <tr>
            <td style="padding:32px;">
              ${opts.bodyHtml}
              <p style="margin:0;padding-top:16px;border-top:1px solid #e4e4e7;font-size:13px;color:#71717a;">${footer}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}