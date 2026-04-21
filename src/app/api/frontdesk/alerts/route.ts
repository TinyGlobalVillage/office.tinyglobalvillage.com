import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { listAlerts } from "@/lib/frontdesk/alerts";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("archived") === "1";
  return NextResponse.json({ alerts: listAlerts({ includeArchived }) });
}
