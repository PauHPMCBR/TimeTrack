#!/usr/bin/env node
// 008 — WorkSession `timestamp: Date` (UTC instant) → `date` ("YYYY-MM-DD",
// company timezone) + `time` ("HH:MM" wall clock). Plain conversion: each
// stored instant is read in the company timezone from `appsettings`
// (default Europe/Madrid). The old timestamp is kept on converted documents
// for traceability; new indexes replace the timestamp ones. Idempotent:
// documents already carrying `time` are skipped.
//
// Run from the repo root: node database/migrations/008-migrate-work-session-date-time.cjs
// (MONGODB_URI from the environment, falling back to backend/.env)

const path = require('node:path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });

function dayKeyInTz(date, timezone) {
    if (!timezone) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function timeKeyInTz(date, timezone) {
    if (!timezone) {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(date);
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

    const settings = await db
        .collection('appsettings')
        .findOne({}, { projection: { timezone: 1 } });
    const timezone = settings && settings.timezone ? settings.timezone : null;
    console.log(
        `worksessions: converting timestamps using timezone ${
            timezone || '(server local)'
        }`
    );

    const cursor = db
        .collection('worksessions')
        .find({ time: { $exists: false }, timestamp: { $exists: true } });

    let converted = 0;
    let skipped = 0;
    for await (const doc of cursor) {
        if (!(doc.timestamp instanceof Date)) {
            skipped++;
            continue;
        }
        const date = dayKeyInTz(doc.timestamp, timezone);
        const time = timeKeyInTz(doc.timestamp, timezone);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
            skipped++;
            continue;
        }
        await db.collection('worksessions').updateOne(
            { _id: doc._id },
            { $set: { date, time } }
        );
        converted++;
    }
    console.log(
        `worksessions: converted ${converted} document(s), skipped ${skipped}`
    );

    // Index swap: the instant-based indexes no longer match the query shapes.
    const collection = db.collection('worksessions');
    for (const name of ['userId_1_timestamp_-1', 'timestamp_-1']) {
        try {
            await collection.dropIndex(name);
            console.log(`worksessions: dropped index ${name}`);
        } catch (err) {
            if (err.codeName !== 'IndexNotFound') throw err;
        }
    }
    await collection.createIndex({ userId: 1, date: -1, time: -1 });
    await collection.createIndex({ date: -1, time: -1 });
    console.log('worksessions: created userId_1_date_-1_time_-1, date_-1_time_-1');

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
