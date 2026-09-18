#!/usr/bin/env node
// 007 — Whole-day values (vacation bounds, obligatory days, tracking start)
// from runtime-local midnight Dates → plain "YYYY-MM-DD" day keys. Lossless:
// a stored day Date is the instant of local midnight in the runtime zone that
// wrote it, so reading back the Date's Y/M/D parts in the runtime zone
// recovers the exact calendar day. Idempotent: fields already stored as
// strings are left untouched.
//
// Run from the repo root: node database/migrations/007-migrate-vacation-day-keys.cjs
// (MONGODB_URI from the environment, falling back to backend/.env)

const path = require('node:path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });

function storedDayKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function isLegacyDate(value) {
    return value instanceof Date;
}

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

    // 1. Elective vacations: startDate / endDate midnight Dates → day keys.
    let vacations = 0;
    for await (const doc of db
        .collection('electivevacations')
        .find({
            $or: [
                { startDate: { $type: 'date' } },
                { endDate: { $type: 'date' } },
            ],
        })) {
        const update = {};
        if (isLegacyDate(doc.startDate)) {
            update.startDate = storedDayKey(doc.startDate);
        }
        if (isLegacyDate(doc.endDate)) {
            update.endDate = storedDayKey(doc.endDate);
        }
        await db
            .collection('electivevacations')
            .updateOne({ _id: doc._id }, { $set: update });
        vacations++;
    }
    console.log(`electivevacations: migrated ${vacations} document(s)`);

    // 2. Yearly templates: obligatoryDays midnight Dates → day keys.
    let yearly = 0;
    for await (const doc of db.collection('yearlyvacationdays').find({})) {
        const days = doc.obligatoryDays;
        if (!Array.isArray(days) || !days.some(isLegacyDate)) continue;
        await db
            .collection('yearlyvacationdays')
            .updateOne(
                { _id: doc._id },
                { $set: { obligatoryDays: days.map((day) => (isLegacyDate(day) ? storedDayKey(day) : day)) } }
            );
        yearly++;
    }
    console.log(`yearlyvacationdays: migrated ${yearly} document(s)`);

    // 3. Users: trackingStartDate midnight Date → day key.
    let users = 0;
    for await (const doc of db
        .collection('users')
        .find({ trackingStartDate: { $type: 'date' } })) {
        await db
            .collection('users')
            .updateOne(
                { _id: doc._id },
                { $set: { trackingStartDate: storedDayKey(doc.trackingStartDate) } }
            );
        users++;
    }
    console.log(`users: migrated ${users} document(s)`);

    console.log('\nMigration completed.');
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
