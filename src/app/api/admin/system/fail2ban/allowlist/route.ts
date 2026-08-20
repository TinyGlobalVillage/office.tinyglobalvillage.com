import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { addIgnoreIp, removeIgnoreIp } from "@/lib/system/fail2ban";

// POST /api/admin/system/fail2ban/allowlist
// Body: { jail: string, cidr: string, action: "add" | "remove" }
//
// The ignore list is the other half of a jail: ban decides who gets shut
// out, this decides who can never be. It matters most on a permaban jail
// (freeswitch-toll-fraud runs bantime = -1), where a false positive on a
// carrier's own address has no expiry to undo it.
//
// Runtime only — fail2ban forgets these on restart. The durable list is the
// `ignoreip =` line in the jail's file under /etc/fail2ban/jail.d/.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => ({}));
  const jail = String(body.jail ?? "");
  const cidr = String(body.cidr ?? "").trim();
  const action = body.action as string;
  if (!jail || !cidr || (action !== "add" && action !== "remove")) {
    return NextResponse.json(
      { error: "body must include {jail, cidr, action: 'add'|'remove'}" },
      { status: 400 },
    );
  }
  try {
    if (action === "add") await addIgnoreIp(jail, cidr);
    else await removeIgnoreIp(jail, cidr);
    return NextResponse.json({ ok: true, jail, cidr, action, by: auth.username });
  } catch (err) {
    return NextResponse.json(
      { error: "fail2ban-client failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
