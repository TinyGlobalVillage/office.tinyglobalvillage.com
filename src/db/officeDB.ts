// src/db/officeDB.ts
import 'dotenv/config';
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as officeSchema from "./schema";

const pool = new Pool({
  connectionString: process.env.OFFICE_DATABASE_URL,
});

export const officeDb = drizzle(pool, { schema: officeSchema });
export { officeSchema };
