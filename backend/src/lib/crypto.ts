import crypto from 'crypto';

const ENC_PREFIX = 'enc:v1:';

function loadKey(name: string): Buffer {
    const raw = process.env[name];
    if (!raw) {
        throw new Error(`${name} environment variable is not set`);
    }
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        return Buffer.from(raw, 'hex');
    }
    return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

let encKey: Buffer | null = null;
let macKey: Buffer | null = null;

function encryptionKey(): Buffer {
    if (!encKey) encKey = loadKey('ENCRYPTION_KEY');
    return encKey;
}

function hashKey(): Buffer {
    if (!macKey) macKey = loadKey('HASH_KEY');
    return macKey;
}

/** AES-256-GCM encrypt; empty input stays empty; rejects ciphertext input. */
export function encrypt(plaintext: string | null | undefined): string {
    if (plaintext === null || plaintext === undefined || plaintext === '') {
        return '';
    }
    if (plaintext.startsWith(ENC_PREFIX)) {
        throw new Error('Value already-encrypted (ciphertext input)');
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const data = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`;
}

export function decrypt(value: string | null | undefined): string {
    if (!value) return '';
    if (!value.startsWith(ENC_PREFIX)) {
        throw new Error('Value non-encrypted (missing ciphertext prefix)');
    }
    const [, , ivB64, tagB64, dataB64] = value.split(':');
    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        encryptionKey(),
        Buffer.from(ivB64, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
        decipher.update(Buffer.from(dataB64, 'base64')),
        decipher.final(),
    ]).toString('utf8');
}

export function lookupHash(value: string | null | undefined): string {
    const normalized = (value ?? '').trim().toLowerCase();
    return crypto
        .createHmac('sha256', hashKey())
        .update(normalized)
        .digest('hex');
}
