#!/usr/bin/env mongosh
// Migration: per-day elective vacations → interval documents (startDate /
// endDate / spentDays). DESTRUCTIVE: every existing elective vacation request
// is deleted, because per-day rows cannot be losslessly merged into intervals.
// Only run this when losing elective vacation requests is acceptable.
//
// What it does:
//   1. Deletes every document in `electivevacations`.
//   2. Replaces the per-day indexes with the interval ones.
//   3. Removes the obsolete `selectedElectiveDays` field from the
//      `yearlyvacationdays` templates (the spent-days balance is now computed
//      from the requests themselves; obligatory days / day counts are kept).
//
// Non-vacation data (users, groups, work sessions, yearly templates) is not
// touched.

use('myapp');

// 1. Wipe elective vacation requests.
const wiped = db.electivevacations.deleteMany({});
print(`electivevacations: deleted ${wiped.deletedCount} document(s)`);

// 2. Indexes: drop the per-day ones (ignore errors if already absent), then
// create the interval ones (same set as database/mongo-init.js).
['userId_1_date_1', 'status_1_date_1', 'date_1'].forEach((name) => {
  try {
    db.electivevacations.dropIndex(name);
    print(`electivevacations: dropped index ${name}`);
  } catch (e) {
    print(`electivevacations: index ${name} not present, skipping`);
  }
});
db.electivevacations.createIndex({ userId: 1, startDate: 1 });
db.electivevacations.createIndex({ userId: 1, status: 1, startDate: 1, endDate: 1 });
db.electivevacations.createIndex({ startDate: 1 });
print('electivevacations: interval indexes created');

// 3. Drop the obsolete counter field from every yearly template.
const cleaned = db.yearlyvacationdays.updateMany(
  { selectedElectiveDays: { $exists: true } },
  { $unset: { selectedElectiveDays: '' } }
);
print(`yearlyvacationdays: cleaned ${cleaned.modifiedCount} document(s)`);

print('Migration completed.');
print('NOTE: yearly templates without electiveDaysTotalCount/obligatoryDays');
print('must be filled in via the admin panel before users can request vacations.');
