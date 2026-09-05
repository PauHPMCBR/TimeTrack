#!/usr/bin/env mongosh
// Migration: per-day elective vacations → interval documents (startDate /
// endDate / spentDays). DESTRUCTIVE: every existing elective vacation request
// is deleted, because per-day rows cannot be losslessly merged into intervals.
// Only run this when losing elective vacation requests is acceptable.
//
// Runs the same steps on every company database (`myapp` for dev, `myapp_*`
// for production, see deploy-docs/04): 
//   1. Deletes every document in `electivevacations`.
//   2. Replaces the per-day indexes with the interval ones (same set as
//      backend/src/models/index.ts; production runs with autoIndex=false, so
//      creating them here avoids needing the indexes/sync endpoint).
//   3. Removes the obsolete `selectedElectiveDays` field from the
//      `yearlyvacationdays` templates (the spent-days balance is now computed
//      from the requests themselves; obligatory days / day counts are kept).
//
// Non-vacation data (users, groups, work sessions, yearly templates) is not
// touched. Safe to re-run (idempotent).

const dbs = db.getMongo()
  .getDBNames()
  .filter((name) => name === 'myapp' || name.startsWith('myapp_'));

for (const name of dbs) {
  const target = db.getSiblingDB(name);
  print(`\n=== ${name} ===`);

  // 1. Wipe elective vacation requests.
  const wiped = target.electivevacations.deleteMany({});
  print(`electivevacations: deleted ${wiped.deletedCount} document(s)`);

  // 2. Indexes: drop the per-day ones (ignore if absent), create the interval
  // ones.
  ['userId_1_date_1', 'status_1_date_1', 'date_1'].forEach((indexName) => {
    try {
      target.electivevacations.dropIndex(indexName);
      print(`electivevacations: dropped index ${indexName}`);
    } catch (e) {
      print(`electivevacations: index ${indexName} not present, skipping`);
    }
  });
  target.electivevacations.createIndex({ userId: 1, startDate: 1 });
  target.electivevacations.createIndex({
    userId: 1,
    status: 1,
    startDate: 1,
    endDate: 1,
  });
  target.electivevacations.createIndex({ startDate: 1 });
  print('electivevacations: interval indexes created');

  // 3. Drop the obsolete counter field from every yearly template.
  const cleaned = target.yearlyvacationdays.updateMany(
    { selectedElectiveDays: { $exists: true } },
    { $unset: { selectedElectiveDays: '' } }
  );
  print(`yearlyvacationdays: cleaned ${cleaned.modifiedCount} document(s)`);
}

print('\nMigration completed.');
print('NOTE: a company whose current year has no global yearly template');
print('(yearlyvacationdays, no userId) must create one via the admin panel');
print('before its users can request vacations.');
