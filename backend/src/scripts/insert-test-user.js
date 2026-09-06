// scripts/insert-test-user.js
const { User, sequelize } = require('../models');
const bcrypt = require('bcryptjs');

async function insertTestUsers() {
  try {
    console.log('🔧 Creating test users...\n');

    // Test user data
    const testUsers = [
      {
        name: 'Super Admin',
        email: 'superadmin@system.com',
        password: 'Super@Admin123',
        role: 'super_admin'
      },
      {
        name: 'Company Admin',
        email: 'admin@apexengg.com',
        password: 'Admin@123',
        role: 'company_admin',
        company_id: 1
      },
      {
        name: 'HR Manager',
        email: 'hr@apexengg.com',
        password: 'Admin@123',
        role: 'hr',
        company_id: 1
      },
      {
        name: 'Test Employee',
        email: 'employee@apexengg.com',
        password: 'Admin@123',
        role: 'employee',
        company_id: 1
      }
    ];

    for (const userData of testUsers) {
      // Check if user already exists
      const existing = await User.findOne({ 
        where: { email: userData.email } 
      });

      if (existing) {
        console.log(`⚠️ User ${userData.email} already exists, skipping...`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      // Create user
      const user = await User.create({
        name: userData.name,
        email: userData.email,
        password: userData.password, // Will be hashed by model hook
        role: userData.role,
        company_id: userData.company_id || null,
        is_active: true
      });

      console.log(`✅ Created user: ${userData.email} (${userData.role})`);
    }

    console.log('\n✅ Test users created successfully!');
    console.log('\n📋 Login credentials:');
    console.log('   Super Admin: superadmin@system.com / Super@Admin123');
    console.log('   Company Admin: admin@apexengg.com / Admin@123');
    console.log('   HR Manager: hr@apexengg.com / Admin@123');
    console.log('   Employee: employee@apexengg.com / Admin@123');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

insertTestUsers();