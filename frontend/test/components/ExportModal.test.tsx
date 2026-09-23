import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import {
    render,
    screen,
    fireEvent,
    waitFor,
    cleanup,
} from '@testing-library/react';
import I18nProvider from '@/app/i18n';
import ExportModal from '@/components/ExportModal';
import { apiClient } from '@/lib/api';
import type { User } from '@/types';

vi.mock('@/lib/api', () => ({
    apiClient: {
        exportData: vi.fn().mockResolvedValue({ data: null }),
    },
}));

const users = [
    { _id: 'u1', name: 'Anna' },
    { _id: 'u2', name: 'Bob' },
] as unknown as User[];

describe('ExportModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it('exports the current user data in self mode', async () => {
        render(
            <I18nProvider>
                <ExportModal open onClose={vi.fn()} self />
            </I18nProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Exporta' }));

        await waitFor(() => {
            expect(apiClient.exportData).toHaveBeenCalled();
        });
        const [request, options] = vi.mocked(apiClient.exportData).mock
            .calls[0];
        expect(options).toEqual({ self: true });
        expect(request.documents).toEqual(['daily']);
        expect(request.format).toBe('csv');
        expect(request.userIds).toBeUndefined();
        expect(typeof request.year).toBe('number');
        expect(typeof request.month).toBe('number');
    });

    it('exports the selected users in admin mode', async () => {
        render(
            <I18nProvider>
                <ExportModal
                    open
                    onClose={vi.fn()}
                    users={users}
                    initialUserIds={['u2']}
                />
            </I18nProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Exporta' }));

        await waitFor(() => {
            expect(apiClient.exportData).toHaveBeenCalled();
        });
        const [request, options] = vi.mocked(apiClient.exportData).mock
            .calls[0];
        expect(options).toEqual({ self: false });
        expect(request.userIds).toEqual(['u2']);
    });
});
