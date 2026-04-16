import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getUserSettings, saveUserSettings } from "@/lib/email-settings-store";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(getUserSettings(token.username ?? "unknown"));
}

export async function PATCH(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const patch = await req.json().catch(() => ({}));
  return NextResponse.json(saveUserSettings(token.username ?? "unknown", patch));
}
