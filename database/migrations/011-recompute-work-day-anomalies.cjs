#!/usr/bin/env node
// 011 — Recompute the cached `anomalies` of every WorkDayRecord from the day's
// live sessions and the record's own frozen expectations (classification,
// checkMode, timetableIntervals, expectedHours, tolerances). Fixes records
// whose anomalies were computed by an older/buggy algorithm; admin-frozen
// classifications and expectations are preserved (only `anomalies`,
// `computedAt` and `updatedAt` change). Idempotent: a record is only written
// when its anomaly set actually differs.
//
// The anomaly algorithm is inlined here on purpose: migrations run as plain
// CommonJS inside the production backend container (mongo is internal-only),
// where the TypeScript shared sources are not runnable. Keep this in sync with
// shared/src/lib/day-record.ts, shared/src/lib/work-hours.ts and
// shared/src/lib/expected-timetable.ts if the algorithm ever changes.
//
// Run from the repo root: node database/migrations/011-recompute-work-day-anomalies.cjs
// (MONGODB_URI from the environment, falling back to backend/.env)

const path = require('node:path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });

const CHECK_IN = 'check_in';
const CHECK_OUT = 'check_out';

function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

function isWithinTolerance(workedHours, expectedHours, toleranceMinutes) {
    const tolerance = Math.max(0, toleranceMinutes) / 60;
    return (
        workedHours >= expectedHours - tolerance &&
        workedHours <= expectedHours + tolerance
    );
}

function computeDayHours(sessions, countOpenUntil) {
    let totalMinutes = 0;
    let overtimeMinutes = 0;
    const anomalies = [];
    let pendingCheckIn = null;
    let pendingOvertime = false;

    for (const session of sessions) {
        if (session.type === CHECK_IN) {
            if (pendingCheckIn) anomalies.push('forgot_check_out');
            pendingCheckIn = session.time;
            pendingOvertime = session.overtime === true;
        } else if (session.type === CHECK_OUT) {
            if (pendingCheckIn) {
                const minutes =
                    timeToMinutes(session.time) - timeToMinutes(pendingCheckIn);
                totalMinutes += minutes;
                if (pendingOvertime || session.overtime === true) {
                    overtimeMinutes += minutes;
                }
                pendingCheckIn = null;
                pendingOvertime = false;
            } else {
                anomalies.push('forgot_check_in');
            }
        }
    }

    if (pendingCheckIn) {
        anomalies.push('forgot_check_out');
        if (countOpenUntil) {
            const minutes = Math.max(
                0,
                timeToMinutes(countOpenUntil) - timeToMinutes(pendingCheckIn)
            );
            totalMinutes += minutes;
            if (pendingOvertime) overtimeMinutes += minutes;
        }
    }

    const round = (raw) => Math.round(raw * 100) / 100;
    return {
        totalHours: round(Math.max(0, totalMinutes / 60)),
        overtimeHours: round(Math.max(0, overtimeMinutes / 60)),
        anomalies,
    };
}

function computePairDeviations(pairs, intervals, toleranceMinutes) {
    const tolerance = Math.max(0, toleranceMinutes);
    return pairs.map((pair, i) => {
        const interval = intervals[i];
        if (!interval) {
            return {
                checkInLate: false,
                checkInEarly: false,
                checkOutLate: false,
                checkOutEarly: false,
            };
        }
        const checkInDelta = pair.checkIn - timeToMinutes(interval.checkIn);
        const checkOutDelta = pair.checkOut - timeToMinutes(interval.checkOut);
        return {
            checkInLate: checkInDelta > tolerance,
            checkInEarly: -checkInDelta > tolerance,
            checkOutLate: checkOutDelta > tolerance,
            checkOutEarly: -checkOutDelta > tolerance,
        };
    });
}

function computeTimetableAnomalies(sessions, intervals, toleranceMinutes) {
    const anomalies = [];
    const sorted = [...sessions].sort((a, b) =>
        a.time.localeCompare(b.time)
    );
    const pairs = [];
    let pendingCheckIn = null;
    for (const session of sorted) {
        if (session.type === CHECK_IN) {
            pendingCheckIn = timeToMinutes(session.time);
        } else if (session.type === CHECK_OUT && pendingCheckIn !== null) {
            pairs.push({
                checkIn: pendingCheckIn,
                checkOut: timeToMinutes(session.time),
            });
            pendingCheckIn = null;
        }
    }

    for (const deviation of computePairDeviations(
        pairs,
        intervals,
        toleranceMinutes
    )) {
        if (deviation.checkInLate) anomalies.push('timetable_check_in_late');
        if (deviation.checkInEarly) anomalies.push('timetable_check_in_early');
        if (deviation.checkOutLate) anomalies.push('timetable_check_out_late');
        if (deviation.checkOutEarly) anomalies.push('timetable_check_out_early');
    }
    if (pairs.length !== intervals.length) {
        anomalies.push('timetable_shift_count');
    }
    return anomalies;
}

function computeWorkDayAnomalies(sessions, record) {
    if (record.classification !== 'workday') {
        return sessions.length > 0 ? ['work_on_non_working_day'] : [];
    }

    const { totalHours, overtimeHours, anomalies } = computeDayHours(
        sessions,
        '24:00'
    );
    const anomalySet = new Set(anomalies);
    const intervals = record.timetableIntervals ?? [];

    if (record.checkMode === 'timetable' && intervals.length > 0) {
        for (const anomaly of computeTimetableAnomalies(
            sessions,
            intervals,
            record.timetableToleranceMinutes
        )) {
            anomalySet.add(anomaly);
        }
    } else if (anomalySet.size === 0) {
        if (record.expectedHours === 0) {
            anomalySet.add('hours_short');
        } else {
            const regularHours = totalHours - overtimeHours;
            if (regularHours === 0) {
                anomalySet.add('hours_short');
            } else if (
                !isWithinTolerance(
                    regularHours,
                    record.expectedHours,
                    record.toleranceMinutes
                )
            ) {
                anomalySet.add(
                    regularHours < record.expectedHours
                        ? 'hours_short'
                        : 'hours_over'
                );
            }
        }
    }

    return Array.from(anomalySet);
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

    const records = db.collection('workdayrecords');
    const sessions = db.collection('workdaysessions');

    // Preload the live sessions of every (user, day) so the record scan does
    // not issue one query per document.
    const sessionsByUserDay = new Map();
    for await (const day of sessions.find(
        { status: { $ne: 'replaced' } },
        { projection: { userId: 1, date: 1, sessions: 1 } }
    )) {
        sessionsByUserDay.set(
            `${day.userId}|${day.date}`,
            Array.isArray(day.sessions) ? day.sessions : []
        );
    }

    let scanned = 0;
    let changed = 0;
    for await (const record of records.find({})) {
        scanned++;
        const daySessions =
            sessionsByUserDay.get(`${record.userId}|${record.date}`) ?? [];
        const next = computeWorkDayAnomalies(daySessions, record);
        const previous = Array.isArray(record.anomalies)
            ? record.anomalies
            : [];

        if (JSON.stringify(previous) !== JSON.stringify(next)) {
            await records.updateOne(
                { _id: record._id },
                {
                    $set: {
                        anomalies: next,
                        computedAt: new Date(),
                        updatedAt: new Date(),
                    },
                }
            );
            changed++;
        }
    }

    console.log(
        `workdayrecords: scanned ${scanned}, updated ${changed} document(s)`
    );
    console.log('\nMigration completed.');
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
