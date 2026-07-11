// Build-targets config API — backs the Utils "Build Targets" hardening modal.
// GET → the ordered build-target list (Mac first, RCS last-resort). PUT → replace it.
// This is the tunable surface for "where do deploys build" + the RCS-last-resort toggle.
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { readBuildTargets, writeBuildTargets, type BuildTargetsConfig } from "@/lib/workshop-deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// alias/name/path chars only — no shell metacharacters (these feed an ssh command in bash)
const SAFE = /^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ ok: true, config: readBuildTargets() });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => null)) as Partial<BuildTargetsConfig> | null;
  if (!body || !Array.isArray(body.targets)) {
    return NextResponse.json({ error: "targets[] required" }, { status: 400 });
  }
  for (const t of body.targets) {
    if (!t?.name || !t?.sshAlias || !SAFE.test(t.name) || !SAFE.test(t.sshAlias) || (t.wsRoot && !SAFE.test(t.wsRoot))) {
      return NextResponse.json({ error: "invalid target entry (name/sshAlias/wsRoot)" }, { status: 400 });
    }
  }
  const prev = readBuildTargets();
  const cfg: BuildTargetsConfig = {
    _comment: prev._comment,
    targets: body.targets.map((t) => ({
      name: t.name,
      sshAlias: t.sshAlias,
      wsRoot: t.wsRoot || "Documents/REFUSIONBOX/MAC RCS",
      note: t.note || "",
    })),
    lastResort: body.lastResort === false ? false : "rcs",
    reachTimeoutSec: Number(body.reachTimeoutSec) || 5,
  };
  writeBuildTargets(cfg);
  logHardeningAction({
    action: "deploy.targets.update",
    user: auth.username,
    success: true,
    details: { count: cfg.targets.length, lastResort: cfg.lastResort },
  });
  return NextResponse.json({ ok: true, config: cfg });
}
