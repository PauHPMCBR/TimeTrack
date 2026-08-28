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
db.electivevacations.createIndex({ userId: 1, date: 1 });
db.electivevacations.createIndex({ status: 1, date: 1 });
db.electivevacations.createIndex({ date: 1 });
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
    registrationToken: null,
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

  // --- Vacations ----------------------------------------------------------------
  const approvedBy = ids.admin.toString();
  const vacations = [];
  const addVacation = (userId, offset, status, reason = '') => {
    const doc = {
      userId: userId.toString(),
      date: dayAt(offset, 0, 0),
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

  addVacation(ids.elena, w0, 'approved');            // past approved → shows in history
  addVacation(ids.elena, w1, 'approved');
  addVacation(ids.diana, f0, 'approved');
  addVacation(ids.diana, f1, 'approved');
  addVacation(ids.diana, f2, 'approved');
  addVacation(ids.carles, f0, 'approved');
  addVacation(ids.carles, f1, 'approved');
  addVacation(ids.elena, f2, 'approved');
  addVacation(ids.elena, f3, 'approved');
  addVacation(ids.berta, f4, 'pending');
  addVacation(ids.marc, f5, 'rejected');

  db.electivevacations.insertMany(vacations);
  print(`Vacations created (${vacations.length} requests)`);

  // --- Global yearly vacation template (obligatory holiday) ---------------------
  db.yearlyvacationdays.insertOne({
    year: now.getFullYear(),
    obligatoryDays: [dayAt(holidayOffset, 0, 0)],
    electiveDaysTotalCount: 22,
    selectedElectiveDays: [],
    createdAt: now,
    updatedAt: now
  });
  print(`Global yearly vacation settings for ${now.getFullYear()} created (1 obligatory day)`);

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
    registrationToken: null,
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
