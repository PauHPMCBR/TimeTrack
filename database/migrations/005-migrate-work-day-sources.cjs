#!/usr/bin/env node
// 005 — Per-session `source` → per-(user, day) records (`workdaysources`):
// backfill each day's source from its earliest active session, then strip the
// deprecated per-session field from all documents. Idempotent; the day bucket
// is computed in the company timezone from `appsettings`.
//
// Run from the repo root: node database/migrations/005-migrate-work-day-sources.cjs
// (MONGODB_URI from the environment, falling back to backend/.env)

const path = require('node:path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });

const SOURCES = ['userClick', 'userAutomatic', 'userManual', 'adminManual'];

// Local "YYYY-MM-DD" day key of a stored instant in the company timezone.
// Falls back to the server's local time when the company has no timezone.
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

    // 1. Index: one day-source record per (user, local day key).
    await db
        .collection('workdaysources')
        .createIndex({ userId: 1, date: 1 }, { unique: true });
    console.log('workdaysources: index userId_1_date_1 (unique) created');

    // 2. Backfill day sources from the active sessions of each day. The day
    // bucket is computed per session in the company timezone, so the scan is
    // per user (one query per user, sorted by timestamp).
    const settings = await db
        .collection('appsettings')
        .findOne({}, { projection: { timezone: 1 } });
    const timezone = settings && settings.timezone ? settings.timezone : null;

    const userIds = await db
        .collection('worksessions')
        .distinct('userId', { status: { $ne: 'replaced' } });

    let created = 0;
    for (const userId of userIds) {
        const sessions = await db
            .collection('worksessions')
            .find(
                { userId, status: { $ne: 'replaced' } },
                { projection: { timestamp: 1, source: 1 } }
            )
            .sort({ timestamp: 1 })
            .toArray();
        const seen = new Set();
        for (const session of sessions) {
            const date = dayKeyInTz(session.timestamp, timezone);
            if (seen.has(date)) continue;
            seen.add(date);
            const source = SOURCES.includes(session.source)
                ? session.source
                : 'userClick';
            const result = await db.collection('workdaysources').updateOne(
                { userId, date },
                {
                    $setOnInsert: {
                        userId,
                        date,
                        source,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                },
                { upsert: true }
            );
            created += result.upsertedCount;
        }
    }
    console.log(`workdaysources: backfilled ${created} day(s) from active sessions`);

    // 3. The per-chip source is deprecated: drop it from every session
    // document now that the day-level records carry the provenance.
    const cleaned = await db.collection('worksessions').updateMany(
        { source: { $exists: true } },
        { $unset: { source: '' } }
    );
    console.log(
        `worksessions: stripped source from ${cleaned.modifiedCount} document(s)`
    );

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
