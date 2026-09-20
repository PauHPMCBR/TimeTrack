import { describe, it, expect } from 'vitest';
import { computeWorkDayAnomalies } from '../../src/lib/day-record';
import type { WorkDayExpectations } from '../../src/lib/day-record';
import type { WorkDayClassification } from '../../src/schemas/database';

const expectations = (
    overrides: Partial<WorkDayExpectations> = {}
): WorkDayExpectations => ({
    classification: 'workday',
    checkMode: 'hours',
    timetableIntervals: [],
    expectedHours: 8,
    toleranceMinutes: 60,
    timetableToleranceMinutes: 10,
    ...overrides,
});

const sessionsAt = (times: Array<['check_in' | 'check_out', number, number?]>) =>
    times.map(([type, hour, minute]) => ({
        type,
        time: `${String(hour).padStart(2, '0')}:${String(minute ?? 0).padStart(2, '0')}`,
    }));

describe('computeWorkDayAnomalies — non-workday classifications', () => {
    it.each([
        'nonWorkingWeekday',
        'electiveVacation',
        'obligatoryVacation',
        'authorizedLeave',
    ] as WorkDayClassification[])(
        'expects zero sessions on %s and flags any punch',
        (classification) => {
            const anomalies = computeWorkDayAnomalies(
                sessionsAt([['check_in', 9], ['check_out', 10]]),
                expectations({ classification })
            );
            expect(anomalies).toEqual(['work_on_non_working_day']);
        }
    );

    it('is clean when a non-working day has no punches', () => {
        const anomalies = computeWorkDayAnomalies(
            [],
            expectations({ classification: 'electiveVacation' })
        );
        expect(anomalies).toEqual([]);
    });
});

describe('computeWorkDayAnomalies — hours mode', () => {
    it('is clean within the tolerance band', () => {
        const anomalies = computeWorkDayAnomalies(
            sessionsAt([['check_in', 9], ['check_out', 17]]),
            expectations()
        );
        expect(anomalies).toEqual([]);
    });

    it('flags hours_short beyond the tolerance', () => {
        const anomalies = computeWorkDayAnomalies(
            sessionsAt([['check_in', 9], ['check_out', 15]]),
            expectations()
        );
        expect(anomalies).toEqual(['hours_short']);
    });

    it('flags hours_over beyond the tolerance', () => {
        const anomalies = computeWorkDayAnomalies(
            sessionsAt([['check_in', 9], ['check_out', 20]]),
            expectations()
        );
        expect(anomalies).toEqual(['hours_over']);
    });

    it('flags hours_short when nothing was recorded', () => {
        const anomalies = computeWorkDayAnomalies(
            [],
            expectations()
        );
        expect(anomalies).toEqual(['hours_short']);
    });

    it('flags structural anomalies (forgot check-out)', () => {
        const anomalies = computeWorkDayAnomalies(
            sessionsAt([['check_in', 9]]),
            expectations()
        );
        expect(anomalies).toEqual(['forgot_check_out']);
    });
});

describe('computeWorkDayAnomalies — timetable mode', () => {
    it('is clean when punches match the frozen intervals', () => {
        const anomalies = computeWorkDayAnomalies(
            sessionsAt([['check_in', 9], ['check_out', 17]]),
            expectations({
                checkMode: 'timetable',
                timetableIntervals: [{ checkIn: '09:00', checkOut: '17:00' }],
            })
);
        expect(anomalies).toEqual([]);
    });

    it('flags late check-ins beyond the timetable tolerance', () => {
        const anomalies = computeWorkDayAnomalies(
            sessionsAt([['check_in', 9, 30], ['check_out', 17]]),
            expectations({
                checkMode: 'timetable',
                timetableIntervals: [{ checkIn: '09:00', checkOut: '17:00' }],
            })
);
        expect(anomalies).toEqual(['timetable_check_in_late']);
    });

    it('flags a missing shift via the shift count', () => {
        const anomalies = computeWorkDayAnomalies(
            [],
            expectations({
                checkMode: 'timetable',
                timetableIntervals: [{ checkIn: '09:00', checkOut: '17:00' }],
            })
);
        expect(anomalies).toEqual(['timetable_shift_count']);
    });
});
