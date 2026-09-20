#!/usr/bin/env node
// 009 — Per-punch `worksessions` documents → per-(user, day) `workdaysessions`
// documents. Each new document wraps a whole day version: `sessions` (ordered
// by wall-clock time, each just {type, time, notesEncrypted?, overtime}),
// `source` (merged from `workdaysources`), `version`, `status`,
// `editedBy`/`editReason`/`replacedByVersion`/`replacedAt` — fields that used
// to be duplicated on every session document. Handles legacy docs that still
// carry only `timestamp` (migration 008 not yet run) by deriving date/time in
// the company timezone from `appsettings` (default Europe/Madrid). The old
// collections are left untouched as a historical archive. Idempotent: skipped
// when `workdaysessions` already holds documents.
//
// Run from the repo root: node database/migrations/009-migrate-work-day-sessions.cjs
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

function minutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
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

    const existing = await db
        .collection('workdaysessions')
        .estimatedDocumentCount();
    if (existing > 0) {
        console.log(
            `workdaysessions: already holds ${existing} document(s) — nothing to do`
        );
        await mongoose.disconnect();
        return;
    }

    const settings = await db
        .collection('appsettings')
        .findOne({}, { projection: { timezone: 1 } });
    const timezone = settings && settings.timezone ? settings.timezone : null;

    const sources = {};
    for (const row of await db.collection('workdaysources').find({}).toArray()) {
        sources[`${row.userId}:${row.date}`] = row.source;
    }

    // Group every legacy session into (userId, date) → version → day draft.
    const days = new Map();
    let skipped = 0;
    const cursor = db.collection('worksessions').find({});
    for await (const doc of cursor) {
        let date = doc.date;
        let time = doc.time;
        if (!date || !time) {
            if (!(doc.timestamp instanceof Date)) {
                skipped++;
                continue;
            }
            date = dayKeyInTz(doc.timestamp, timezone);
            time = timeKeyInTz(doc.timestamp, timezone);
        }
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            !/^\d{2}:\d{2}$/.test(time)
        ) {
            skipped++;
            continue;
        }
        const dayKey = `${doc.userId}:${date}`;
        if (!days.has(dayKey)) days.set(dayKey, new Map());
        const versions = days.get(dayKey);
        const version = Number(doc.version ?? 1);
        if (!versions.has(version)) {
            versions.set(version, {
                status: doc.status ?? 'active',
                sessions: [],
                editReasonEncrypted: doc.editReasonEncrypted,
                editedBy: doc.editedBy,
                replacedByVersion: doc.replacedByVersion,
                replacedAt: doc.replacedAt,
                createdAt: doc.createdAt,
            });
        }
        const draft = versions.get(version);
        draft.sessions.push({
            type: doc.type,
            time,
            ...(doc.notesEncrypted ? { notesEncrypted: doc.notesEncrypted } : {}),
            overtime: doc.overtime === true,
        });
        if (
            doc.createdAt instanceof Date &&
            (!draft.createdAt || doc.createdAt < draft.createdAt)
        ) {
            draft.createdAt = doc.createdAt;
        }
        if (draft.status === 'active' && doc.status) draft.status = doc.status;
    }

    const docs = [];
    for (const [dayKey, versions] of days) {
        const [userId, date] = dayKey.split(':');
        const source = sources[dayKey] ?? 'userClick';
        for (const [version, draft] of [...versions.entries()].sort(
            (a, b) => a[0] - b[0]
        )) {
            draft.sessions.sort(
                (a, b) => minutes(a.time) - minutes(b.time)
            );
            docs.push({
                userId,
                date,
                sessions: draft.sessions,
                source,
                version,
                status: draft.status === 'replaced' ? 'replaced' : 'active',
                editedBy: draft.editedBy ?? '',
                ...(draft.editReasonEncrypted
                    ? { editReasonEncrypted: draft.editReasonEncrypted }
                    : {}),
                ...(draft.replacedByVersion
                    ? { replacedByVersion: draft.replacedByVersion }
                    : {}),
                ...(draft.replacedAt ? { replacedAt: draft.replacedAt } : {}),
                createdAt: draft.createdAt ?? new Date(),
                updatedAt: new Date(),
            });
        }
    }

    if (docs.length > 0) {
        await db.collection('workdaysessions').insertMany(docs);
    }
    console.log(
        `workdaysessions: created ${docs.length} day document(s) from worksessions (skipped ${skipped})`
    );

    const collection = db.collection('workdaysessions');
    await collection.createIndex({ userId: 1, date: 1, version: -1 });
    await collection.createIndex({ date: -1 });
    console.log('workdaysessions: indexes created');

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
