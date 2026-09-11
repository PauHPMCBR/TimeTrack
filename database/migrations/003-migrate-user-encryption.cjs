#!/usr/bin/env node
// 003 — Encrypt plaintext user data at rest (AES-256-GCM) and backfill the
// deterministic lookup hashes: email/dni on users, notes on work sessions,
// reason/notes on vacations. Idempotent (values with the "enc:v1:" prefix are
// skipped); requires the backend's ENCRYPTION_KEY / HASH_KEY.
//
// Run from the repo root: node database/migrations/003-migrate-user-encryption.cjs
// (MONGODB_URI from the environment, falling back to backend/.env)

const path = require('node:path');
const nodeCrypto = require('node:crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });

const ENC_PREFIX = 'enc:v1:';

function loadKey(name) {
    const raw = process.env[name];
    if (!raw) {
        console.error(`${name} environment variable is not set. Aborting.`);
        process.exit(1);
    }
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        return Buffer.from(raw, 'hex');
    }
    return nodeCrypto.createHash('sha256').update(raw, 'utf8').digest();
}

function encrypt(plaintext, key) {
    if (!plaintext) return '';
    if (plaintext.startsWith(ENC_PREFIX)) return plaintext;
    const iv = nodeCrypto.randomBytes(12);
    const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`;
}

function lookupHash(value, key) {
    const normalized = (value ?? '').trim().toLowerCase();
    return nodeCrypto.createHmac('sha256', key).update(normalized).digest('hex');
}

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error(
            'MONGODB_URI not found. Set it in the environment or backend/.env'
        );
        process.exit(1);
    }
    const encKey = loadKey('ENCRYPTION_KEY');
    const hashKey = loadKey('HASH_KEY');

    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    // --- Users: encrypt email/dni + backfill hashes ---
    const users = await db
        .collection('users')
        .find({
            emailEncrypted: { $in: ['', null] },
            $or: [
                { email: { $exists: true, $nin: ['', null] } },
                { dni: { $exists: true, $nin: ['', null] } },
            ],
        })
        .toArray();

    let userCount = 0;
    for (const user of users) {
        const update = { $set: {}, $unset: {} };
        if (typeof user.email === 'string' && user.email) {
            update.$set.emailEncrypted = encrypt(user.email, encKey);
            update.$set.emailHash = lookupHash(user.email, hashKey);
            update.$unset.email = '';
        }
        if (typeof user.dni === 'string' && user.dni) {
            update.$set.dniEncrypted = encrypt(user.dni, encKey);
            update.$set.dniHash = lookupHash(user.dni, hashKey);
            update.$unset.dni = '';
        }
        if (Object.keys(update.$set).length > 0) {
            const ops = { $set: update.$set };
            if (Object.keys(update.$unset).length > 0) ops.$unset = update.$unset;
            await db.collection('users').updateOne({ _id: user._id }, ops);
            userCount++;
        }
    }
    console.log(`Encrypted fields on ${userCount} user document(s).`);

    // --- WorkSession.notes ---
    const sessions = await db
        .collection('worksessions')
        .find({
            notesEncrypted: { $in: ['', null] },
            notes: { $exists: true, $nin: ['', null] },
        })
        .toArray();
    let sessionCount = 0;
    for (const s of sessions) {
        if (typeof s.notes !== 'string') {
            continue;
        }
        await db.collection('worksessions').updateOne(
            { _id: s._id },
            {
                $set: { notesEncrypted: encrypt(s.notes, encKey) },
                $unset: { notes: '' },
            }
        );
        sessionCount++;
    }
    console.log(`Encrypted notes on ${sessionCount} work session(s).`);

    // --- ElectiveVacation.reason/.notes ---
    const vacations = await db
        .collection('electivevacations')
        .find({
            $or: [
                {
                    reasonEncrypted: { $in: ['', null] },
                    reason: { $exists: true, $nin: ['', null] },
                },
                {
                    notesEncrypted: { $in: ['', null] },
                    notes: { $exists: true, $nin: ['', null] },
                },
            ],
        })
        .toArray();
    let vacationCount = 0;
    for (const v of vacations) {
        const update = { $set: {}, $unset: {} };
        if (typeof v.reason === 'string' && v.reason) {
            update.$set.reasonEncrypted = encrypt(v.reason, encKey);
            update.$unset.reason = '';
        }
        if (typeof v.notes === 'string' && v.notes) {
            update.$set.notesEncrypted = encrypt(v.notes, encKey);
            update.$unset.notes = '';
        }
        if (Object.keys(update.$set).length > 0) {
            const ops = { $set: update.$set };
            if (Object.keys(update.$unset).length > 0) ops.$unset = update.$unset;
            await db
                .collection('electivevacations')
                .updateOne({ _id: v._id }, ops);
            vacationCount++;
        }
    }
    console.log(`Encrypted fields on ${vacationCount} vacation document(s).`);

    console.log('Done.');
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
