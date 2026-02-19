sleep(1000);

print('Starting database initialization...');

db = db.getSiblingDB('admin');

try {
  db.createUser({
    user: 'root',
    pwd: '09nwp43dFpFyBI3h4LmM',
    roles: [{ role: 'root', db: 'admin' }]
  });
  print('Root user created in admin database');
} catch (error) {
  print('Root user already exists: ' + error.message);
}

// Create the application database
db = db.getSiblingDB('myapp');
print('myapp database created');

// Create collections
db.createCollection('users');
db.createCollection('groups');
db.createCollection('worksessions');
db.createCollection('electivevacations');
db.createCollection('yearlyvacationdays');
print('Collections created');

// Create the application user
try {
  db.createUser({
    user: 'alumne',
    pwd: 'XGmHckQJzwzFKwBo14YA',
    roles: [
      { role: 'readWrite', db: 'myapp' }
    ]               
  });
  print('alumne user created in myapp database');
} catch (error) {
  print('alumne user already exists: ' + error.message);
}

// Helper function to hash passwords (same as bcrypt hash for 'admin123')
function getHashedPassword() {
  return '$2b$12$CqmY1PBDB4XYX4XVaxxiz.fVWYVKK9RlzfqWPZETE9dH0FMlxyYHW';
}

// Create groups first
print('\nCreating groups...');
const groups = [
  {
    name: 'Development',
    description: 'Software development team',
    members: [], // Will be populated after users are created
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Design',
    description: 'UI/UX design team',
    members: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Marketing',
    description: 'Marketing and communications',
    members: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'HR',
    description: 'Human Resources',
    members: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const groupIds = [];
groups.forEach((group, index) => {
  try {
    const result = db.groups.insertOne(group);
    groupIds.push(result.insertedId.toString());
    print(`Group ${group.name} created with ID: ${result.insertedId}`);
  } catch (error) {
    print(`Error creating group ${group.name}: ${error.message}`);
  }
});

// Create users with references to groups by name
const users = [
  {
    name: 'System Administrator',
    email: 'admin@company.com',
    password: getHashedPassword(),
    registrationToken: crypto.randomBytes(32).toString('hex'),
    registered: true,
    role: 'admin',
    groups: [], // Admin doesn't belong to any group
    failedLoginAttempts: 0,
    blocked: false,
    blockedSince: undefined,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'John Smith',
    email: 'john.smith@company.com',
    password: getHashedPassword(),
    registrationToken: crypto.randomBytes(32).toString('hex'),
    registered: true,
    role: 'employee',
    groups: ['Development'],
    failedLoginAttempts: 0,
    blocked: false,
    blockedSince: undefined,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Maria Garcia',
    email: 'maria.garcia@company.com',
    password: getHashedPassword(),
    registrationToken: crypto.randomBytes(32).toString('hex'),
    registered: true,
    role: 'employee',
    groups: ['Design'],
    failedLoginAttempts: 0,
    blocked: false,
    blockedSince: undefined,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Robert Johnson',
    email: 'robert.johnson@company.com',
    password: getHashedPassword(),
    registrationToken: crypto.randomBytes(32).toString('hex'),
    registered: true,
    role: 'employee',
    groups: ['Marketing'],
    failedLoginAttempts: 0,
    blocked: false,
    blockedSince: undefined,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Lisa Chen',
    email: 'lisa.chen@company.com',
    password: getHashedPassword(),
    registrationToken: crypto.randomBytes(32).toString('hex'),
    registered: true,
    role: 'employee',
    groups: ['Development'],
    failedLoginAttempts: 0,
    blocked: false,
    blockedSince: undefined,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Insert users and get their IDs
const userIds = [];
users.forEach((user, index) => {
  try {
    const result = db.users.insertOne(user);
    userIds.push(result.insertedId.toString());
    print(`User ${user.name} created with ID: ${result.insertedId}`);
  } catch (error) {
    print(`Error creating user ${user.name}: ${error.message}`);
  }
});

// Update groups with member user IDs
print('\nUpdating groups with members...');
const groupUpdates = [
  { groupName: 'Development', members: [userIds[1], userIds[4]] }, // John Smith, Lisa Chen
  { groupName: 'Design', members: [userIds[2]] }, // Maria Garcia
  { groupName: 'Marketing', members: [userIds[3]] }, // Robert Johnson
  { groupName: 'HR', members: [] } // Empty for now
];

groupUpdates.forEach(update => {
  try {
    db.groups.updateOne(
      { name: update.groupName },
      { $set: { members: update.members, updatedAt: new Date() } }
    );
    print(`Group ${update.groupName} updated with ${update.members.length} members`);
  } catch (error) {
    print(`Error updating group ${update.groupName}: ${error.message}`);
  }
});

// Helper function to generate work sessions for a day with proper timing
function generateWorkSessionsForDay(date, userId) {
  const sessions = [];
  const day = date.getDay(); // 0=Sunday, 1=Monday, etc.
  
  // Skip weekends for work
  if (day === 0 || day === 6) return sessions;
  
  // Generate check-in time between 8:00-9:00
  const checkInHour = 8 + Math.floor(Math.random() * 1); // 8-9
  const checkInMinute = Math.floor(Math.random() * 60); // 0-59
  const checkInTime = new Date(date);
  checkInTime.setHours(checkInHour, checkInMinute, 0, 0);
  
  // Morning work session: 4-5 hours
  const morningWorkHours = 4 + Math.random() * 1; // 3.5-4.5 hours
  const morningWorkMillis = morningWorkHours * 60 * 60 * 1000;
  
  // Lunch break start (check-out for lunch)
  const lunchOutTime = new Date(checkInTime.getTime() + morningWorkMillis);
  
  // Lunch break duration: 45-75 minutes
  const lunchBreakMinutes = 45 + Math.floor(Math.random() * 30); // 45-75 minutes
  const lunchBreakMillis = lunchBreakMinutes * 60 * 1000;
  
  // Return from lunch (check-in after lunch)
  const lunchInTime = new Date(lunchOutTime.getTime() + lunchBreakMillis);
  
  // Afternoon work: 3.5-4 hours to complete 8 hours total
  const morningWorkedHours = morningWorkHours;
  const afternoonWorkHours = 8 - morningWorkedHours; // Ensure total 8 hours
  const afternoonWorkMillis = afternoonWorkHours * 60 * 60 * 1000 + (Math.random() * 200000 - 100000);
  
  // End of day (check-out)
  const checkOutTime = new Date(lunchInTime.getTime() + afternoonWorkMillis);
  
  // Create work sessions
  sessions.push({
    userId: userId,
    type: 'check_in',
    timestamp: checkInTime,
    reason: 'work',
    notes: 'Morning check-in',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  sessions.push({
    userId: userId,
    type: 'check_out',
    timestamp: lunchOutTime,
    reason: 'lunch',
    notes: 'Lunch break',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  sessions.push({
    userId: userId,
    type: 'check_in',
    timestamp: lunchInTime,
    reason: 'work',
    notes: 'Back from lunch',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  sessions.push({
    userId: userId,
    type: 'check_out',
    timestamp: checkOutTime,
    reason: 'work',
    notes: 'End of day',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  // Calculate and log total hours for verification
  const totalHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60) - (lunchBreakMinutes / 60);
  
  return sessions;
}

// Create work sessions for the past week (December 8-12, 2025)
print('\nCreating work sessions for the past week...');

// Define the work week: Monday December 8 to Friday December 12, 2025
const workDays = [
  new Date(2025, 11, 8),  // Monday, December 8
  new Date(2025, 11, 9),  // Tuesday, December 9
  new Date(2025, 11, 10), // Wednesday, December 10
  new Date(2025, 11, 11), // Thursday, December 11
  new Date(2025, 11, 12)  // Friday, December 12
];

// Skip patterns for different employees (simulating some absence)
const skipPatterns = {
  [userIds[1]]: [false, true, false, false, false],  // John skips Tuesday
  [userIds[2]]: [false, false, false, false, true],   // Maria skips Friday
  [userIds[3]]: [false, false, true, false, false],   // Robert skips Wednesday
  [userIds[4]]: [false, false, false, false, false]   // Lisa works all days
};

// Generate work sessions for each employee (skip admin)
for (let i = 1; i < userIds.length; i++) {
  const userId = userIds[i];
  const skipPattern = skipPatterns[userId];
  let totalWorkSessions = 0;
  let totalWorkHours = 0;
  
  print(`\nCreating work sessions for user ${users[i].name}:`);
  
  workDays.forEach((day, dayIndex) => {
    if (!skipPattern[dayIndex]) {
      const sessions = generateWorkSessionsForDay(day, userId);
      
      // Calculate total hours for this day
      if (sessions.length === 4) {
        const checkIn = sessions[0].timestamp;
        const lunchOut = sessions[1].timestamp;
        const lunchIn = sessions[2].timestamp;
        const checkOut = sessions[3].timestamp;
        
        const morningHours = (lunchOut - checkIn) / (1000 * 60 * 60);
        const afternoonHours = (checkOut - lunchIn) / (1000 * 60 * 60);
        const totalDayHours = morningHours + afternoonHours;
        totalWorkHours += totalDayHours;
        
        print(`  - ${day.toDateString()}: ${sessions.length} sessions, ${totalDayHours.toFixed(2)} hours`);
      }
      
      sessions.forEach(session => {
        db.worksessions.insertOne(session);
      });
      totalWorkSessions += sessions.length;
    } else {
      print(`  - ${day.toDateString()}: Skipped (no work sessions)`);
    }
  });
  
  print(`  Total sessions: ${totalWorkSessions}, Total hours: ${totalWorkHours.toFixed(2)}`);
}

// Create elective vacations for December 2025
print('\nCreating elective vacation requests...');

const vacationRequests = [
  // John Smith: Takes vacation on Tuesday Dec 9 (the day he skipped work)
  {
    userId: userIds[1],
    date: new Date(2025, 11, 9),
    status: 'approved',
    reason: 'Doctor appointment',
    approvedBy: userIds[0], // Admin approved
    approvedAt: new Date(2025, 11, 1),
    createdAt: new Date(2025, 11, 1),
    updatedAt: new Date(2025, 11, 1)
  },
  // Maria Garcia: Takes vacation on Friday Dec 12 (the day she skipped work)
  {
    userId: userIds[2],
    date: new Date(2025, 11, 12),
    status: 'pending',
    reason: 'Family vacation',
    createdAt: new Date(2025, 11, 3),
    updatedAt: new Date(2025, 11, 3)
  },
  // Robert Johnson: Takes vacation on Wednesday Dec 10 (the day he skipped work)
  {
    userId: userIds[3],
    date: new Date(2025, 11, 10),
    status: 'approved',
    reason: 'Personal day',
    approvedBy: userIds[0], // Admin approved
    approvedAt: new Date(2025, 11, 2),
    createdAt: new Date(2025, 11, 2),
    updatedAt: new Date(2025, 11, 2)
  },
  // Lisa Chen: Takes vacation on Thursday Dec 11 (she worked all days, so this is extra)
  {
    userId: userIds[4],
    date: new Date(2025, 11, 11),
    status: 'rejected',
    reason: 'Holiday shopping',
    approvedBy: userIds[0], // Admin rejected
    approvedAt: new Date(2025, 11, 4),
    createdAt: new Date(2025, 11, 4),
    updatedAt: new Date(2025, 11, 4)
  },
  // Lisa Chen: Another vacation request for Monday Dec 15 (future)
  {
    userId: userIds[4],
    date: new Date(2025, 11, 15),
    status: 'pending',
    reason: 'Dental checkup',
    createdAt: new Date(2025, 11, 5),
    updatedAt: new Date(2025, 11, 5)
  }
];

vacationRequests.forEach((vacation, index) => {
  try {
    const result = db.electivevacations.insertOne(vacation);
    print(`Vacation request ${index + 1} created for ${users.find(u => u._id === vacation.userId || u.email).name} on ${vacation.date.toDateString()} (Status: ${vacation.status})`);
  } catch (error) {
    print(`Error creating vacation request ${index + 1}: ${error.message}`);
  }
});

// Create global YearlyVacationDays for 2025
print('\nCreating global yearly vacation settings for 2025...');

const globalYearlyVacationDays = {
  year: 2025,
  obligatoryDays: [
    new Date(2025, 0, 1),   // New Year's Day
    new Date(2025, 0, 6),   // Epiphany
    new Date(2025, 3, 18),  // Good Friday
    new Date(2025, 3, 21),  // Easter Monday
    new Date(2025, 4, 1),   // Labor Day
    new Date(2025, 5, 24),  // St. John's Day
    new Date(2025, 7, 15),  // Assumption
    new Date(2025, 8, 11),  // National Day of Catalonia
    new Date(2025, 9, 12),  // Hispanic Day
    new Date(2025, 10, 1),  // All Saints' Day
    new Date(2025, 11, 6),  // Constitution Day
    new Date(2025, 11, 8),  // Immaculate Conception
    new Date(2025, 11, 25), // Christmas Day
    new Date(2025, 11, 26)  // St. Stephen's Day
  ],
  electiveDaysTotalCount: 22,
  selectedElectiveDays: [], // Empty for global template
  createdAt: new Date(),
  updatedAt: new Date()
};

try {
  const result = db.yearlyvacationdays.insertOne(globalYearlyVacationDays);
  print(`Global yearly vacation days for 2025 created with ${globalYearlyVacationDays.obligatoryDays.length} obligatory holidays`);
} catch (error) {
  print(`Error creating global yearly vacation days: ${error.message}`);
}

// Create user-specific YearlyVacationDays for 2025
print('\nCreating user-specific yearly vacation days for 2025...');

// For each user (except admin), create a copy of global settings with their selected elective days
for (let i = 1; i < userIds.length; i++) {
  const userId = userIds[i];
  const userName = users[i].name;
  
  // Get approved vacation dates for this user
  const approvedVacations = vacationRequests.filter(v => 
    v.userId === userId && v.status === 'approved'
  ).map(v => {
    const date = new Date(v.date);
    date.setHours(0, 0, 0, 0); // Normalize to start of day
    return date;
  });
  
  const userYearlyVacationDays = {
    userId: userId,
    year: 2025,
    obligatoryDays: globalYearlyVacationDays.obligatoryDays,
    electiveDaysTotalCount: 22,
    selectedElectiveDays: approvedVacations,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  try {
    const result = db.yearlyvacationdays.insertOne(userYearlyVacationDays);
    print(`Yearly vacation days for ${userName} created with ${approvedVacations.length} selected elective days`);
  } catch (error) {
    print(`Error creating yearly vacation days for ${userName}: ${error.message}`);
  }
}

// Create some work session reasons
print('\nCreating work session reasons...');

const workSessionReasons = [
  {
    type: 'check_in',
    reasonId: 'work_start',
    englishText: 'Start of work',
    spanishText: 'Inicio del trabajo',
    catalanText: 'Inici de la feina'
  },
  {
    type: 'check_out',
    reasonId: 'work_end',
    englishText: 'End of work',
    spanishText: 'Fin del trabajo',
    catalanText: 'Fi de la feina'
  },
  {
    type: 'check_out',
    reasonId: 'lunch_break',
    englishText: 'Lunch break',
    spanishText: 'Descanso para comer',
    catalanText: 'Descans per dinar'
  },
  {
    type: 'check_in',
    reasonId: 'lunch_return',
    englishText: 'Return from lunch',
    spanishText: 'Vuelta de la comida',
    catalanText: 'Tornada del dinar'
  },
  {
    type: 'check_out',
    reasonId: 'coffee_break',
    englishText: 'Coffee break',
    spanishText: 'Descanso para café',
    catalanText: 'Descans per cafè'
  },
  {
    type: 'check_out',
    reasonId: 'meeting',
    englishText: 'Meeting',
    spanishText: 'Reunión',
    catalanText: 'Reunió'
  },
  {
    type: 'check_out',
    reasonId: 'errand',
    englishText: 'Errand',
    spanishText: 'Recado',
    catalanText: 'Encàrrec'
  }
];

// Create collection for work session reasons if it doesn't exist
if (!db.getCollectionNames().includes('worksessionreasons')) {
  db.createCollection('worksessionreasons');
}

workSessionReasons.forEach((reason, index) => {
  try {
    db.worksessionreasons.insertOne(reason);
    print(`Work session reason ${index + 1} created: ${reason.englishText}`);
  } catch (error) {
    print(`Error creating work session reason ${index + 1}: ${error.message}`);
  }
});

print('\nDatabase initialization completed successfully!');

function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds) {
      break;
    }
  }
}