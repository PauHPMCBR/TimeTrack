#!/usr/bin/env node
// 001 — Backfill registrationToken: null → '' so Mongoose no longer rejects existing users.
//
// Run from the repo root: node database/migrations/001-migrate-registration-token.cjs
// (MONGODB_URI from the environment, falling back to backend/.env)

const path = require('node:path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error(
            'MONGODB_URI not found. Set it in the environment or backend/.env'
        );
        process.exit(1);
    }

    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const result = await db
        .collection('users')
        .updateMany(
            { registrationToken: null },
            { $set: { registrationToken: '' } }
        );

    console.log(
        `Updated ${result.modifiedCount} user(s) with registrationToken: null → ''`
    );
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
