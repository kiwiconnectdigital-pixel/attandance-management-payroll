const { User, sequelize } = require("../models");
const bcrypt = require("bcryptjs");

async function insertTestUsers() {
  try {
    console.log("🔧 Creating test users...\n");

    const testUsers = [
      {
        name: "Super Admin",
        email: "superadmin@system.com",
        password: "Super@Admin123",
        role: "super_admin",
      },
      {
        name: "Company Admin",
        email: "admin@apexengg.com",
        password: "Admin@123",
        role: "company_admin",
        company_id: 1,
      },
      {
        name: "HR Manager",
        email: "hr@apexengg.com",
        password: "Admin@123",
        role: "hr",
        company_id: 1,
      },
      {
        name: "Test Employee",
        email: "employee@apexengg.com",
        password: "Admin@123",
        role: "employee",
        company_id: 1,
      },
    ];

    for (const userData of testUsers) {
      const existing = await User.findOne({
        where: { email: userData.email },
      });

      if (existing) {
        console.log(`⚠️ User ${userData.email} already exists, skipping...`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(userData.password, 12);

      const user = await User.create({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role,
        company_id: userData.company_id || null,
        is_active: true,
      });
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await sequelize.close();
  }
}

insertTestUsers();
