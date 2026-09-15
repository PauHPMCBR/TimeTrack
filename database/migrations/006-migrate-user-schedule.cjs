#!/usr/bin/env node
// 006 — Backfill weeklyExpectedHours (0h weekend, 8h weekdays), scheduleMode
// (hours) and timetable (09:00-17:00 Mon-Fri) on documents created before
// those fields existed.
//
// Run from the repo root: node database/migrations/006-migrate-user-schedule.cjs
// (MONGODB_URI from the environment, falling back to backend/.env)

const path = require('node:path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });

const USER_COL = 'users';

const DEFAULT_TIMETABLE = [
    [],
    [
        { checkIn: '09:00', checkOut: '17:00' },
    ],
    [
        { checkIn: '09:00', checkOut: '17:00' },
    ],
    [
        { checkIn: '09:00', checkOut: '17:00' },
    ],
    [
        { checkIn: '09:00', checkOut: '17:00' },
    ],
    [
        { checkIn: '09:00', checkOut: '17:00' },
    ],
    [],
];

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

    const result = await db.collection(USER_COL).updateMany(
        {
            $or: [
                { scheduleMode: { $exists: false } },
                { timetable: { $exists: false } },
                { weeklyExpectedHours: { $exists: false } },
            ],
        },
        {
            $set: {
                scheduleMode: 'hours',
                timetable: DEFAULT_TIMETABLE,
                weeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0],
                updatedAt: new Date(),
            },
        }
    );

    console.log(`Backfilled schedule fields for ${result.modifiedCount} user(s).`);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
