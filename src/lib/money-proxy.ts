// src/lib/money-proxy.ts
// Office → tgv.com proxy for the Villagers "Money & Stores" tile. Office holds no money state; the
// per-site money config (public.site_money_config) is tgv.com-owned, so every read/write runs on
// tgv.com via the internal-secret seam (mirrors managed-proxy). tgv.com re-validates everything —
// it resolves the site's OWNER and re-checks ownership before touching a wallet/stripe axis.
// Operator-only (requireAdmin). Fails CLOSED.
//
// Every successful POST (axis change) is also audited to the shared `admin_audit_log` table
// (same pattern as src/app/api/admin/studio/config/route.ts) so operators have a reconstructable
// timeline of who changed a site's wallet/Stripe config and when. Audit writes are best-effort:
// a failure there must never break the tgv.com proxy response, so the whole audit block is wrapped
// in its own try/catch. Unlike the studio-config route (which hard-fails the request when the
// operator's actor id can't be resolved, since that route's sole job is a gated+audited write),
// money-proxy silently skips the audit row on an unresolved actor — the proxy's job is the money
// write, and that must succeed/fail on tgv.com's terms alone.
import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { resolveAdminActorId } from "@/lib/admin-actor";
import { db, schema } from "@/lib/db-drizzle";

function tgvBase(): string {
  return (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");
}

// Internal-secret GET of a site's current money config — reused for the GET leg's own passthrough
// AND (ahead of a POST) to snapshot the audit `before` state. Best-effort: null on any failure so a
// tgv.com hiccup never blocks the write it's only trying to log.
async function fetchSiteMoneyConfig(
  siteId: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  try {
    const url = new URL(`${tgvBase()}/api/platform/site-money`);
    url.searchParams.set("siteId", siteId);
    const res = await fetch(url.toString(), {
      headers: { "x-internal-secret": secret },
      cache: "no-store",
    });
    const d = await res.json().catch(() => ({}) as Record<string, unknown>);
    return res.ok ? ((d?.config as Record<string, unknown>) ?? null) : null;
  } catch {
    return null;
  }
}

export async function proxySiteMoney(req: NextRequest, method: "GET" | "POST") {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ error: "internal_secret_unconfigured" }, { status: 503 });

  const inUrl = new URL(req.url);
  const url = new URL(`${tgvBase()}/api/platform/site-money`);

  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", "x-internal-secret": secret },
    cache: "no-store",
  };

  // Client POST body shape: { siteId, axis: "wallet"|"stripe", pooled?, shareFromMemberId? }.
  // Parsed (not just forwarded) so the operator's write can be attributed + snapshotted for audit.
  let parsedBody: { siteId?: string; axis?: string } | null = null;
  if (method === "GET") {
    const siteId = inUrl.searchParams.get("siteId");
    if (siteId) url.searchParams.set("siteId", siteId);
  } else {
    const bodyText = await req.text();
    init.body = bodyText;
    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      parsedBody = null;
    }
  }

  // Audit `before` snapshot — taken ahead of the write so it reflects genuine pre-change state.
  // Only meaningful for a POST with a resolvable siteId.
  const before =
    method === "POST" && parsedBody?.siteId
      ? await fetchSiteMoneyConfig(parsedBody.siteId, secret)
      : null;

  try {
    const res = await fetch(url.toString(), init);
    const d = await res.json().catch(() => ({}) as Record<string, unknown>);

    if (method === "POST" && res.ok && parsedBody?.siteId && parsedBody?.axis) {
      try {
        const actorUserId = await resolveAdminActorId(gate.username);
        if (actorUserId) {
          await db.insert(schema.adminAuditLog).values({
            actorUserId,
            action: "site-money.set-axis",
            targetType: "site_money_config",
            targetId: parsedBody.siteId,
            before,
            after: (d?.config as Record<string, unknown>) ?? null,
            note: `axis=${parsedBody.axis} — by ${gate.username}`,
          });
        }
      } catch {
        // Audit failure must never break the proxy response.
      }
    }

    return NextResponse.json(d, { status: res.status });
  } catch {
    return NextResponse.json({ error: "tgv_unreachable" }, { status: 502 });
  }
}
