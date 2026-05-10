import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db-drizzle";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(schema.members)
    .orderBy(desc(schema.members.createdAt));

  return NextResponse.json({ ok: true, members: rows });
}
