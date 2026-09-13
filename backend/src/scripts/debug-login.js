const { User, sequelize } = require("../models");
const bcrypt = require("bcryptjs");

async function debugLogin() {
  try {
    console.log("🔍 DEBUG: Password Comparison Test\n");
    console.log("=".repeat(50));

    const email = "admin@apexengg.com";
    const password = "Admin@123";

    console.log("1️⃣ Fetching user...");
    const user = await User.scope("withPassword").findOne({
      where: { email },
    });

    if (!user) {
      console.log("❌ User not found!");
      return;
    }

    try {
      const result = await bcrypt.compare(password, user.password);
      console.log(
        `   Password "${password}" -> ${result ? "✅ MATCH" : "❌ NO MATCH"}`,
      );
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }

    const variations = [
      password,
      password.toLowerCase(),
      password.toUpperCase(),
      password.trim(),
      "Admin@123",
      "admin123",
      "password",
    ];

    for (const testPw of variations) {
      const result = await bcrypt.compare(testPw, user.password);
      if (result) {
        console.log(`   ✅ Found match: "${testPw}"`);
        break;
      }
    }

    try {
      const result = await user.comparePassword(password);
      console.log(`   Result: ${result ? "✅ MATCH" : "❌ NO MATCH"}`);
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }

    const newHash = await bcrypt.hash(password, 12);

    const testNew = await bcrypt.compare(password, newHash);
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await sequelize.close();
  }
}

debugLogin();
