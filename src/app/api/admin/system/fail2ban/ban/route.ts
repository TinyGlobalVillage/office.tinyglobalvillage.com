import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { banIp, unbanIp } from "@/lib/system/fail2ban";

// POST /api/admin/system/fail2ban/ban
// Body: { jail: string, ip: string, action: "ban" | "unban" }
// Used by HardeningControlModal panels (per-jail ban/unban controls).
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => ({}));
  const jail = String(body.jail ?? "");
  const ip = String(body.ip ?? "");
  const action = body.action as string;
  if (!jail || !ip || (action !== "ban" && action !== "unban")) {
    return NextResponse.json(
      { error: "body must include {jail, ip, action: 'ban'|'unban'}" },
      { status: 400 },
    );
  }
  try {
    if (action === "ban") await banIp(jail, ip);
    else await unbanIp(jail, ip);
    return NextResponse.json({ ok: true, jail, ip, action, by: auth.username });
  } catch (err) {
    return NextResponse.json(
      { error: "fail2ban-client failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
