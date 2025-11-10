// src/db/test-connection.ts
import { officeDb, officeSchema } from "./officeDB";

async function main() {
  try {
    // Insert a dummy user
    const [user] = await officeDb
      .insert(officeSchema.officeUsers)
      .values({
        email: "test@tinyglobalvillage.com",
        name: "DB Test",
        role: "staff",
      })
      .returning();

    console.log("Inserted:", user);

    // Query all users
    const users = await officeDb.select().from(officeSchema.officeUsers);
    console.table(users);
  } catch (err) {
    console.error("❌ Database test failed:", err);
  } finally {
    process.exit();
  }
}

main();
