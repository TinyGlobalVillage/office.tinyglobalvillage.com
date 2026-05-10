import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readUfw, allowFrom, denyFromIp, deleteRule } from "@/lib/system/ufw";

// GET /api/admin/system/ufw — RCS-wide rule list.
// Used by every HardeningControlModal.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const snap = await readUfw();
    return NextResponse.json(snap);
  } catch (err) {
    return NextResponse.json(
      { error: "ufw read failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}

// POST /api/admin/system/ufw
// Body shape (one of):
//   { action: "allow", source: "<ip|cidr>", port?: "<num>", proto?: "tcp"|"udp", comment: "<text>" }
//   { action: "deny",  source: "<ip|cidr>", comment: "<text>" }
//   { action: "delete", index: <number> }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  try {
    if (action === "allow") {
      await allowFrom({
        source: String(body.source ?? ""),
        port: body.port ? String(body.port) : undefined,
        proto: body.proto as "tcp" | "udp" | undefined,
        comment: String(body.comment ?? `added by ${auth.username} ${new Date().toISOString().slice(0, 10)}`),
      });
    } else if (action === "deny") {
      await denyFromIp(
        String(body.source ?? ""),
        String(body.comment ?? `manual block by ${auth.username} ${new Date().toISOString().slice(0, 10)}`),
      );
    } else if (action === "delete") {
      await deleteRule(Number(body.index));
    } else {
      return NextResponse.json(
        { error: "action must be 'allow' | 'deny' | 'delete'" },
        { status: 400 },
      );
    }
    const snap = await readUfw();
    return NextResponse.json({ ok: true, action, by: auth.username, snapshot: snap });
  } catch (err) {
    return NextResponse.json(
      { error: "ufw operation failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
