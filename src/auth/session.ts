// src/auth/session.ts
import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { officeDb, officeSchema } from "@/db/officeDB";
import { OFFICE_SESSION_COOKIE } from "./cookies";

export type OfficeUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

/**
 * Returns the current user or null (no redirect).
 */
export async function getCurrentUser(): Promise<OfficeUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(OFFICE_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  // Find session by raw token (later you can store a hash instead)
  const [session] = await officeDb
    .select()
    .from(officeSchema.officeSessions)
    .where(eq(officeSchema.officeSessions.tokenHash, token))
    .limit(1);

  if (!session) {
    return null;
  }

  // Check expiry
  if (session.expiresAt && session.expiresAt < new Date()) {
    return null;
  }

  const [user] = await officeDb
    .select()
    .from(officeSchema.officeUsers)
    .where(eq(officeSchema.officeUsers.id, session.userId))
    .limit(1);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

/**
 * Returns the current user or redirects to /login.
 */
export async function requireUser(): Promise<OfficeUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
