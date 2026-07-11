// Deploy button API — "build on Mac, ship to RCS" for a workspace client.
// POST { client } → kick off a detached deploy (admin-gated). GET ?client=X → that
// client's latest status; GET (no client) → all deployable clients + their statuses
// (for the Deploy-page tile grid to poll). Heavy work runs in deploy-dispatch.sh.
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { startDeploy, readDeploy, readDeploys, SITE_RE } from "@/lib/workshop-deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// pnpm workspace clients — only these build via the mac-deploy harness (standalone-npm
// clients don't consume workspace dists). Keep in sync with pnpm-workspace.yaml.
export const DEPLOYABLE = [
  "tinyglobalvillage.com",
  "office.tinyglobalvillage.com",
  "refusionist.com",
  "giocoelho.com",
  "resonantweaver.com",
  "stepcenter.tinyglobalvillage.com",
  "demo-hq",
  "demo-fliring.tinyglobalvillage.com",
];

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const client = req.nextUrl.searchParams.get("client");
  if (client) {
    if (!SITE_RE.test(client)) return NextResponse.json({ error: "bad client" }, { status: 400 });
    return NextResponse.json({ ok: true, client, deploy: readDeploy(client) });
  }
  return NextResponse.json({ ok: true, deployable: DEPLOYABLE, deploys: readDeploys(DEPLOYABLE) });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as { client?: string };
  const client = String(body.client ?? "");
  if (!SITE_RE.test(client) || !DEPLOYABLE.includes(client)) {
    return NextResponse.json({ error: "unknown or non-deployable client" }, { status: 400 });
  }
  try {
    const jobId = startDeploy(client, auth.username);
    logHardeningAction({ action: "deploy.rebuild", target: client, user: auth.username, success: true, details: { jobId } });
    return NextResponse.json({ ok: true, starting: true, jobId, client });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logHardeningAction({ action: "deploy.rebuild", target: client, user: auth.username, success: false, details: msg });
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
