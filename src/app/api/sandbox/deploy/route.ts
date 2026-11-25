import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { filePromoteRequests, readWatcherConfig } from "@/lib/workshop-deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/sandbox/deploy
 * Body: { components: ["@tgv/module-ui"], targets?: ["refusionist.com"], preview?: boolean }
 *
 * Admin-only. Files a durable deploy request (deploy-request.sh) per target client for
 * origin/main as it is now; deploy-watch stages main and promotes it (Office → Deploy →
 * Releases shows it and can cancel it). Code reaches main through a lane push first —
 * this button never commits. Replaces the retired tgv-component-webhook (2026-11-25).
 * No targets → every release target the deploy watcher tracks.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: { components?: string[]; targets?: string[]; preview?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const targets = body.targets?.length ? body.targets : readWatcherConfig().targets;
  if (!targets.length) return NextResponse.json({ error: "no deploy targets" }, { status: 400 });

  if (body.preview) {
    return NextResponse.json({ preview: true, plan: { components: body.components ?? [], targets } });
  }

  try {
    const { mono, filed } = await filePromoteRequests(targets, auth.username);
    const failed = filed.filter((f) => !f.ok);
    logHardeningAction({
      action: "deploy.request", target: targets.join(","), user: auth.username,
      success: failed.length === 0, details: { source: "sandbox", mono, filed },
    });
    if (failed.length === filed.length) {
      return NextResponse.json({ error: failed[0]?.error ?? "deploy request failed", filed }, { status: 502 });
    }
    return NextResponse.json({ accepted: true, mono, filed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
