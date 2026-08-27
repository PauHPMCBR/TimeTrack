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

const path = require('node:path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
    const uri = process.env.MONGODB_URI;
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
