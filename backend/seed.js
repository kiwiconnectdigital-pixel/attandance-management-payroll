require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User.model');
const Branch = require('./src/models/Branch.model');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  // Create default branch
  const branch = await Branch.findOneAndUpdate(
    { code: 'HQ' },
    { name: 'Head Office', code: 'HQ', address: '123 Main St', city: 'Mumbai', state: 'Maharashtra', isActive: true },
    { upsert: true, new: true }
  );
  console.log('✅ Default branch created:', branch.name);

  // Create admin user
  const admin = await User.findOneAndUpdate(
    { email: 'admin@company.com' },
    { name: 'System Admin', email: 'admin@company.com', password: 'Admin@123', role: 'admin', isActive: true },
    { upsert: true, new: true }
  );
  console.log('✅ Admin user created: admin@company.com / Admin@123');
  
  await mongoose.disconnect();
  process.exit(0);
};

seed().catch(console.error);