#!/usr/bin/env node
// One-time migration: backfill the WorkSession `source` field for documents
// created before the field existed. The field is non-optional; existing rows
// without it are set to 'user' (the default for normal check-in/check-out).
//
// Usage (from the backend workspace):
//
//   cd backend && npm run migrate:work-session-source
//
// It reads MONGODB_URI from the environment, falling back to backend/.env.

const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return {};
    const env = {};
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        env[key] = value;
    }
    return env;
}

async function main() {
    const uri = process.env.MONGODB_URI || loadEnv().MONGODB_URI;
    if (!uri) {
        console.error(
            'MONGODB_URI not found. Set it in the environment or backend/.env'
        );
        process.exit(1);
    }

    await mongoose.connect(uri);

    const result = await mongoose.connection
        .collection('worksessions')
        .updateMany(
            { source: { $exists: false } },
            { $set: { source: 'user' } }
        );

    console.log(
        `Backfilled ${result.modifiedCount} work session(s) to source='user'`
    );
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
