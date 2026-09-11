import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import I18nProvider from '@/app/i18n';
import ExpectedTimetableEditor from '@/components/timetable/ExpectedTimetableEditor';
import { DEFAULT_TIMETABLE } from 'shared/src/schemas/database';

describe('ExpectedTimetableEditor', () => {
    it('renders every weekday and marks empty weekdays as non-working', () => {
        render(
            <I18nProvider>
                <ExpectedTimetableEditor
                    timetable={DEFAULT_TIMETABLE}
                    onChange={vi.fn()}
                />
            </I18nProvider>
        );

        expect(screen.getAllByText('No laborable')).toHaveLength(2);
        expect(screen.getAllByText(/Afegeix un interval|Añade un intervalo|Add interval/)).toHaveLength(
            7
        );
    });
});
