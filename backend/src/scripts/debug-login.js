// scripts/debug-login.js
const { User, sequelize } = require('../models');
const bcrypt = require('bcryptjs');

async function debugLogin() {
  try {
    console.log('🔍 DEBUG: Password Comparison Test\n');
    console.log('=' .repeat(50));

    const email = 'admin@apexengg.com';
    const password = 'Admin@123';

    // 1. Get user with password
    console.log('1️⃣ Fetching user...');
    const user = await User.scope('withPassword').findOne({
      where: { email }
    });

    if (!user) {
      console.log('❌ User not found!');
      return;
    }

    console.log('✅ User found!');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.is_active}`);

    // 2. Check the stored hash
    console.log('\n2️⃣ Stored password hash:');
    console.log(`   ${user.password}`);
    console.log(`   Length: ${user.password.length}`);

    // 3. Test bcrypt.compare directly
    console.log('\n3️⃣ Testing bcrypt.compare() directly:');
    try {
      const result = await bcrypt.compare(password, user.password);
      console.log(`   Password "${password}" -> ${result ? '✅ MATCH' : '❌ NO MATCH'}`);
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }

    // 4. Test with different password variations
    console.log('\n4️⃣ Testing password variations:');
    const variations = [
      password,
      password.toLowerCase(),
      password.toUpperCase(),
      password.trim(),
      'Admin@123',
      'admin123',
      'password'
    ];

    for (const testPw of variations) {
      const result = await bcrypt.compare(testPw, user.password);
      if (result) {
        console.log(`   ✅ Found match: "${testPw}"`);
        break;
      }
    }

    // 5. Test the comparePassword method
    console.log('\n5️⃣ Testing user.comparePassword() method:');
    try {
      const result = await user.comparePassword(password);
      console.log(`   Result: ${result ? '✅ MATCH' : '❌ NO MATCH'}`);
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }

    // 6. Generate a new hash for comparison
    console.log('\n6️⃣ Generating new hash for reference:');
    const newHash = await bcrypt.hash(password, 12);
    console.log(`   New hash: ${newHash}`);
    
    const testNew = await bcrypt.compare(password, newHash);
    console.log(`   Testing new hash: ${testNew ? '✅ WORKS' : '❌ FAILS'}`);

    // 7. Compare stored hash with new hash format
    console.log('\n7️⃣ Hash comparison:');
    console.log(`   Stored hash: ${user.password.substring(0, 30)}...`);
    console.log(`   New hash:    ${newHash.substring(0, 30)}...`);
    console.log(`   Same format: ${user.password.startsWith('$2a$') && newHash.startsWith('$2a$') ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await sequelize.close();
  }
}

debugLogin();