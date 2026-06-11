import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Member-aware admin gate (the legacy NextAuth auth() was retired 2026-06-05
  // and returns null in prod). requireAdmin also enforces role==="admin".
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const rows = await db
    .select()
    .from(schema.members)
    .orderBy(desc(schema.members.createdAt));

  // 'pending' = created during the wizard but NOT yet paid/provisioned. These are
  // in-flight or abandoned signups — they must NOT masquerade as real members. Surface
  // them separately as `incomplete` so operators can see/GC them without them polluting
  // the members roster. A member becomes "real" once payment flips it to deploying/live.
  const members = rows.filter((m) => m.deployStatus !== "pending");
  const incomplete = rows.filter((m) => m.deployStatus === "pending");

  return NextResponse.json({ ok: true, members, incomplete });
}
