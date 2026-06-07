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

  return NextResponse.json({ ok: true, members: rows });
}
