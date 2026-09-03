#!/usr/bin/env node
// Migration: backfill the User `trackingStartDate` field for existing users.
// For users who already have work sessions, the tracking start is the
// timestamp of their first ever check-in (or earliest work session if no
// check-in counter is available). Users with no work sessions fall back to
// their createdAt (account creation). The field is non-nullable going forward.
//
// Usage (from the backend workspace):
//
//   cd backend && npm run migrate:tracking-start
//
// It reads MONGODB_URI from the environment, falling back to backend/.env.

const path = require('node:path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const WORK_SESSION_COL = 'worksessions';
const USER_COL = 'users';

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error(
            'MONGODB_URI not found. Set it in the environment or backend/.env'
        );
        process.exit(1);
    }

    await mongoose.connect(uri);
    const db = mongoose.connection;

    // Users that have no trackingStartDate yet. For each, find the timestamp
    // of their first ever work session and use it; otherwise fall back to
    // createdAt.
    const usersWithoutStart = await db
        .collection(USER_COL)
        .find({ trackingStartDate: { $exists: false } })
        .project({ _id: 1, createdAt: 1 })
        .toArray();

    let backfilled = 0;
    let fallbackToCreatedAt = 0;

    for (const user of usersWithoutStart) {
        const firstSession = await db
            .collection(WORK_SESSION_COL)
            .find({ userId: user._id.toString() })
            .sort({ timestamp: 1 })
            .limit(1)
            .project({ timestamp: 1 })
            .toArray();

        let startDate;
        if (firstSession.length > 0) {
            startDate = new Date(firstSession[0].timestamp);
            backfilled++;
        } else {
            // No work sessions ever: default to when the account was created.
            startDate = user.createdAt ? new Date(user.createdAt) : new Date();
            fallbackToCreatedAt++;
        }

        await db.collection(USER_COL).updateOne(
            { _id: user._id },
            { $set: { trackingStartDate: startDate, updatedAt: new Date() } }
        );
    }

    console.log(
        `Backfilled trackingStartDate for ${backfilled} user(s) (from first work session).`
    );
    console.log(
        `${fallbackToCreatedAt} user(s) had no work sessions and were set to their createdAt.`
    );
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
