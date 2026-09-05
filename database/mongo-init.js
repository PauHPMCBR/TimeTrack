// MongoDB initialization script (runs inside the official mongo image on first start).
//
// Credentials come from environment variables set in docker-compose.yml:
//   - Root user is created automatically by the mongo image entrypoint from
//     MONGO_INITDB_ROOT_USERNAME / MONGO_INITDB_ROOT_PASSWORD.
//   - Application user is created here from MONGO_APP_USER / MONGO_APP_PASSWORD.
//
// Demo data (groups + admin account) is only seeded when SEED_DEMO=1.
// The demo admin password must be provided via DEMO_ADMIN_PASSWORD.

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
db.createCollection('electivevacations');
db.createCollection('yearlyvacationdays');
db.createCollection('worksessionreasons');
db.createCollection('appsettings');
print('Collections created');

// Mirror the indexes declared in backend/src/models/index.ts. They are created
// here (not left to Mongoose autoIndex) because production runs with
// autoIndex=false; the /api/admin/indexes/sync endpoint is the manual fallback.
print('Creating indexes...');
db.users.createIndex({ email: 1, registered: 1 });
db.users.createIndex({ registrationToken: 1 });
db.worksessions.createIndex({ userId: 1, timestamp: -1 });
db.worksessions.createIndex({ timestamp: -1 });
db.electivevacations.createIndex({ userId: 1, startDate: 1 });
db.electivevacations.createIndex({ userId: 1, status: 1, startDate: 1, endDate: 1 });
db.electivevacations.createIndex({ startDate: 1 });
db.groups.createIndex({ members: 1, name: 1 });
// userId is absent on the global template rows; a missing field indexes as null,
// so one global template per year and one per-user row per year are enforced.
db.yearlyvacationdays.createIndex({ userId: 1, year: 1 }, { unique: true });
db.yearlyvacationdays.createIndex({ year: 1 });
print('Indexes created');

db.createUser({
  user: APP_USER,
  pwd: APP_PASSWORD,
  roles: [{ role: 'readWrite', db: 'myapp' }]
});
print(`Application user "${APP_USER}" created in myapp database`);

