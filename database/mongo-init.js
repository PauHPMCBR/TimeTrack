// MongoDB initialization script (runs inside the official mongo image on first start).
//
// Credentials come from environment variables set in docker-compose.yml:
//   - Root user is created automatically by the mongo image entrypoint from
//     MONGO_INITDB_ROOT_USERNAME / MONGO_INITDB_ROOT_PASSWORD.
//   - Application user is created here from MONGO_APP_USER / MONGO_APP_PASSWORD.
//
// Demo data (groups + admin account) is only seeded when SEED_DEMO=1.
// Demo accounts share the password whose bcrypt hash must be provided via
// DEMO_PASSWORD_HASH (mongosh cannot hash bcrypt itself). Generate it with:
//   cd backend && node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 12))"

const APP_USER = process.env.MONGO_APP_USER || 'alumne';
const APP_PASSWORD = process.env.MONGO_APP_PASSWORD;
if (!APP_PASSWORD) {
  throw new Error('MONGO_APP_PASSWORD environment variable is required');
}

print('Starting database initialization...');

db = db.getSiblingDB('myapp');
print('myapp database created');

db.createCollection('users');
db.createCollection('groups');
db.createCollection('worksessions');
db.createCollection('workdaysources');
db.createCollection('electivevacations');
db.createCollection('yearlyvacationdays');
db.createCollection('worksessionreasons');
db.createCollection('appsettings');
db.createCollection('userfiles');
db.createCollection('monthlyapprovals');
db.createCollection('monthlyapprovalevents');
db.createCollection('auditevents');
print('Collections created');

// Mirror the indexes declared in backend/src/models/index.ts. They are created
// here (not left to Mongoose autoIndex) because production runs with
// autoIndex=false; the /api/admin/indexes/sync endpoint is the manual fallback.
print('Creating indexes...');
db.users.createIndex({ email: 1, registered: 1 });
db.users.createIndex({ registrationToken: 1 });
db.worksessions.createIndex({ userId: 1, timestamp: -1 });
db.worksessions.createIndex({ timestamp: -1 });
// One day-source record per (user, local day key).
db.workdaysources.createIndex({ userId: 1, date: 1 }, { unique: true });
db.electivevacations.createIndex({ userId: 1, startDate: 1 });
db.electivevacations.createIndex({ userId: 1, status: 1, startDate: 1, endDate: 1 });
db.electivevacations.createIndex({ startDate: 1 });
db.groups.createIndex({ members: 1, name: 1 });
// userId is absent on the global template rows; a missing field indexes as null,
// so one global template per year and one per-user row per year are enforced.
db.yearlyvacationdays.createIndex({ userId: 1, year: 1 }, { unique: true });
db.yearlyvacationdays.createIndex({ year: 1 });
db.userfiles.createIndex({ userId: 1, uploadedAt: -1 });
// Covered index for the storage-quota aggregate (sum of size across all docs).
db.userfiles.createIndex({ size: 1 });
db.monthlyapprovals.createIndex({ userId: 1, year: 1, month: 1 }, { unique: true });
db.monthlyapprovals.createIndex({ status: 1, requestedAt: 1 });
db.monthlyapprovalevents.createIndex({ userId: 1, year: 1, month: 1, timestamp: 1 });
db.auditevents.createIndex({ timestamp: -1 });
print('Indexes created');

try {
  db.createUser({
    user: APP_USER,
    pwd: APP_PASSWORD,
    roles: [{ role: 'readWrite', db: 'myapp' }]
  });
  print(`Application user "${APP_USER}" created in myapp database`);
} catch (e) {
  // dropDatabase() leaves existing users behind (re-runs on a used volume):
  // realign the password with the provided one instead of failing.
  db.updateUser(APP_USER, { pwd: APP_PASSWORD });
  print(`Application user "${APP_USER}" already existed — password updated`);
}

