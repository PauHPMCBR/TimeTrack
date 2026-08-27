export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function interpolate(
    template: string,
    vars: Record<string, string | number>
): string {
    return template.replace(/\{(\w+)\}/g, (_, key) =>
        vars[key] !== undefined ? String(vars[key]) : `{${key}}`
    );
}

/** A body paragraph. Accepts already-escaped HTML. */
export function paragraph(html: string): string {
    return `<p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">${html}</p>`;
}

/** A small muted line (used for hints and secondary info). */
export function smallLine(html: string): string {
    return `<p style="margin:0 0 8px;font-size:13px;color:#71717a;line-height:1.5;">${html}</p>`;
}

/** A consistent centered CTA button. Escapes both the URL and the label. */
export function button(url: string, label: string): string {
    return `<p style="margin:0 0 24px;text-align:center;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;border-radius:8px;background-color:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(label)}</a></p>`;
}

/** The full link as a muted, word-breakable line (fallback for button blockers). */
export function fallbackLink(url: string): string {
    return `<p style="margin:0 0 24px;font-size:13px;color:#71717a;word-break:break-all;">${escapeHtml(url)}</p>`;
}