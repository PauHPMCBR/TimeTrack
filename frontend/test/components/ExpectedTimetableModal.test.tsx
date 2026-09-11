import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import I18nProvider from '@/app/i18n';
import ExpectedTimetableModal from '@/components/timetable/ExpectedTimetableModal';
import { defaultTimetable } from 'shared/src/schemas/database';

const openTimetable = defaultTimetable();
const invalidTimetable = defaultTimetable();
invalidTimetable[1] = [{ checkIn: '18:00', checkOut: '09:00' }];

describe('ExpectedTimetableModal', () => {
    it('blocks saving an invalid draft and stays open', () => {
        const onSave = vi.fn();
        const onClose = vi.fn();
        render(
            <I18nProvider>
                <ExpectedTimetableModal
                    open
                    timetable={invalidTimetable}
                    onClose={onClose}
                    onSave={onSave}
                />
            </I18nProvider>
        );

        fireEvent.click(screen.getByText('Desar'));
        expect(onSave).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
        expect(
            screen.getByText(/ha de començar i acabar dins del dia/)
        ).toBeInTheDocument();
    });

    it('saves a valid draft and closes', () => {
        const onSave = vi.fn();
        const onClose = vi.fn();
        render(
            <I18nProvider>
                <ExpectedTimetableModal
                    open
                    timetable={openTimetable}
                    onClose={onClose}
                    onSave={onSave}
                />
            </I18nProvider>
        );

        fireEvent.click(screen.getByText('Desar'));
        expect(onSave).toHaveBeenCalledWith(openTimetable);
        expect(onClose).toHaveBeenCalled();
    });
});
