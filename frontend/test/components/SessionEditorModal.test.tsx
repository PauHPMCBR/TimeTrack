import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import I18nProvider from '@/app/i18n';
import SessionEditorModal from '@/components/SessionEditorModal';
import { apiClient } from '@/lib/api';
import type { AdminWorkSessionRow } from '@/types';

vi.mock('next/navigation', () => ({
    usePathname: () => '/admin/events',
}));

vi.mock('@/lib/api', () => ({
    apiClient: {
        replaceDayWorkSessions: vi
            .fn()
            .mockResolvedValue({ success: true, data: {} }),
        replaceMyDayWorkSessions: vi
            .fn()
            .mockResolvedValue({ success: true, data: {} }),
    },
}));

const row = {
    userId: 'u1',
    userName: 'Anna',
    date: '2025-06-09',
    status: 'ok',
    anomalies: [],
    totalHours: 8,
    expectedHours: 8,
    source: 'userClick',
    sessions: [
        {
            type: 'check_in',
            time: '09:00',
            overtime: false,
            notes: 'Treball des de casa',
        },
        { type: 'check_out', time: '17:00', overtime: false },
    ],
} as unknown as AdminWorkSessionRow;

describe('SessionEditorModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it('sends the day key plus HH:mm wall times, never instants', async () => {
        render(
            <I18nProvider>
                <SessionEditorModal
                    row={row}
                    onClose={vi.fn()}
                    onSaved={vi.fn()}
                />
            </I18nProvider>
        );

        fireEvent.click(screen.getByText('Desar'));

        await waitFor(() => {
            expect(apiClient.replaceDayWorkSessions).toHaveBeenCalled();
        });
        const [, , sessions] = vi.mocked(
            apiClient.replaceDayWorkSessions
        ).mock.calls[0];
        expect(sessions).toEqual([
            {
                type: 'check_in',
                time: '09:00',
                overtime: false,
                notes: 'Treball des de casa',
            },
            { type: 'check_out', time: '17:00', overtime: false },
        ]);
    });

    it('rejects an out-of-order day without calling the API', () => {
        render(
            <I18nProvider>
                <SessionEditorModal
                    row={row}
                    onClose={vi.fn()}
                    onSaved={vi.fn()}
                />
            </I18nProvider>
        );

        const timeInputs = screen.getAllByDisplayValue(/:/);
        fireEvent.change(timeInputs[1], { target: { value: '08:00' } });

        fireEvent.click(screen.getByText('Desar'));

        expect(apiClient.replaceDayWorkSessions).not.toHaveBeenCalled();
        expect(
            screen.getByText(
                'Els fitxatges han de ser alternats (entrada/sortida)'
            )
        ).toBeInTheDocument();
    });
});
