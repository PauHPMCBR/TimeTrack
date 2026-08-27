import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    getCompanyLanguage,
    buildRegistrationMessage,
    sendRegistrationInvite,
} from '@/lib/mail';

const VARS = {
    name: 'Pep Sallent',
    companyName: 'ACME',
    registrationLink: 'http://localhost:3000/register/token123?email=a%40b.com&name=Pep',
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

        it('returns ca when explicitly set', () => {
            vi.stubEnv('COMPANY_LANGUAGE', 'ca');
            expect(getCompanyLanguage()).toBe('ca');
        });

        it('returns en when explicitly set', () => {
            vi.stubEnv('COMPANY_LANGUAGE', 'en');
            expect(getCompanyLanguage()).toBe('en');
        });

        it('falls back to ca for unsupported values', () => {
            vi.stubEnv('COMPANY_LANGUAGE', 'fr');
            expect(getCompanyLanguage()).toBe('ca');
        });
    });

    describe('buildRegistrationMessage', () => {
        it('builds a Catalan message by default (company name + link interpolated)', () => {
            const message = buildRegistrationMessage('ca', VARS);
            expect(message.subject).toContain('ACME');
            expect(message.text).toContain('Hola Pep Sallent,');
            expect(message.text).toContain(VARS.registrationLink);
            expect(message.html).toContain('Crea la meva contrasenya');
            expect(message.html).toContain(
                'http://localhost:3000/register/token123'
            );
        });

        it('builds an English message when lang is en', () => {
            const message = buildRegistrationMessage('en', VARS);
            expect(message.subject).toBe('You have been invited to ACME');
            expect(message.text).toContain('Hello Pep Sallent,');
            expect(message.html).toContain('Create my password');
        });

        it('escapes user-controlled values in HTML', () => {
            const message = buildRegistrationMessage('ca', {
                name: '<script>alert(1)</script>',
                companyName: 'A&B <Co>',
                registrationLink: VARS.registrationLink,
            });
            expect(message.html).not.toContain('<script>');
            expect(message.html).toContain('&lt;script&gt;');
            expect(message.html).toContain('A&amp;B');
        });

        it('keeps the plain-text version free of HTML', () => {
            const message = buildRegistrationMessage('ca', VARS);
            expect(message.text).not.toContain('<a href=');
            expect(message.text).not.toContain('</');
        });
    });

    describe('sendRegistrationInvite', () => {
        it('resolves without sending when SMTP is not configured (best-effort)', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            await expect(
                sendRegistrationInvite({
                    to: 'pep@example.com',
                    ...VARS,
                })
            ).resolves.toBeUndefined();
            expect(warn).toHaveBeenCalled();
            warn.mockRestore();
        });
    });
});