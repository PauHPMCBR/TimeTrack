#!/usr/bin/env node
// 010 — Yearly obligatory vacation days → obligatory intervals. Every
// `yearlyvacationdays` document currently stores `obligatoryDays` as a flat
// array of "YYYY-MM-DD" day keys; the days are sorted and any run of adjacent
// calendar days is merged into a single inclusive interval
// `{ startDate, endDate }` under the new `obligatoryIntervals` field, and the
// old `obligatoryDays` field is removed. Lossless and idempotent: documents
// that already have `obligatoryIntervals` (and no `obligatoryDays`) are
// skipped, and legacy Date values are still converted in case migration 007
// was not run.
//
// Run from the repo root: node database/migrations/010-migrate-obligatory-intervals.cjs
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

function toDayKey(value) {
    return value instanceof Date ? storedDayKey(value) : value;
}

function nextDayKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d));
    utc.setUTCDate(utc.getUTCDate() + 1);
    const yy = String(utc.getUTCFullYear()).padStart(4, '0');
    const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(utc.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

function groupAdjacentDays(dayKeys) {
    const intervals = [];
    for (const key of [...new Set(dayKeys)].sort()) {
        const last = intervals[intervals.length - 1];
        if (last && nextDayKey(last.endDate) === key) {
            last.endDate = key;
        } else {
            intervals.push({ startDate: key, endDate: key });
        }
    }
    return intervals;
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

    let migrated = 0;
    for await (const doc of db
        .collection('yearlyvacationdays')
        .find({ obligatoryDays: { $exists: true } })) {
        const days = Array.isArray(doc.obligatoryDays)
            ? doc.obligatoryDays
            : [];
        const obligatoryIntervals = groupAdjacentDays(days.map(toDayKey));
        await db.collection('yearlyvacationdays').updateOne(
            { _id: doc._id },
            {
                $set: { obligatoryIntervals },
                $unset: { obligatoryDays: '' },
            }
        );
        migrated++;
    }
    console.log(`yearlyvacationdays: migrated ${migrated} document(s)`);

    console.log('\nMigration completed.');
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
