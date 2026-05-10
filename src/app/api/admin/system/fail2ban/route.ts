import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { allJailStatus } from "@/lib/system/fail2ban";

// GET /api/admin/system/fail2ban — RCS-wide jail snapshot.
// Used by every HardeningControlModal that wants to surface fail2ban
// posture (telephony, future postgres/ssh/nginx modals, etc.).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const jails = await allJailStatus();
    return NextResponse.json({ jails });
  } catch (err) {
    return NextResponse.json(
      { error: "fail2ban-client failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
