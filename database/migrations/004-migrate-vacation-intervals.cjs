#!/usr/bin/env node
// 004 — Per-day elective vacations → interval documents (startDate / endDate /
// spentDays). DESTRUCTIVE: every existing elective vacation request is deleted,
// because per-day rows cannot be losslessly merged into intervals. Also
// replaces the per-day indexes with the interval ones and removes the obsolete
// `selectedElectiveDays` field from the yearly templates.
//
// Run from the repo root: node database/migrations/004-migrate-vacation-intervals.cjs
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

    // 1. Wipe elective vacation requests.
    const wiped = await db.collection('electivevacations').deleteMany({});
    console.log(`electivevacations: deleted ${wiped.deletedCount} document(s)`);

    // 2. Indexes: drop the per-day ones (ignore if absent), create the
    // interval ones.
    for (const indexName of [
        'userId_1_date_1',
        'status_1_date_1',
        'date_1',
    ]) {
        try {
            await db.collection('electivevacations').dropIndex(indexName);
            console.log(`electivevacations: dropped index ${indexName}`);
        } catch {
            console.log(
                `electivevacations: index ${indexName} not present, skipping`
            );
        }
    }
    await db
        .collection('electivevacations')
        .createIndex({ userId: 1, startDate: 1 });
    await db.collection('electivevacations').createIndex({
        userId: 1,
        status: 1,
        startDate: 1,
        endDate: 1,
    });
    await db.collection('electivevacations').createIndex({ startDate: 1 });
    console.log('electivevacations: interval indexes created');

    // 3. Drop the obsolete counter field from every yearly template.
    const cleaned = await db.collection('yearlyvacationdays').updateMany(
        { selectedElectiveDays: { $exists: true } },
        { $unset: { selectedElectiveDays: '' } }
    );
    console.log(`yearlyvacationdays: cleaned ${cleaned.modifiedCount} document(s)`);

    console.log('\nMigration completed.');
    console.log(
        'NOTE: a company whose current year has no global yearly template'
    );
    console.log(
        '(yearlyvacationdays, no userId) must create one via the admin panel'
    );
    console.log('before its users can request vacations.');
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
