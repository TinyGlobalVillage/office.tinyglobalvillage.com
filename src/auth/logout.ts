// src/auth/logout.ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { officeDb, officeSchema } from "@/db/officeDB";
import { OFFICE_SESSION_COOKIE } from "./cookies";

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(OFFICE_SESSION_COOKIE)?.value;

  if (token) {
    // Delete the session from the DB
    await officeDb
      .delete(officeSchema.officeSessions)
      .where(eq(officeSchema.officeSessions.tokenHash, token));

    // Remove the cookie
    cookieStore.delete(OFFICE_SESSION_COOKIE);
  }

  // Back to login
  redirect("/login");
}
