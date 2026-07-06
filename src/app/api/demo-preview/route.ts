// src/app/api/demo-preview/route.ts
// GET  → live preview instances + slot usage.
// POST → start a preview for {pkg, tenant}. Admin-only. `up` runs detached; the
//        UI polls GET for readiness. Rejects when all 8 slots are busy or the
//        (pkg,tenant) preview is already running.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { engine, engineUpDetached, PKG_RE, TENANT_RE } from "@/lib/demo-preview-engine";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const status = await engine(["status"]);
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as { pkg?: string; tenant?: string };
  const pkg = (body.pkg || "").trim();
  const tenant = (body.tenant || "").trim();
  if (!PKG_RE.test(pkg) || !TENANT_RE.test(tenant)) {
    return NextResponse.json({ ok: false, error: "invalid pkg or tenant" }, { status: 400 });
  }

  // Pre-flight against current state for a friendly error (the engine also guards).
  let status: any;
  try {
    status = await engine(["status"]);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
  const insts: any[] = status.instances || [];
  if (insts.some((i) => i.pkg === pkg && i.tenant === tenant && i.status !== "error")) {
    return NextResponse.json({ ok: false, error: "already running for this package + tenant" }, { status: 409 });
  }
  if (insts.filter((i) => i.status !== "error").length >= (status.slotsTotal || 8)) {
    return NextResponse.json({ ok: false, error: "all preview slots are in use" }, { status: 409 });
  }

  engineUpDetached(pkg, tenant, auth.username);
  logHardeningAction({ action: "demo-mode.up", target: `${pkg} × ${tenant}`, user: auth.username, success: true });
  return NextResponse.json({ ok: true, starting: true, pkg, tenant });
}
