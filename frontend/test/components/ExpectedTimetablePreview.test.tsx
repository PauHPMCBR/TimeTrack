import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import I18nProvider from '@/app/i18n';
import ExpectedTimetablePreview from '@/components/timetable/ExpectedTimetablePreview';
import { DEFAULT_TIMETABLE } from 'shared/src/schemas/database';

describe('ExpectedTimetablePreview', () => {
    it('shows chips for working days and non-working tags for empty days', () => {
        render(
            <I18nProvider>
                <ExpectedTimetablePreview timetable={DEFAULT_TIMETABLE} />
            </I18nProvider>
        );

        expect(screen.getAllByText('No laborable')).toHaveLength(2);
        expect(screen.getAllByText('09:00 – 17:00')).toHaveLength(5);
    });
});
