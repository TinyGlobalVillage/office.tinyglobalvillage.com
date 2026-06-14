// POST /api/admin/wallet/advance — Office operator proxy to tgv.com's withdrawal queue transitions.
//
//   POST { op:'approve'|'markPaid'|'markFailed'|'cancel', withdrawalId, env, externalRef?, note? }
//
// The cash-out transitions reverse the `cash` ledger and MUST run tgv.com's engine — Office never
// touches the ledger. This proxies server-to-server with INTERNAL_API_SECRET (the operator-auth
// seam), attributing the audit to the operator's legacy users.id (x-operator-actor-id). Reads (the
// queue/history) live in ../queue (direct tgv_db read); this route is WRITES only.
//
// Gated by Office requireAdmin. tgv.com ADDITIONALLY 403s every transition until its launch flag
// (WITHDRAWALS_ENABLED) is on — so these are inert until launch. Slice 3 is built ready, not live.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { resolveAdminActorId } from "@/lib/admin-actor";

export const runtime = "nodejs";

function tgvBase(): string {
  return (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");
}

const OPS = new Set(["approve", "markPaid", "markFailed", "cancel"]);

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ error: "internal_secret_unconfigured" }, { status: 503 });

  // Resolve the operator's legacy users.id so tgv.com attributes the transition audit to the human.
  const actorId = await resolveAdminActorId(gate.username);
  if (!actorId) return NextResponse.json({ error: "no_actor_for_audit" }, { status: 500 });

  const body = (await req.json().catch(() => null)) as
    | { op?: string; withdrawalId?: string; env?: string; externalRef?: string; note?: string }
    | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const op = typeof body.op === "string" ? body.op : "";
  if (!OPS.has(op)) return NextResponse.json({ error: "unknown_op" }, { status: 400 });
  const withdrawalId = typeof body.withdrawalId === "string" ? body.withdrawalId.trim() : "";
  if (!withdrawalId) return NextResponse.json({ error: "withdrawalId_required" }, { status: 400 });
  const env = body.env === "test" ? "test" : "live";

  // Forward only the fields tgv.com's advance route reads.
  const forward: Record<string, string> = { op, withdrawalId };
  if (typeof body.externalRef === "string" && body.externalRef.trim()) forward.externalRef = body.externalRef.trim();
  if (typeof body.note === "string" && body.note.trim()) forward.note = body.note.trim();

  try {
    const res = await fetch(`${tgvBase()}/api/wallet/withdrawal/advance?env=${env}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": secret,
        "x-operator-actor-id": actorId,
      },
      body: JSON.stringify(forward),
      cache: "no-store",
    });
    const d = await res.json().catch(() => ({}));
    return NextResponse.json(d, { status: res.status });
  } catch {
    return NextResponse.json({ error: "tgv_unreachable" }, { status: 502 });
  }
}
