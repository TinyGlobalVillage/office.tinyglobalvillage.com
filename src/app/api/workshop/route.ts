// src/app/api/workshop/route.ts
// GET  → workshop jobs + slot usage + boxRamUpgraded (drives the UI's RAM guards).
// POST → start a workshop for {pkg, sites[], compute, worktree?}. Admin-only. `up`
//        runs detached; the UI polls GET for readiness. Enforces a hard RCS
//        concurrency cap pre-upgrade (the neon popup is UX; this is the real guard).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { engine, engineUpDetached, PKG_RE, SITE_RE, WORKTREE_RE } from "@/lib/workshop-engine";
import { readWorkshopSettings } from "@/lib/workshop-config";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const list = await engine(["list"]);
    return NextResponse.json({ ...list, boxRamUpgraded: readWorkshopSettings().boxRamUpgraded });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    pkg?: string; sites?: string[]; compute?: string; worktree?: string;
  };
  const pkg = (body.pkg || "").trim();
  const compute: "local" | "rcs" = body.compute === "rcs" ? "rcs" : "local";
  const sites = Array.isArray(body.sites) ? body.sites.map((s) => String(s).trim()).filter(Boolean) : [];
  const worktree = body.worktree ? String(body.worktree).trim() : undefined;

  if (!PKG_RE.test(pkg)) return NextResponse.json({ ok: false, error: "invalid pkg" }, { status: 400 });
  if (!sites.length) return NextResponse.json({ ok: false, error: "pick at least one site" }, { status: 400 });
  if (!sites.every((s) => SITE_RE.test(s))) return NextResponse.json({ ok: false, error: "invalid site in list" }, { status: 400 });
  if (worktree && !WORKTREE_RE.test(worktree)) return NextResponse.json({ ok: false, error: "invalid worktree path" }, { status: 400 });

  // Capacity pre-flight (the engine also guards its own slot tables).
  let list: any;
  try { list = await engine(["list"]); } catch (e) { return NextResponse.json({ ok: false, error: String(e) }, { status: 500 }); }
  const jobs: any[] = list.jobs || [];
  const { boxRamUpgraded } = readWorkshopSettings();

  if (compute === "rcs") {
    // Hard OOM guard: the 7GB box holds ~1 live compile until the RAM upgrade.
    const rcsCap = boxRamUpgraded ? (list.rcsSlotsTotal || 8) : 1;
    const liveRcs = jobs
      .filter((j) => j.compute === "rcs" && j.status !== "down")
      .reduce((n, j) => n + (j.instances?.length || j.sites?.length || 0), 0);
    if (liveRcs + sites.length > rcsCap) {
      return NextResponse.json(
        { ok: false, error: boxRamUpgraded ? "all RCS preview slots are in use" : "RCS is capped at 1 live workshop until the Box RAM upgrade lands" },
        { status: 409 },
      );
    }
  } else {
    const liveLocal = jobs
      .filter((j) => j.compute === "local" && j.status !== "down")
      .reduce((n, j) => n + (j.instances?.length || j.sites?.length || 0), 0);
    if (liveLocal + sites.length > (list.macSlotsTotal || 8)) {
      return NextResponse.json({ ok: false, error: "all local (Mac) slots are in use" }, { status: 409 });
    }
  }

  engineUpDetached(pkg, sites, compute, auth.username, worktree);
  logHardeningAction({
    action: "workshop.up",
    target: `${pkg} × [${sites.join(", ")}] · ${compute}`,
    user: auth.username,
    success: true,
  });
  return NextResponse.json({ ok: true, starting: true, pkg, sites, compute });
}
