import { describe, it, expect, vi, afterEach } from 'vitest';
import type { WorkSessionAnomaly } from 'shared/src/schemas/api';
import {
    buildMessage,
    getCompanyLanguage,
    sendRegistrationInvite,
} from '@/lib/mail';

const REG_VARS = {
    name: 'Pep Sallent',
    companyName: 'ACME',
    registrationLink:
        'http://localhost:3000/register/token123?email=a%40b.com&name=Pep',
};

const RESET_VARS = {
    name: 'Pep Sallent',
    companyName: 'ACME',
    resetLink: 'http://localhost:3000/reset-password?token=abc&email=a%40b.com',
    expiresHours: 1,
};

const REMINDER_VARS = {
    name: 'Pep Sallent',
    companyName: 'ACME',
    date: '2026-08-27',
    anomalies: ['forgot_check_out', 'hours_short'] as WorkSessionAnomaly[],
    autoTimetable: '09:00 – 17:00',
    applyAutoUrl: 'http://localhost:3000/check-in?applyAuto=1&date=2026-08-27',
};

describe('mail (email sending)', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe('getCompanyLanguage', () => {
        it('defaults to ca when COMPANY_LANGUAGE is unset', () => {
            vi.stubEnv('COMPANY_LANGUAGE', '');
            expect(getCompanyLanguage()).toBe('ca');
        });

        it('returns ca / en / es when explicitly set', () => {
            expect(getCompanyLanguage()).toBe('ca');
            vi.stubEnv('COMPANY_LANGUAGE', 'en');
            expect(getCompanyLanguage()).toBe('en');
            vi.stubEnv('COMPANY_LANGUAGE', 'es');
            expect(getCompanyLanguage()).toBe('es');
        });

        it('falls back to ca for unsupported values', () => {
            vi.stubEnv('COMPANY_LANGUAGE', 'fr');
            expect(getCompanyLanguage()).toBe('ca');
        });
    });

    describe('registration', () => {
        it('builds a Catalan message with company name + link interpolated', () => {
            const message = buildMessage('registration', 'ca', REG_VARS);
            expect(message.subject).toContain('ACME');
            expect(message.text).toContain('Hola Pep Sallent,');
            expect(message.text).toContain(REG_VARS.registrationLink);
            expect(message.html).toContain('Crea la meva contrasenya');
            expect(message.html).toContain(
                'http://localhost:3000/register/token123'
            );
        });

        it('builds an English message when lang is en', () => {
            const message = buildMessage('registration', 'en', REG_VARS);
            expect(message.subject).toBe(
                'You have been invited to ACME time tracking'
            );
            expect(message.text).toContain('Hello Pep Sallent,');
            expect(message.html).toContain('Create my password');
        });

        it('builds a Spanish message when lang is es', () => {
            const message = buildMessage('registration', 'es', REG_VARS);
            expect(message.subject).toBe(
                'Has sido invitado/a al registro de jornada de ACME'
            );
            expect(message.html).toContain('Crea mi contraseña');
        });

        it('escapes user-controlled values in HTML', () => {
            const message = buildMessage('registration', 'ca', {
                ...REG_VARS,
                name: '<script>alert(1)</script>',
                companyName: 'A&B <Co>',
            });
            expect(message.html).not.toContain('<script>');
            expect(message.html).toContain('&lt;script&gt;');
            expect(message.html).toContain('A&amp;B');
        });
    });

    describe('passwordReset', () => {
        it('builds a password reset message with the reset link', () => {
            const message = buildMessage('passwordReset', 'en', RESET_VARS);
            expect(message.subject).toBe(
                'Reset your ACME time tracking password'
            );
            expect(message.text).toContain(RESET_VARS.resetLink);
            expect(message.html).toContain('Reset my password');
            expect(message.html).toContain(
                'http://localhost:3000/reset-password?token=abc'
            );
            expect(message.text).toContain('valid for 1 hour(s)');
        });

        it('builds the Catalan reset message', () => {
            const message = buildMessage('passwordReset', 'ca', RESET_VARS);
            expect(message.subject).toBe(
                'Restableix la contrasenya del registre de jornada de ACME'
            );
            expect(message.html).toContain('Restableix la contrasenya');
        });
    });

    describe('inconsistencyReminder', () => {
        it('puts the CTA button first and the anomaly details below it', () => {
            const message = buildMessage(
                'inconsistencyReminder',
                'ca',
                REMINDER_VARS
            );
            const buttonIndex = message.html.indexOf('Aplica');
            const anomalyIndex = message.html.indexOf('entrada sense sortida');
            const timesIndex = message.html.indexOf('09:00');
            expect(buttonIndex).toBeGreaterThan(-1);
            expect(anomalyIndex).toBeGreaterThan(-1);
            expect(timesIndex).toBeGreaterThan(-1);
            expect(buttonIndex).toBeLessThan(anomalyIndex);
            expect(buttonIndex).toBeLessThan(timesIndex);
        });

        it('translates anomaly + auto times and links to the check-in page', () => {
            const message = buildMessage(
                'inconsistencyReminder',
                'en',
                REMINDER_VARS
            );
            expect(message.subject).toBe(
                'Time tracking reminder: inconsistent check-in'
            );
            expect(message.html).toContain('unmatched check-in');
            expect(message.html).toContain('09:00');
            expect(message.html).toContain('17:00');
            expect(message.html).toContain('applyAuto=1');
            expect(message.html).toContain('contact the administration');
        });
    });

    describe('sendRegistrationInvite', () => {
        it('resolves without sending when SMTP is not configured (best-effort)', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            await expect(
                sendRegistrationInvite({
                    to: 'pep@example.com',
                    ...REG_VARS,
                })
            ).resolves.toBeUndefined();
            expect(warn).toHaveBeenCalled();
            warn.mockRestore();
        });
    });
});