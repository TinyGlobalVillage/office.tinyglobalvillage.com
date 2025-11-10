// src/app/login/actions.ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { officeDb, officeSchema } from "@/db/officeDB";
import { OFFICE_SESSION_COOKIE, OFFICE_SESSION_MAX_AGE } from "@/auth/cookies";

export async function loginWithEmail(formData: FormData) {
  const rawEmail = formData.get("email");

  if (typeof rawEmail !== "string" || !rawEmail.trim()) {
    // Later: surface a proper error; for now just bail.
    return;
  }

  const email = rawEmail.trim().toLowerCase();

  // 1) Find existing user or create a new one.
  const [existingUser] = await officeDb
    .select()
    .from(officeSchema.officeUsers)
    .where(eq(officeSchema.officeUsers.email, email))
    .limit(1);

  let user = existingUser;

  if (!user) {
    const [created] = await officeDb
      .insert(officeSchema.officeUsers)
      .values({
        email,
        name: email, // later you can collect/display real names
        role: "staff", // you can manually promote in DB for now
      })
      .returning();

    user = created;
  }

  // 2) Create a new session token
  const token = crypto.randomUUID();

  await officeDb.insert(officeSchema.officeSessions).values({
    userId: user.id,
    tokenHash: token, // later: store a hash instead, for extra safety
    expiresAt: new Date(Date.now() + OFFICE_SESSION_MAX_AGE * 1000),
  });

  // 3) Set the session cookie
  const cookieStore = await cookies();
  cookieStore.set(OFFICE_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OFFICE_SESSION_MAX_AGE,
  });

  // 4) Redirect to the dashboard
  redirect("/dashboard");
}
