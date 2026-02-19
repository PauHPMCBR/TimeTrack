const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// URL de connexió (Verifica que sigui correcta)
const MONGODB_URI = "mongodb+srv://alumne:RVDZ7nNm2NubHlDG@pticontrolhores.pyaukc5.mongodb.net/pti?retryWrites=true&w=majority&appName=PTIcontrolHores";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'employee', enum: ['employee', 'admin'] },
  registrationToken: { type: String, unique: true, sparse: true },
  registered: Boolean,
  groups: [String],
  failedLoginAttempts: Number,
  blocked: Boolean,
  blockedSince: Date
});

const User = mongoose.model('User', userSchema);

async function seed() {
  try {
    console.log('🔌 Connectant a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connectat!');

    try {
       await User.collection.dropIndexes();
       console.log('🧹 Índexs antics esborrats.');
    } catch (e) {
       console.log('ℹ️  No cal esborrar índexs.');
    }

    const salt = await bcrypt.genSalt(12); 
    const hashedPassword = await bcrypt.hash('admin123', salt);

    const users = [
      {
        name: 'Marc Font',
        email: 'marc.font@gmail.com',
        password: hashedPassword,
        role: 'admin', // <--- ARA ÉS ADMIN
        registered: true,
        failedLoginAttempts: 0,
        blocked: false,
        registrationToken: null 
      },
      {
        name: 'Helena Occhionero',
        email: 'helena.occhionero@gmail.com',
        password: hashedPassword,
        role: 'admin', // <--- ARA ÉS ADMIN
        registered: true,
        failedLoginAttempts: 0,
        blocked: false,
        registrationToken: null
      },
      {
        name: 'System Administrator',
        email: 'admin@company.com',
        password: hashedPassword,
        role: 'admin', // Aquest ja ho era
        registered: true,
        failedLoginAttempts: 0,
        blocked: false,
        registrationToken: null
      }
    ];

    console.log('🚀 Actualitzant usuaris a ROL ADMIN...');

    for (const u of users) {
      const result = await User.findOneAndUpdate(
        { email: u.email }, 
        u, 
        { upsert: true, new: true }
      );
      console.log(`   👤 ${result.email} -> Rol actual: ${result.role}`);
    }

    console.log('🎉 Fet! Tothom és admin i podrà fitxar.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

seed();