import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { isExec } from "@/lib/frontdesk/store";
import { getShift, setShift } from "@/lib/frontdesk/shift";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ shift: getShift() });
}

export async function PUT(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = token.username ?? token.sub ?? "";
  if (!isExec(actor)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const username: string | null =
    typeof body.username === "string" && body.username.trim()
      ? body.username.trim()
      : null;
  return NextResponse.json({ shift: setShift(username, actor) });
}
