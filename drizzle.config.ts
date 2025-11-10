// ~/rcs/client/office.tinyglobalvillage.com/drizzle.config.ts

import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema/index.ts",
  out: "./drizzle/office",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.OFFICE_DATABASE_URL!,
  },
} satisfies Config;