if (process.env.SEED_DEMO === '1') {
  const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD;
  if (!DEMO_ADMIN_PASSWORD) {
    throw new Error('SEED_DEMO=1 requires DEMO_ADMIN_PASSWORD to be set');
  }

  print('Seeding demo data...');

  const now = new Date();

  // Fixed demo password for all registered employees (bcryptjs hash).
  //   Email: <name>@demo.com   Password: Password123!
  const DEMO_PASSWORD_HASH = '$2a$12$qLBbrH0xrSwZaO083YmxqugjsKjFqDB/mGTg0r9Au6Zs9PmjvNqKe';

  // --- Object ids referenced across collections ---------------------------------
  const ids = {
    anna: ObjectId(), berta: ObjectId(), carles: ObjectId(),
    diana: ObjectId(), marc: ObjectId(), elena: ObjectId(), admin: ObjectId(),
  };
  const groups = { dev: ObjectId(), design: ObjectId(), marketing: ObjectId() };

  // --- Time helpers (all dates are local) ---------------------------------------
  const dayAt = (offset, hour = 0, minute = 0) => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  };

  // Most recent Thursday strictly before today → company holiday (no one works).
  const todayDow = new Date().getDay();
  const daysSinceThursday = (todayDow + 3) % 7;
  const holidayOffset = -(daysSinceThursday === 0 ? 7 : daysSinceThursday);

  // Past weekday offsets (most recent first), skipping the holiday.
  const weekdayOffsets = [];
  {
    let n = 1;
    while (weekdayOffsets.length < 10) {
      const t = new Date(now);
      t.setDate(now.getDate() - n);
      const dow = t.getDay();
      if (dow !== 0 && dow !== 6 && -n !== holidayOffset) weekdayOffsets.push(-n);
      n++;
    }
  }
  const [w0, w1, w2, w3, w4, w5, w6, w7] = weekdayOffsets;

  // Future weekday offsets (next first).
  const futureWeekdayOffsets = [];
  {
    let n = 1;
    while (futureWeekdayOffsets.length < 6) {
      const t = new Date(now);
      t.setDate(now.getDate() + n);
      const dow = t.getDay();
      if (dow !== 0 && dow !== 6) futureWeekdayOffsets.push(n);
      n++;
    }
  }
  const [f0, f1, f2, f3, f4, f5] = futureWeekdayOffsets;

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

  // --- Employees (registered, can log in with Password123!) ----------------------
  const employee = (id, name, email, dni, expectedWorkHours, groupIds) => ({
    _id: id, name, email,
    password: DEMO_PASSWORD_HASH,
    registrationToken: '',
    registered: true,
    role: 'employee',
    groups: groupIds.map((g) => g.toString()),
    dni,
    expectedWorkHours,
    failedLoginAttempts: 0,
    blocked: false,
    createdAt: now,
    updatedAt: now
  });

  db.users.insertMany([
    employee(ids.anna, 'Anna Torres', 'anna@demo.com', '11111111A', 8, [groups.dev]),
    employee(ids.berta, 'Berta Puig', 'berta@demo.com', '22222222B', 8, [groups.design]),
    employee(ids.carles, 'Carles Vila', 'carles@demo.com', '33333333C', 7.5, [groups.dev]),
    employee(ids.diana, 'Diana Roca', 'diana@demo.com', '44444444D', 8, [groups.marketing]),
    employee(ids.marc, 'Marc Soler', 'marc@demo.com', '55555555E', 6, [groups.design]),
    employee(ids.elena, 'Elena Grau', 'elena@demo.com', '66666666F', 8, [groups.dev])
  ]);
  print('Demo employees created (password: Password123!)');

  // --- Work sessions (mix of every status the admin view can show) --------------
  const sessions = [];
  const addSession = (userId, type, offset, hour, minute = 0) => {
    sessions.push({ userId: userId.toString(), type, source: 'user', timestamp: dayAt(offset, hour, minute), createdAt: now, updatedAt: now });
  };
  const session = (userId, offset, startHour, endHour, startMinute = 0, endMinute = 0) => {
    addSession(userId, 'check_in', offset, startHour, startMinute);
    addSession(userId, 'check_out', offset, endHour, endMinute);
  };

  // Anna (8h): mostly ok, forgot_check_out, hours_over, hours_short, a lunch-break day
  session(ids.anna, w0, 9, 17);
  session(ids.anna, w1, 9, 17);
  addSession(ids.anna, 'check_in', w2, 9);            // forgot_check_out
  session(ids.anna, w3, 9, 19, 0, 30);               // hours_over (10.5h)
  addSession(ids.anna, 'check_in', w4, 9);            // lunch-break day (8h total):
  addSession(ids.anna, 'check_out', w4, 13);          //   9→13 (4h)
  addSession(ids.anna, 'check_in', w4, 14);           //   14→18 (4h)
  addSession(ids.anna, 'check_out', w4, 18);
  session(ids.anna, w5, 10, 14, 30, 30);             // hours_short (4h)
  session(ids.anna, w6, 9, 17);
  session(ids.anna, w7, 9, 17);
  session(ids.anna, 0, 9, 17);                       // today, completed

  // Berta (8h): ok, forgot_check_in, still working today
  session(ids.berta, w0, 9, 17);
  addSession(ids.berta, 'check_out', w1, 17);        // forgot_check_in
  session(ids.berta, w2, 9, 17);
  session(ids.berta, w3, 9, 17);
  session(ids.berta, w4, 9, 17);
  addSession(ids.berta, 'check_in', 0, 9);           // today, still working

  // Carles (7.5h): ok, hours_over, still working today
  session(ids.carles, w0, 9, 16, 0, 30);             // 7.5h ok
  session(ids.carles, w1, 9, 18);                    // hours_over (9h)
  session(ids.carles, w2, 9, 16, 0, 30);
  session(ids.carles, w3, 9, 16, 0, 30);
  addSession(ids.carles, 'check_in', 0, 9);          // today, still working

  // Diana (8h): hours_short, a full missing day, ok
  session(ids.diana, w0, 9, 13);                     // hours_short (4h)
  // w1 intentionally left empty → missing day (hours_short)
  session(ids.diana, w2, 9, 17);                     // ok

  // Marc (6h part-time): ok, forgot_check_out, hours_over
  session(ids.marc, w0, 9, 15);                      // 6h ok
  addSession(ids.marc, 'check_in', w1, 9);           // forgot_check_out
  session(ids.marc, w2, 9, 17);                      // hours_over (8h)
  session(ids.marc, w3, 9, 15);                      // ok
  session(ids.marc, 0, 9, 15);                       // today, completed

  // Elena (8h): approved vacation on w0/w1, otherwise ok, still working today
  session(ids.elena, w2, 9, 17);
  session(ids.elena, w3, 9, 17);
  session(ids.elena, w4, 9, 17);
  addSession(ids.elena, 'check_in', 0, 9, 30);       // today, still working

  db.worksessions.insertMany(sessions);
  print(`Work sessions created (${sessions.length} events)`);

  // --- Company obligatory holidays (current + previous year templates) ---------
  const seedYear = now.getFullYear();
  const prevYear = seedYear - 1;
  const fixedDay = (year, month, day) => new Date(year, month - 1, day, 0, 0, 0, 0);
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
      dayAt(holidayOffset, 0, 0)  // moving demo holiday (recent Thursday)
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

  // --- Vacations (intervals with backend-computed spent days) ------------------
  const approvedBy = ids.admin.toString();
  const dateKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const NON_WORKING_DAYS = [0, 6]; // company default: Sat/Sun
  const spentDaysBetweenDates = (start, end) => {
    const obligatoryKeys = new Set(
      (obligatoryDaysByYear[start.getFullYear()] ?? []).map(dateKey)
    );
    let count = 0;
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      if (!NON_WORKING_DAYS.includes(cursor.getDay()) && !obligatoryKeys.has(dateKey(cursor))) count++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  };

  const vacations = [];
  // start/end as "YYYY-MM-DD" strings of the given year.
  const addVacation = (userId, startDateStr, endDateStr, status, reason = '') => {
    const [y1, m1, d1] = startDateStr.split('-').map(Number);
    const [y2, m2, d2] = endDateStr.split('-').map(Number);
    const startDate = new Date(y1, m1 - 1, d1, 0, 0, 0, 0);
    const endDate = new Date(y2, m2 - 1, d2, 0, 0, 0, 0);
    const doc = {
      userId: userId.toString(),
      startDate,
      endDate,
      spentDays: spentDaysBetweenDates(startDate, endDate),
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

  // Current year: every state, several users.
  // Past interval runs earlier offset first (w1 is older than w0); single-day
  // pending/rejected requests land on future weekdays without an obligatory
  // holiday so their spent days are 1.
  const obligatoryKeysCurrent = new Set(obligatoryDaysByYear[seedYear].map(dateKey));
  const freeFuture = futureWeekdayOffsets.filter(
    (n) => !obligatoryKeysCurrent.has(dateKey(dayAt(n, 0, 0)))
  );
  const freePast = weekdayOffsets.filter(
    (n) => !obligatoryKeysCurrent.has(dateKey(dayAt(n, 0, 0)))
  );
  const dateStr = (offset) => dateKey(dayAt(offset, 0, 0));

  addVacation(ids.elena, dateStr(w1), dateStr(w0), 'approved');   // past approved → shows in history
  addVacation(ids.diana, dateStr(f0), dateStr(f2), 'approved');
  addVacation(ids.carles, dateStr(f0), dateStr(f1), 'approved');
  addVacation(ids.elena, dateStr(f2), dateStr(f3), 'approved');
  addVacation(ids.berta, dateStr(freeFuture[0]), dateStr(freeFuture[0]), 'pending');
  addVacation(ids.marc, dateStr(freeFuture[1]), dateStr(freeFuture[1]), 'rejected');
  addVacation(ids.anna, dateStr(freePast[3]), dateStr(freePast[2]), 'cancelled'); // older past interval

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

  // Global company settings
  db.appsettings.insertOne({
    defaultExpectedHours: 8,
    benevolenceHours: 1,
    endOfDayHour: 20,
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
    email: 'admin@company.com',
    password: DEMO_PASSWORD_HASH,
    registrationToken: '',
    registered: true,
    role: 'admin',
    groups: [],
    dni: '00000000A',
    expectedWorkHours: 8,
    failedLoginAttempts: 0,
    blocked: false,
    createdAt: now,
    updatedAt: now
  });
  print('Demo admin user created (registered).');
  print('Admin login: admin@company.com / Password123!');
  print('Demo employees: anna@demo.com, berta@demo.com, carles@demo.com, diana@demo.com, marc@demo.com, elena@demo.com (password: Password123!)');
} else {
  print('SEED_DEMO not enabled - skipping demo data.');
}

print('Database initialization completed successfully!');
