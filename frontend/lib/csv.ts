// CSV building lives in shared (same escaping rules as the backend exports);
// this module keeps the browser-specific download helpers.
export { escapeCsvField, toCsv } from 'shared/src/lib/csv';

export function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function downloadCsv(csv: string, filename: string): void {
    triggerDownload(
        new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }),
        filename
    );
}
