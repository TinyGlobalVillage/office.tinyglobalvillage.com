// /api/hardening/domain-dns — operator surface for the NS-drift watchdog (System Hardening).
//   GET  → { checked, driftCount, domains[] } — read-only compare of each TGV-managed domain's
//          live registrar delegation against its Cloudflare zone's nameservers.
//   POST → { fqdn } → one-click "Re-wire to CF" (ensureZone + point the registrar at it).
//
// Thin proxy to the Domain Console engine (127.0.0.1:3110), which is the only process holding
// the OpenSRS + Cloudflare credentials. Per the Hardening-UTILS rule this defensive mechanism
// must be visible AND actionable from Office, not CLI-only. Register/transfer auto-wire now,
// so drift here means someone changed nameservers at the registrar, a zone was deleted, or an
// auto-wire failed — the condition that silently lapsed resonantweaver.com's zone.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENGINE = (process.env.DC_SERVICE_URL || "http://127.0.0.1:3110").replace(/\/$/, "");
const TOKEN = process.env.DC_SERVICE_TOKEN || "";

function engineHeaders(): HeadersInit {
  return { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!TOKEN) return NextResponse.json({ ok: false, error: "engine_token_missing" }, { status: 500 });
  try {
    const r = await fetch(`${ENGINE}/api/internal/domains/ns-drift`, {
      headers: engineHeaders(),
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    return NextResponse.json(j, { status: r.status });
  } catch (e) {
    console.error("[hardening:domain-dns] engine unreachable", e);
    return NextResponse.json({ ok: false, error: "engine_unreachable" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!TOKEN) return NextResponse.json({ ok: false, error: "engine_token_missing" }, { status: 500 });
  const body = await req.json().catch(() => ({}));
  const fqdn = typeof body?.fqdn === "string" ? body.fqdn.trim() : "";
  if (!fqdn) return NextResponse.json({ ok: false, error: "fqdn_required" }, { status: 400 });
  try {
    const r = await fetch(`${ENGINE}/api/internal/domains/ns-rewire`, {
      method: "POST",
      headers: engineHeaders(),
      body: JSON.stringify({ fqdn }),
    });
    const j = await r.json().catch(() => ({}));
    return NextResponse.json(j, { status: r.status });
  } catch (e) {
    console.error("[hardening:domain-dns] rewire failed", e);
    return NextResponse.json({ ok: false, error: "engine_unreachable" }, { status: 502 });
  }
}
