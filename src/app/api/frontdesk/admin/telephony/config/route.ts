import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import {
  readTelephonyConfig,
  writeTelephonyConfig,
  type TelephonyConfig,
} from "@/lib/frontdesk/telephony-config";

// GET — current runtime config.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(readTelephonyConfig());
}

// PATCH — update one or more fields. Body: Partial<TelephonyConfig>.
// Bounds-checked in writeTelephonyConfig().
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as Partial<TelephonyConfig>;
  try {
    const next = writeTelephonyConfig(body);
    return NextResponse.json({ ok: true, by: auth.username, config: next });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
