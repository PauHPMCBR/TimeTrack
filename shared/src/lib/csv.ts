/**
 * Minimal CSV escaping/joining shared by the export endpoints (backend) and
 * the client-side downloads (frontend), so every export quotes identically.
 */

export function escapeCsvField(value: unknown): string {
    const str = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export function toCsv(
    headers: string[],
    rows: (string | number | null | undefined)[][]
): string {
    const lines = [headers, ...rows];
    return lines.map((line) => line.map(escapeCsvField).join(',')).join('\r\n');
}
