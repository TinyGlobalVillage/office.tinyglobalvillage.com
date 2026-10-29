// Deploy button API — "build on Mac, ship to RCS" for a workspace client.
// POST { client } → kick off a detached deploy (admin-gated). GET ?client=X → that
// client's latest status; GET (no client) → all deployable clients + their statuses
// (for the Deploy-page tile grid to poll). Heavy work runs in deploy-dispatch.sh.
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import {
  startDeploy, readDeploy, readDeploys, SITE_RE, SHA_RE,
  readReleases, releaseTargets, readWatcherHealth, readWatcherConfig, startPromote, startRollback,
} from "@/lib/workshop-deploy";

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
  return NextResponse.json({
    ok: true,
    deployable: DEPLOYABLE,
    deploys: readDeploys(DEPLOYABLE),
    releases: readReleases(),
    watcher: { ...readWatcherHealth(), config: readWatcherConfig() },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as {
    client?: string; action?: string; expectMono?: string; expectClient?: string | null;
  };
  const client = String(body.client ?? "");
  const action = body.action ?? "build";

  // Release flow: promote the staged build / roll back to .next.prev (deploy-watcher).
  if (action === "promote" || action === "rollback") {
    if (!SITE_RE.test(client) || !releaseTargets().some((t) => t.client === client)) {
      return NextResponse.json({ error: "not a release target" }, { status: 400 });
    }
    const kind = action === "promote" ? "deploy.promote" : "deploy.rollback";
    try {
      if (action === "promote") {
        const mono = String(body.expectMono ?? "");
        const cl = body.expectClient ? String(body.expectClient) : null;
        if (!SHA_RE.test(mono) || (cl && !SHA_RE.test(cl))) {
          return NextResponse.json({ error: "bad sha" }, { status: 400 });
        }
        startPromote(client, auth.username, { mono, client: cl });
        logHardeningAction({ action: kind, target: client, user: auth.username, success: true, details: { mono, client: cl } });
      } else {
        startRollback(client, auth.username);
        logHardeningAction({ action: kind, target: client, user: auth.username, success: true });
      }
      return NextResponse.json({ ok: true, starting: true, action, client });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logHardeningAction({ action: kind, target: client, user: auth.username, success: false, details: msg });
      return NextResponse.json({ error: msg }, { status: 409 });
    }
  }
  if (action !== "build") return NextResponse.json({ error: "unknown action" }, { status: 400 });

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
