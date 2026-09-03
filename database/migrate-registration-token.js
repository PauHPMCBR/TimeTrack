#!/usr/bin/env mongosh
// Backfill registrationToken: null → '' so the Mongoose required validator
// no longer rejects existing documents.

use('myapp');

const result = db.users.updateMany(
  { registrationToken: null },
  { $set: { registrationToken: '' } }
);

print(`Updated ${result.modifiedCount} user(s) with registrationToken: null → ''`);
