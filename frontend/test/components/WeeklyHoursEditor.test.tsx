import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import I18nProvider from '@/app/i18n';
import WeeklyHoursEditor from '@/components/weeklyHours/WeeklyHoursEditor';
import { DEFAULT_WEEKLY_EXPECTED_HOURS } from 'shared/src/lib/defaults';

describe('WeeklyHoursEditor', () => {
    it('renders one duration input per weekday and tags 0h days as non-working', () => {
        const { container } = render(
            <I18nProvider>
                <WeeklyHoursEditor
                    hours={DEFAULT_WEEKLY_EXPECTED_HOURS}
                    onChange={vi.fn()}
                />
            </I18nProvider>
        );

        const inputs = container.querySelectorAll<HTMLInputElement>(
            'input[type="time"]'
        );
        expect(inputs).toHaveLength(7);
        expect(inputs[0].value).toBe('08:00');
        expect(inputs[5].value).toBe('00:00');
        expect(screen.getAllByText('No laborable')).toHaveLength(2);
    });

    it('emits decimal hours when a duration is set', () => {
        const onChange = vi.fn();
        const { container } = render(
            <I18nProvider>
                <WeeklyHoursEditor
                    hours={DEFAULT_WEEKLY_EXPECTED_HOURS}
                    onChange={onChange}
                />
            </I18nProvider>
        );

        const inputs = container.querySelectorAll<HTMLInputElement>(
            'input[type="time"]'
        );
        fireEvent.change(inputs[0], { target: { value: '04:30' } });

        expect(onChange).toHaveBeenCalled();
        const last = onChange.mock.calls.at(-1)![0] as number[];
        expect(last).toHaveLength(7);
        expect(last[1]).toBe(4.5);
        expect(last[2]).toBe(8);
    });
});
