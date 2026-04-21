import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { archiveAlert, markAlertRead } from "@/lib/frontdesk/alerts";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  let alert = null;
  if (body.read === true) {
    alert = markAlertRead(id, username);
  }
  if (body.archive === true) {
    alert = archiveAlert(id);
  }
  if (!alert) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ alert });
}
