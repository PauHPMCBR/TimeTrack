import { Document, Page, renderToBuffer } from '@react-pdf/renderer';
import { EXPORT_TERMS } from 'shared/src/lib/export-i18n';
import type {
    ExportDocumentId,
    ExportPayload,
} from 'shared/src/schemas/export';
import type { Language } from 'shared/src/lib/constants';
import { Footer, Legend, PageChrome } from './components';
import { Section } from './sections';
import { styles } from './theme';

interface PageGroup {
    orientation: 'portrait' | 'landscape';
    sections: ExportDocumentId[];
    legend?: boolean;
}

const LOCALES: Record<Language, string> = {
    ca: 'ca-ES',
    es: 'es-ES',
    en: 'en-US',
};

function sanitizeLogo(logo: string | undefined): string | null {
    if (!logo) return null;
    return /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/.test(logo)
        ? logo
        : null;
}

// Logo height matches the brand font size; width follows the PNG aspect ratio.
const LOGO_HEIGHT = 16;

function logoDimensions(dataUri: string): { width: number; height: number } {
    const match = /^data:image\/png;base64,(.+)$/.exec(dataUri);
    if (match) {
        try {
            const buffer = Buffer.from(match[1], 'base64');
            if (buffer.length >= 24) {
                const width = buffer.readUInt32BE(16);
                const height = buffer.readUInt32BE(20);
                if (width > 0 && height > 0) {
                    return {
                        width: (width / height) * LOGO_HEIGHT,
                        height: LOGO_HEIGHT,
                    };
                }
            }
        } catch {
            // fall through to the square default
        }
    }
    return { width: LOGO_HEIGHT, height: LOGO_HEIGHT };
}

function monthYearLabel(payload: ExportPayload): string {
    const { year, month } = payload.manifest;
    const date = new Date(Date.UTC(year, month - 1, 1));
    const name = new Intl.DateTimeFormat(LOCALES[payload.manifest.language], {
        month: 'long',
        timeZone: 'UTC',
    }).format(date);
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

/**
 * Human-oriented layout order. Monthly and overtime share one portrait page
 * (overtime continues without a break); daily gets its own portrait page with
 * a color legend; edits and detailed keep the wide landscape page.
 */
function pageGroups(selected: ExportDocumentId[]): PageGroup[] {
    const has = (document: ExportDocumentId) => selected.includes(document);
    const groups: PageGroup[] = [];

    const summary: ExportDocumentId[] = (
        ['monthly', 'overtime'] as ExportDocumentId[]
    ).filter(has);
    if (summary.length > 0) {
        groups.push({ orientation: 'portrait', sections: summary });
    }
    if (has('daily')) {
        groups.push({
            orientation: 'portrait',
            sections: ['daily'],
            legend: true,
        });
    }
    if (has('history')) {
        groups.push({ orientation: 'landscape', sections: ['history'] });
    }
    if (has('detailed')) {
        groups.push({ orientation: 'landscape', sections: ['detailed'] });
    }
    return groups;
}

export async function buildPdf(payload: ExportPayload): Promise<Buffer> {
    const terms = EXPORT_TERMS[payload.manifest.language];
    const title = payload.manifest.appName
        ? `${terms.title} - ${payload.manifest.appName}`
        : terms.title;
    const monthYear = monthYearLabel(payload);
    const generated = `${terms.headers.generatedAt} ${payload.manifest.generatedAt
        .toISOString()
        .slice(0, 10)}`;
    const logo = sanitizeLogo(payload.manifest.logo);
    const logoSize = logo ? logoDimensions(logo) : null;
    const groups = pageGroups(payload.manifest.documents);

    const element = (
        <Document
            title={`${title} ${monthYear}`}
            author={payload.manifest.generatedBy}
            creator="TimeTrack"
        >
            {groups.map((group, index) => (
                <Page
                    key={index}
                    size="A4"
                    orientation={group.orientation}
                    style={styles.page}
                    wrap
                >
                    <PageChrome
                        title={title}
                        monthYear={monthYear}
                        generated={generated}
                        logo={logo}
                        logoWidth={logoSize?.width}
                        logoHeight={logoSize?.height}
                    />
                    <Footer />
                    {group.legend && (
                        <Legend language={payload.manifest.language} />
                    )}
                    {group.sections.map((document) => (
                        <Section
                            key={document}
                            document={document}
                            payload={payload}
                        />
                    ))}
                </Page>
            ))}
        </Document>
    );

    return renderToBuffer(element);
}
