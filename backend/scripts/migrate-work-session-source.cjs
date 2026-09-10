#!/usr/bin/env node
// One-time migration for the WorkSession `source` field:
//   1. Backfills documents created before the field existed with 'userClick'
//      (the default for normal check-in/check-out punches).
//   2. Renames the pre-rename enum values to the current, more descriptive
//      names:  user -> userClick, admin -> adminManual,
//               automatic -> userAutomatic, manual -> userManual.
// Idempotent: only documents matching the old values are touched.
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

// legacy value -> current value
const RENAMES = {
    user: 'userClick',
    admin: 'adminManual',
    automatic: 'userAutomatic',
    manual: 'userManual',
};

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error(
            'MONGODB_URI not found. Set it in the environment or backend/.env'
        );
        process.exit(1);
    }

    await mongoose.connect(uri);
    const collection = mongoose.connection.collection('worksessions');

    let total = 0;
    for (const [legacy, current] of Object.entries(RENAMES)) {
        const result = await collection.updateMany(
            { source: legacy },
            { $set: { source: current } }
        );
        if (result.modifiedCount > 0) {
            console.log(
                `Renamed ${result.modifiedCount} work session(s): source='${legacy}' -> '${current}'`
            );
        }
        total += result.modifiedCount;
    }

    const backfill = await collection.updateMany(
        { source: { $exists: false } },
        { $set: { source: 'userClick' } }
    );
    if (backfill.modifiedCount > 0) {
        console.log(
            `Backfilled ${backfill.modifiedCount} work session(s) to source='userClick'`
        );
    }
    total += backfill.modifiedCount;

    console.log(`Done. ${total} work session(s) migrated.`);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
