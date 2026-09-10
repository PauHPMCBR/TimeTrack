import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { encrypt, decrypt, lookupHash } from '@/lib/crypto';

const KEY_A = '11'.repeat(32); // hex 32 bytes
const KEY_B = '22'.repeat(32);

describe('crypto (field encryption)', () => {
    const prev = { enc: process.env.ENCRYPTION_KEY, hash: process.env.HASH_KEY };

    beforeAll(() => {
        process.env.ENCRYPTION_KEY = KEY_A;
        process.env.HASH_KEY = KEY_B;
    });

    afterEach(() => {
        vi.resetModules();
        process.env.ENCRYPTION_KEY = prev.enc;
        process.env.HASH_KEY = prev.hash;
    });

    it('roundtrips a plaintext', () => {
        const ct = encrypt('worker@example.com');
        expect(decrypt(ct)).toBe('worker@example.com');
    });

    it('produces different ciphertexts for the same plaintext (randomized IV)', () => {
        expect(encrypt('same-value')).not.toBe(encrypt('same-value'));
        expect(decrypt(encrypt('same-value'))).toBe('same-value');
    });

    it('keeps empty values empty and rejects ciphertext input', () => {
        expect(encrypt('')).toBe('');
        expect(encrypt(null)).toBe('');
        expect(encrypt(undefined)).toBe('');
        const ct = encrypt('data');
        expect(() => encrypt(ct)).toThrow('already-encrypted');
    });

    it('rejects non-encrypted input on decrypt (no legacy fallback)', () => {
        expect(() => decrypt('legacy-plain@example.com')).toThrow(
            'non-encrypted'
        );
    });

    it('throws on tampered ciphertext or wrong key (auth tag)', async () => {
        const ct = encrypt('secret');
        const parts = ct.split(':');
        parts[4] = Buffer.from('tampered').toString('base64');
        expect(() => decrypt(parts.join(':'))).toThrow();

        // Wrong key: reload the module with a different key env.
        vi.resetModules();
        process.env.ENCRYPTION_KEY = '33'.repeat(32);
        process.env.HASH_KEY = KEY_B;
        const fresh = await import('@/lib/crypto');
        expect(() => fresh.decrypt(ct)).toThrow();
    });

    it('derives stable lookup hashes, case/whitespace-insensitive', () => {
        expect(lookupHash(' Worker@Example.COM ')).toBe(
            lookupHash('worker@example.com')
        );
        expect(lookupHash('a@b.com')).not.toBe(lookupHash('other@b.com'));
        expect(lookupHash('')).toBe(lookupHash(undefined));
    });

    it('fails fast without keys', async () => {
        vi.resetModules();
        delete process.env.ENCRYPTION_KEY;
        delete process.env.HASH_KEY;
        const fresh = await import('@/lib/crypto');
        expect(() => fresh.encrypt('x')).toThrow('ENCRYPTION_KEY');
        expect(() => fresh.lookupHash('x')).toThrow('HASH_KEY');
    });
});
