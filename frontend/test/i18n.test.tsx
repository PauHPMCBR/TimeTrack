import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import I18nProvider, { useI18n } from '@/app/i18n';

function Probe({
    onReady,
}: {
    onReady: (api: ReturnType<typeof useI18n>) => void;
}) {
    const api = useI18n();
    onReady(api);
    return <div data-testid="lang">{api.lang}</div>;
}

describe('I18nProvider', () => {
    it('defaults to ca and translates keys', async () => {
        let api: ReturnType<typeof useI18n> | undefined;
        render(
            <I18nProvider>
                <Probe onReady={(a) => (api = a)} />
            </I18nProvider>
        );

        expect(screen.getByTestId('lang').textContent).toBe('ca');
        expect(api!.t('tabs.checkin')).toBe('Fitxar');
    });

    it('falls back to the raw key for unknown translations', async () => {
        let api: ReturnType<typeof useI18n> | undefined;
        render(
            <I18nProvider>
                <Probe onReady={(a) => (api = a)} />
            </I18nProvider>
        );

        expect(api!.t('nonexistent.key.path')).toBe('nonexistent.key.path');
    });

    it('interpolates params', async () => {
        let api: ReturnType<typeof useI18n> | undefined;
        render(
            <I18nProvider>
                <Probe onReady={(a) => (api = a)} />
            </I18nProvider>
        );

        expect(
            api!.t('profile.status.checkedInAgo', { time: '2h' })
        ).not.toContain('{time}');
    });
});