if (process.env.SEED_DEMO === '1') {
  const DEMO_PASSWORD_HASH = process.env.DEMO_PASSWORD_HASH;
  if (!DEMO_PASSWORD_HASH) {
    throw new Error('SEED_DEMO=1 requires DEMO_PASSWORD_HASH to be set');
  }

  print('Seeding demo data...');

  const now = new Date();

  // --- Field encryption for demo users (same format as backend/src/lib/crypto) -
  // The backend looks users up by deterministic HMAC hash and reads the
  // AES-256-GCM ciphertext, so a seeded account without them cannot log in.
  // Requires ENCRYPTION_KEY / HASH_KEY (same values as backend/.env).
  const nodeCrypto = require('crypto');
  const ENC_PREFIX = 'enc:v1:';
  const loadKey = (name) => {
    const raw = process.env[name];
    if (!raw) return null;
    return /^[0-9a-fA-F]{64}$/.test(raw)
      ? Buffer.from(raw, 'hex')
      : nodeCrypto.createHash('sha256').update(raw, 'utf8').digest();
  };
  const ENC_KEY = loadKey('ENCRYPTION_KEY');
  const HASH_KEY = loadKey('HASH_KEY');
  const canEncryptDemo = !!ENC_KEY && !!HASH_KEY;
  const encryptValue = (plaintext) => {
    const iv = nodeCrypto.randomBytes(12);
    const cipher = nodeCrypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
    const data = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return `${'enc:v1:'}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
  };
  const lookupHash = (value) =>
    nodeCrypto
      .createHmac('sha256', HASH_KEY)
      .update((value ?? '').trim().toLowerCase())
      .digest('hex');
  const secretFields = (email, dni) => {
    if (!canEncryptDemo) return { email, dni };
    return {
      emailEncrypted: encryptValue(email),
      emailHash: lookupHash(email),
      dniEncrypted: encryptValue(dni),
      dniHash: lookupHash(dni),
    };
  };

  // --- Object ids referenced across collections ---------------------------------
  const ids = {
    anna: ObjectId(), berta: ObjectId(), carles: ObjectId(),
    diana: ObjectId(), marc: ObjectId(), elena: ObjectId(), admin: ObjectId(),
  };
  const groups = { dev: ObjectId(), design: ObjectId(), marketing: ObjectId() };

  // --- Time helpers (all instants encode Europe/Madrid wall-clock times) --------
  const MADRID_TZ = 'Europe/Madrid';
  const pad2 = (n) => String(n).padStart(2, '0');
  const dateKeyOf = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

  const nowParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MADRID_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  const nowPart = (t) => Number(nowParts.find((p) => p.type === t).value);

  // Minutes the company timezone is ahead of UTC at a given instant (60 in
  // winter, 120 under DST) — probed via Intl so DST boundaries are handled.
  const madridOffsetMin = (utcMs) => {
    const p = new Intl.DateTimeFormat('en-GB', {
      timeZone: MADRID_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(utcMs));
    const g = (t) => Number(p.find((x) => x.type === t).value);
    return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - utcMs) / 60000;
  };

  // UTC instant that displays as the given Madrid wall-clock time (months are
  // 1-based, matching dateKeyOf/relKey). Two fixed-point rounds settle DST.
  const mad = (y, m, d, hh = 0, mm = 0) => {
    let guess = Date.UTC(y, m - 1, d, hh, mm);
    guess = Date.UTC(y, m - 1, d, hh, mm) - madridOffsetMin(guess) * 60000;
    guess = Date.UTC(y, m - 1, d, hh, mm) - madridOffsetMin(guess) * 60000;
    return new Date(guess);
  };

  // Calendar day `offset` days from today, in Madrid terms.
  const rel = (offset) => {
    const d = new Date(Date.UTC(nowPart('year'), nowPart('month') - 1, nowPart('day')));
    d.setUTCDate(d.getUTCDate() + offset);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay() };
  };
  const relAt = (offset, hh = 0, mm = 0) => {
    const p = rel(offset);
    return mad(p.y, p.m, p.d, hh, mm);
  };
  const relKey = (offset) => {
    const p = rel(offset);
    return dateKeyOf(p.y, p.m, p.d);
  };

  // --- Company obligatory holidays (current + previous year templates) ---------
  const seedYear = rel(0).y;
  const prevYear = seedYear - 1;
  const fixedDay = (year, month, day) => new Date(Date.UTC(year, month - 1, day));
  // Most recent Thursday strictly before today (for the moving demo holiday).
  const daysSinceThursday = (rel(0).dow + 3) % 7;
  const obligatoryDaysByYear = {
    [seedYear]: [
      fixedDay(seedYear, 1, 1),   // Any Nou
      fixedDay(seedYear, 5, 1),   // Dia del treballador
      fixedDay(seedYear, 6, 24),  // Sant Joan
      fixedDay(seedYear, 8, 15),  // Assumpció
      fixedDay(seedYear, 9, 11),  // Diada
      fixedDay(seedYear, 11, 1),  // Tots Sants
      fixedDay(seedYear, 12, 25), // Nadal
      fixedDay(seedYear, 12, 26), // Sant Esteve
      // Moving demo holiday: most recent Thursday strictly before today, so
      // the admin view always has a recent obligatory day whatever the date.
      (() => {
        const p = rel(-(daysSinceThursday === 0 ? 7 : daysSinceThursday));
        return fixedDay(p.y, p.m, p.d);
      })()
    ].sort((a, b) => a.getTime() - b.getTime()),
    [prevYear]: [
      fixedDay(prevYear, 1, 1),
      fixedDay(prevYear, 4, 21),  // Dilluns de Pasqua
      fixedDay(prevYear, 8, 15),
      fixedDay(prevYear, 11, 1),
      fixedDay(prevYear, 12, 25),
      fixedDay(prevYear, 12, 26)
    ]
  };
  const obligatoryKeys = new Set();
  for (const days of Object.values(obligatoryDaysByYear)) {
    for (const day of days) obligatoryKeys.add(dateKeyOf(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()));
  }
  const isCompanyWorkday = (p) =>
    p.dow !== 0 && p.dow !== 6 &&
    !obligatoryKeys.has(dateKeyOf(p.y, p.m, p.d));

  // Past weekday offsets (most recent first), skipping weekends and holidays.
  const weekdayOffsets = [];
  {
    let n = 1;
    while (weekdayOffsets.length < 10) {
      const p = rel(-n);
      if (isCompanyWorkday(p)) weekdayOffsets.push(-n);
      n++;
    }
  }
  const [w0, w1, w2, w3, w4, w5, w6, w7] = weekdayOffsets;

  // Future weekday offsets (next first).
  const futureWeekdayOffsets = [];
  {
    let n = 1;
    while (futureWeekdayOffsets.length < 6) {
      const p = rel(n);
      if (isCompanyWorkday(p)) futureWeekdayOffsets.push(n);
      n++;
    }
  }
  const [f0, f1, f2, f3] = futureWeekdayOffsets;

  // --- Groups -------------------------------------------------------------------
  // `members`/`groups` are declared as string arrays in the shared Group/User
  // schemas, so the seed stores ObjectIds as their string form to stay type-
  // consistent (queries like `Group.find({ members: userId })` rely on it).
  db.groups.insertMany([
    { _id: groups.dev, name: 'Development', description: 'Software development team', members: [ids.anna, ids.carles, ids.elena].map(String), createdAt: now, updatedAt: now },
    { _id: groups.design, name: 'Design', description: 'UI/UX design team', members: [ids.berta, ids.marc].map(String), createdAt: now, updatedAt: now },
    { _id: groups.marketing, name: 'Marketing', description: 'Marketing and communications', members: [ids.diana].map(String), createdAt: now, updatedAt: now }
  ]);
  print('Demo groups created');

  // --- Employees (registered, can log in with the demo password) ---------------
  const weekly = (perWorkingDay) => [0, perWorkingDay, perWorkingDay, perWorkingDay, perWorkingDay, perWorkingDay, 0];
  // Monday–Friday timetables (index 0 = Sunday … 6 = Saturday).
  const splitTimetable = (ci1, co1, ci2, co2) => [
    [], ...Array.from({ length: 5 }, () => [
      { checkIn: ci1, checkOut: co1 }, { checkIn: ci2, checkOut: co2 }
    ]), []
  ];
  const continuousTimetable = (ci, co) => [
    [], ...Array.from({ length: 5 }, () => [{ checkIn: ci, checkOut: co }]), []
  ];

  const employee = (id, name, email, dni, weeklyExpectedHours, groupIds, extras = {}) => ({
    _id: id, name,
    password: DEMO_PASSWORD_HASH,
    registrationToken: '',
    registered: true,
    role: 'employee',
    groups: groupIds.map((g) => g.toString()),
    weeklyExpectedHours,
    failedLoginAttempts: 0,
    blocked: false,
    createdAt: now,
    updatedAt: now,
    ...secretFields(email, dni),
    ...extras
  });

  db.users.insertMany([
    employee(ids.anna, 'Anna Torres', 'anna@demo.com', '11111111A', weekly(8), [groups.dev]),
    employee(ids.berta, 'Berta Puig', 'berta@demo.com', '22222222B', weekly(7), [groups.design], {
      scheduleMode: 'timetable',
      timetable: splitTimetable('09:00', '13:00', '14:00', '17:00')
    }),
    employee(ids.carles, 'Carles Vila', 'carles@demo.com', '33333333C', weekly(7.5), [groups.dev]),
    employee(ids.diana, 'Diana Roca', 'diana@demo.com', '44444444D', weekly(8), [groups.marketing]),
    employee(ids.marc, 'Marc Soler', 'marc@demo.com', '55555555E', weekly(6), [groups.design], {
      scheduleMode: 'timetable',
      timetable: continuousTimetable('09:00', '15:00')
    }),
    employee(ids.elena, 'Elena Grau', 'elena@demo.com', '66666666F', weekly(8), [groups.dev])
  ]);
  print('Demo employees created (password: value of DEMO_PASSWORD_HASH)');
  if (!canEncryptDemo) {
    print(
      'WARNING: ENCRYPTION_KEY / HASH_KEY not provided — demo emails/dnis are stored in plaintext.'
    );
    print(
      'Run migrations/003-migrate-user-encryption.cjs afterwards, or set the keys in .env to match backend/.env.'
    );
  }

  // --- Work sessions ------------------------------------------------------------
  // August 2026 is fully populated with varied, realistic data: live punches
  // with jittered minutes, split shifts, declared overtime, missing
  // check-ins/outs, short days, self-applied auto timetables, worker
  // self-edits and an admin correction (with the superseded version kept).
  const sessions = [];
  // (user, dayKey) → source. Default userClick; replaced versions never touch it.
  const workDays = new Map();

  const push = (userId, type, ts, extra = {}) => {
    sessions.push({
      userId: userId.toString(), type, timestamp: ts,
      version: 1, status: 'active', overtime: false,
      createdAt: now, updatedAt: now, ...extra
    });
  };
  const sourceFor = (userId, key, source = 'userClick') => {
    if (!workDays.has(key)) workDays.set(key, source);
  };

  // August 2026 helpers (m=7). Session times are Madrid wall-clock.
  const AUG_DAYS = [3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 24, 25, 26, 27, 28, 31];
  const augKey = (userId, day) => `${userId.toString()}:2026-08-${pad2(day)}`;
  const aSess = (userId, day, type, hh, mm = 0, extra = {}) => {
    const { source, ...doc } = extra;
    push(userId, type, mad(2026, 8, day, hh, mm), doc);
    if ((doc.status ?? 'active') === 'active') {
      sourceFor(userId, augKey(userId, day), source ?? 'userClick');
    }
  };
  // Relative-day variants for the recent (September) data.
  const relDayKey = (userId, offset) => `${userId.toString()}:${relKey(offset)}`;
  const rSess = (userId, offset, type, hh, mm = 0) => {
    push(userId, type, relAt(offset, hh, mm));
    sourceFor(userId, relDayKey(userId, offset), 'userClick');
  };
  const rShift = (userId, offset, ci, co, ciM = 0, coM = 0) => {
    rSess(userId, offset, 'check_in', ci, ciM);
    rSess(userId, offset, 'check_out', co, coM);
  };
  const shift = (userId, day, ci, co, ciM = 0, coM = 0, extra = {}) => {
    aSess(userId, day, 'check_in', ci, ciM, extra);
    aSess(userId, day, 'check_out', co, coM, extra);
  };

  // Deterministic minute jitter so punches look hand-made.
  const JIT = [2, 6, 1, 4, 7, 3, 5, 0, 8, 2, 6, 1];
  const jit = (i) => JIT[i % JIT.length];

  // Anna (8h, hours mode): mostly regular days, a split-shift day, a declared
  // overtime day, a forgotten check-out, a short day, an admin-corrected day
  // and a worker self-edit (both keep the superseded version).
  {
    let i = 0;
    for (const day of AUG_DAYS) {
      const j = jit(i++);
      if (day === 4) {
        shift(ids.anna, day, 9, 13, 0, 0);            // lunch-break day (4h)
        shift(ids.anna, day, 14, 18, 5, 0);
      } else if (day === 12) {
        shift(ids.anna, day, 9, 17, 0, 0);            // regular 8h ...
        shift(ids.anna, day, 17, 19, 30, 30, { overtime: true }); // ... + declared overtime 17:30–19:30
      } else if (day === 14) {
        aSess(ids.anna, day, 'check_in', 9, 2);       // forgot_check_out
      } else if (day === 20) {
        shift(ids.anna, day, 9, 13, 0, 30);           // hours_short (4.5h)
      } else if (day === 24 || day === 28) {
        // Corrected days, seeded explicitly below (superseded version kept).
      } else if (day === 25) {
        shift(ids.anna, day, 9, 17, j, jit(i + 4));
        sessions[sessions.length - 2].notes = 'Reunió amb client extern';
      } else {
        shift(ids.anna, day, 9, 17, j, jit(i + 4));
      }
    }
    // Admin correction of Aug 24: original version kept as 'replaced'.
    shift(ids.anna, 24, 9, 18, 45, 15, {
      status: 'replaced', replacedByVersion: 2, replacedAt: now
    });
    shift(ids.anna, 24, 9, 17, 0, 0, {
      version: 2, editReason: 'Admin day correction', editedBy: ids.admin.toString()
    });
    workDays.set(augKey(ids.anna, 24), 'adminManual');
    // Worker self-edit of Aug 28.
    shift(ids.anna, 28, 9, 16, 45, 0, {
      status: 'replaced', replacedByVersion: 2, replacedAt: now
    });
    shift(ids.anna, 28, 9, 17, 0, 5, {
      version: 2, editReason: 'Forgot to check out', editedBy: ids.anna.toString()
    });
    workDays.set(augKey(ids.anna, 28), 'userManual');
  }

  // Berta (timetable mode, Mon–Fri 09:00–13:00 & 14:00–17:00): matching split
  // shifts, one self-applied auto timetable, one late check-in, one forgotten
  // check-out.
  {
    let i = 0;
    for (const day of AUG_DAYS) {
      const a = jit(i++), b = jit(i++), c = jit(i++), d = jit(i++);
      if (day === 6) {
        shift(ids.berta, day, 9, 13, 0, 0, {
          source: 'userAutomatic', notes: 'Horari automàtic aplicat',
          editedBy: ids.berta.toString()
        });
        shift(ids.berta, day, 14, 17, 0, 0, {
          source: 'userAutomatic', notes: 'Horari automàtic aplicat',
          editedBy: ids.berta.toString()
        });
        workDays.set(augKey(ids.berta, day), 'userAutomatic');
      } else if (day === 11) {
        shift(ids.berta, day, 9, 13, 25, 2);          // timetable_check_in_late
        shift(ids.berta, day, 14, 17, 0, b);
      } else if (day === 14) {
        aSess(ids.berta, day, 'check_in', 9, 0);      // forgot_check_out
      } else {
        shift(ids.berta, day, 9, 13, a, b);
        shift(ids.berta, day, 14, 17, c, d);
      }
    }
  }

  // Carles (7.5h, hours mode): regular days, one unflagged overtime day, one
  // fully missing day, a split-shift day, notes on one punch.
  {
    let i = 0;
    for (const day of AUG_DAYS) {
      const j = jit(i++);
      if (day === 13) {
        shift(ids.carles, day, 9, 18, 0, 0);          // hours_over (9h)
      } else if (day === 21) {
        // fully missing day → hours_short
      } else if (day === 27) {
        shift(ids.carles, day, 9, 13, 0, 0);
        shift(ids.carles, day, 14, 17, 30, 30);
      } else {
        shift(ids.carles, day, 9, 16, j, 30 + jit(i + 3));
        if (day === 12) sessions[sessions.length - 2].notes = 'Formació interna';
      }
    }
  }

  // Diana (8h, hours mode): approved vacation Aug 10–14, two fully missing
  // days, a split-shift day, otherwise regular.
  {
    let i = 0;
    for (const day of AUG_DAYS) {
      const j = jit(i++);
      if (day >= 10 && day <= 14) continue;           // approved vacation
      if (day === 3 || day === 20) continue;          // missing days → hours_short
      if (day === 18) {
        shift(ids.diana, day, 8, 12, 30, 30);
        shift(ids.diana, day, 13, 17, 30, 30);
      } else {
        shift(ids.diana, day, 9, 17, j, jit(i + 5));
      }
    }
  }

  // Marc (timetable mode, Mon–Fri 09:00–15:00): matching days, one early
  // check-out, one forgotten check-in, one self-applied auto timetable.
  {
    let i = 0;
    for (const day of AUG_DAYS) {
      const j = jit(i++);
      if (day === 11) {
        shift(ids.marc, day, 9, 14, j, 40);           // timetable_check_out_early
      } else if (day === 18) {
        shift(ids.marc, day, 9, 15, 0, 0, {
          source: 'userAutomatic', notes: 'Horari automàtic aplicat',
          editedBy: ids.marc.toString()
        });
        workDays.set(augKey(ids.marc, day), 'userAutomatic');
      } else if (day === 25) {
        aSess(ids.marc, day, 'check_out', 15, j);     // forgot_check_in
      } else {
        shift(ids.marc, day, 9, 15, j, jit(i + 2));
      }
    }
  }

  // Elena (8h, hours mode): approved vacation Aug 3–7, one auto-applied day,
  // otherwise regular.
  {
    let i = 0;
    for (const day of AUG_DAYS) {
      const j = jit(i++);
      if (day >= 3 && day <= 7) continue;             // approved vacation
      if (day === 20) {
        shift(ids.elena, day, 9, 17, 0, 0, {
          source: 'userAutomatic', notes: 'Horari automàtic aplicat',
          editedBy: ids.elena.toString()
        });
        workDays.set(augKey(ids.elena, day), 'userAutomatic');
      } else {
        shift(ids.elena, day, 9, 17, j, jit(i + 6));
      }
    }
  }

  // --- Recent days (relative to today, Madrid calendar) -------------------------
  // A few regular days per employee so the app always has current data.
  for (const offset of [w3, w2, w1, w0]) {
    rShift(ids.anna, offset, 9, 17, jit(-offset), jit(-offset + 1));
    rShift(ids.berta, offset, 9, 13, jit(-offset + 2), jit(-offset + 3));
    rShift(ids.berta, offset, 14, 17, jit(-offset + 4), jit(-offset + 5));
    rShift(ids.carles, offset, 9, 16, jit(-offset), 30 + jit(-offset + 6));
    rShift(ids.diana, offset, 9, 17, jit(-offset + 7), jit(-offset + 8));
    rShift(ids.marc, offset, 9, 15, jit(-offset + 9), jit(-offset + 10));
    rShift(ids.elena, offset, 9, 17, jit(-offset + 11), jit(-offset + 12));
  }
  // Live punches today (skipped when today is a weekend or a holiday).
  if (isCompanyWorkday(rel(0))) {
    rSess(ids.anna, 0, 'check_in', 9, 3);
    rSess(ids.berta, 0, 'check_in', 9, 0);
    rSess(ids.carles, 0, 'check_in', 8, 58);
  }

  db.worksessions.insertMany(sessions);
  print(`Work sessions created (${sessions.length} events)`);

  db.workdaysources.insertMany(
    [...workDays.entries()].map(([key, source]) => {
      const separator = key.indexOf(':');
      return {
        userId: key.slice(0, separator),
        date: key.slice(separator + 1),
        source,
        createdAt: now,
        updatedAt: now
      };
    })
  );
  print(`Work day sources created (${workDays.size} days)`);

  // --- Monthly record confirmation ----------------------------------------------
  // Anna confirmed her August record (locked); Carles has a pending request.
  db.monthlyapprovals.insertMany([
    {
      userId: ids.anna.toString(), year: 2026, month: 8, status: 'approved',
      requestedAt: mad(2026, 9, 1, 10, 0), openedBy: ids.admin.toString(),
      approvedAt: mad(2026, 9, 2, 9, 30), createdAt: now, updatedAt: now
    },
    {
      userId: ids.carles.toString(), year: 2026, month: 8, status: 'pending',
      requestedAt: mad(2026, 9, 3, 10, 0), openedBy: ids.admin.toString(),
      createdAt: now, updatedAt: now
    }
  ]);
  db.monthlyapprovalevents.insertMany([
    { userId: ids.anna.toString(), year: 2026, month: 8, action: 'opened', actorId: ids.admin.toString(), timestamp: mad(2026, 9, 1, 10, 0), createdAt: now, updatedAt: now },
    { userId: ids.anna.toString(), year: 2026, month: 8, action: 'confirmed', actorId: ids.anna.toString(), timestamp: mad(2026, 9, 2, 9, 30), createdAt: now, updatedAt: now },
    { userId: ids.carles.toString(), year: 2026, month: 8, action: 'opened', actorId: ids.admin.toString(), timestamp: mad(2026, 9, 3, 10, 0), createdAt: now, updatedAt: now }
  ]);
  print('Monthly approvals created (Anna approved, Carles pending for August)');

  // --- Vacations (intervals with backend-computed spent days) ------------------
  const approvedBy = ids.admin.toString();
  // Elective days a closed interval costs: calendar days in [start, end] that
  // are neither Sat/Sun nor obligatory holidays (company default).
  const spentDaysBetween = (startKey, endKey) => {
    const [sy, sm, sd] = startKey.split('-').map(Number);
    const [ey, em, ed] = endKey.split('-').map(Number);
    let count = 0;
    const cursor = new Date(Date.UTC(sy, sm - 1, sd));
    const end = new Date(Date.UTC(ey, em - 1, ed));
    while (cursor.getTime() <= end.getTime()) {
      const dow = cursor.getUTCDay();
      const key = dateKeyOf(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate());
      if (dow !== 0 && dow !== 6 && !obligatoryKeys.has(key)) count++;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return count;
  };

  const vacations = [];
  const addVacation = (userId, startDateStr, endDateStr, status, reason = '') => {
    const [y1, m1, d1] = startDateStr.split('-').map(Number);
    const [y2, m2, d2] = endDateStr.split('-').map(Number);
    const doc = {
      userId: userId.toString(),
      // Same convention as the create endpoint: 'YYYY-MM-DD' → UTC midnight.
      startDate: new Date(Date.UTC(y1, m1 - 1, d1)),
      endDate: new Date(Date.UTC(y2, m2 - 1, d2)),
      spentDays: spentDaysBetween(startDateStr, endDateStr),
      status,
      reason,
      createdAt: now,
      updatedAt: now
    };
    if (status === 'approved') {
      doc.approvedBy = approvedBy;
      doc.approvedAt = now;
    }
    vacations.push(doc);
  };

  // Previous year: approved / rejected / cancelled samples.
  addVacation(ids.anna, prevYear + '-04-14', prevYear + '-04-17', 'approved');
  addVacation(ids.carles, prevYear + '-07-28', prevYear + '-08-01', 'approved');
  addVacation(ids.marc, prevYear + '-02-03', prevYear + '-02-07', 'rejected');
  addVacation(ids.diana, prevYear + '-09-08', prevYear + '-09-10', 'cancelled');

  // Current year: August vacations (past, feed the admin/history views) and
  // upcoming requests in several states.
  addVacation(ids.elena, seedYear + '-08-03', seedYear + '-08-07', 'approved');
  addVacation(ids.diana, seedYear + '-08-10', seedYear + '-08-14', 'approved');
  addVacation(ids.diana, relKey(f0), relKey(f2), 'approved');
  addVacation(ids.carles, relKey(f2), relKey(f3), 'approved');
  addVacation(ids.berta, relKey(f0), relKey(f0), 'pending');
  addVacation(ids.marc, relKey(f1), relKey(f1), 'rejected');
  addVacation(ids.anna, relKey(w5), relKey(w4), 'cancelled');

  db.electivevacations.insertMany(vacations);
  print(`Vacations created (${vacations.length} interval requests across ${prevYear} and ${seedYear})`);

  for (const [year, days] of Object.entries(obligatoryDaysByYear)) {
    db.yearlyvacationdays.insertOne({
      year: Number(year),
      obligatoryDays: days,
      electiveDaysTotalCount: 22,
      createdAt: now,
      updatedAt: now
    });
    print(`Global yearly vacation settings for ${year} created (${days.length} obligatory days)`);
  }

  // Global company settings (timezone pinned so day keys are deterministic).
  db.appsettings.insertOne({
    endOfDayHour: 20,
    timezone: MADRID_TZ,
    createdAt: now,
    updatedAt: now
  });
  print('Company settings created');

  db.worksessionreasons.insertMany([
    { type: 'check_in', reasonId: 'work_start', englishText: 'Start of work', spanishText: 'Inicio del trabajo', catalanText: 'Inici de la feina' },
    { type: 'check_out', reasonId: 'work_end', englishText: 'End of work', spanishText: 'Fin del trabajo', catalanText: 'Fi de la feina' },
    { type: 'check_out', reasonId: 'lunch_break', englishText: 'Lunch break', spanishText: 'Descanso para comer', catalanText: 'Descans per dinar' },
    { type: 'check_in', reasonId: 'lunch_return', englishText: 'Return from lunch', spanishText: 'Vuelta de la comida', catalanText: 'Tornada del dinar' }
  ]);
  print('Work session reasons created');

  // Create the initial admin as a registered user with the demo password.
  // `_id` must match `ids.admin`: vacations reference it via `approvedBy`.
  db.users.insertOne({
    _id: ids.admin,
    name: 'System Administrator',
    password: DEMO_PASSWORD_HASH,
    registrationToken: '',
    registered: true,
    role: 'admin',
    groups: [],
    weeklyExpectedHours: [0, 8, 8, 8, 8, 8, 0],
    failedLoginAttempts: 0,
    blocked: false,
    createdAt: now,
    updatedAt: now,
    ...secretFields('admin@company.com', '00000000A')
  });
  print('Demo admin user created (registered).');
  print('Admin login: admin@company.com');
  print('Demo employees: anna@demo.com, berta@demo.com, carles@demo.com, diana@demo.com, marc@demo.com, elena@demo.com');
  print('All demo accounts share the password hashed in DEMO_PASSWORD_HASH.');
} else {
  print('SEED_DEMO not enabled - skipping demo data.');
}

print('Database initialization completed successfully!');
