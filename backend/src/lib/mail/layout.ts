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

    // Company logo in the footer (fixed height, width follows aspect ratio).
    // Set EMAIL_LOGO_URL to a publicly reachable logo URL (e.g. the baked
    // /brand/icon.png on the frontend); absent = text-only footer.
    const logoUrl = process.env.EMAIL_LOGO_URL;
    const logoHtml = logoUrl
        ? `<p style="margin:0 0 12px;text-align:center;"><img src="${escapeHtml(logoUrl)}" alt="${brand}" height="48" style="height:48px;width:auto;max-width:100%;display:inline-block;" /></p>`
        : '';

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
              ${logoHtml}
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