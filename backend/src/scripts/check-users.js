// scripts/check-users.js
const { User, sequelize } = require('../models');
const bcrypt = require('bcryptjs');

async function checkUsers() {
  try {
    console.log('🔍 Checking users in database...\n');

    // Get all users
    const users = await User.scope('withPassword').findAll({
      attributes: ['id', 'email', 'name', 'role', 'is_active', 'password']
    });

    console.log(`📊 Found ${users.length} users:\n`);

    for (const user of users) {
      console.log(`👤 User: ${user.email}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.is_active}`);
      console.log(`   Password hash: ${user.password ? user.password.substring(0, 30) + '...' : 'No password'}`);
      
      // Test with known passwords
      const testPasswords = ['Admin@123', 'Super@Admin123', 'password123'];
      for (const testPw of testPasswords) {
        const isValid = await bcrypt.compare(testPw, user.password);
        if (isValid) {
          console.log(`   ✅ Password matches: "${testPw}"`);
        }
      }
      console.log('');
    }

    // Check if we have any users
    if (users.length === 0) {
      console.log('⚠️ No users found! You need to insert users.');
      console.log('\nTo insert default users, run:');
      console.log('mysql -u root -p attendance_payroll < insert-users.sql');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkUsers();