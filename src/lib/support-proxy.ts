// src/lib/support-proxy.ts
// Office Front Desk "Tickets" tab → tgv.com's support desk (/api/support/queue/*). Office holds no
// support logic; it forwards over the internal seam (INTERNAL_API_SECRET + x-operator-member-id),
// so a claim/reply/complete from the Office Front Desk is the SAME atomic operation on the SAME
// support_tickets rows as the dashboard chat-bubble Support queue. tgv.com re-validates everything.
//
// The support desk attributes the real staffer by members.id; Office resolves its operator
// (office username → roster email → members.id), mirroring resolveAdminActorId (which resolves
// the legacy users.id for the audit log).
import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { pgPool } from "./pg-pool";
import { rosterEmailForUsername } from "./member-auth/bridge";

const memberIdCache = new Map<string, string>();

/** Office staff username → their members.id (the support staff identity). Cached per worker. */
export async function resolveAdminMemberId(
  officeUsername: string | null | undefined,
): Promise<string | null> {
  if (!officeUsername) return null;
  const cached = memberIdCache.get(officeUsername);
  if (cached) return cached;
  const email = rosterEmailForUsername(officeUsername); // lowercased, roster-backed
  if (!email) return null;
  const { rows } = await pgPool.query<{ id: string }>(
    "SELECT id FROM members WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1",
    [email],
  );
  const id = rows[0]?.id;
  if (id) memberIdCache.set(officeUsername, id);
  return id ?? null;
}

function tgvBase(): string {
  return (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");
}

/** Proxy a support-desk action to tgv.com over the internal seam. `path` is the /api/support/ subpath. */
export async function proxySupport(
  req: NextRequest,
  opts: { path: string; method: "GET" | "POST" },
) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ error: "internal_secret_unconfigured" }, { status: 503 });

  const memberId = await resolveAdminMemberId(gate.username);
  if (!memberId) return NextResponse.json({ error: "no_member_identity" }, { status: 403 });

  const init: RequestInit = {
    method: opts.method,
    headers: {
      "content-type": "application/json",
      "x-internal-secret": secret,
      "x-operator-member-id": memberId,
    },
    cache: "no-store",
  };
  if (opts.method === "POST") init.body = await req.text();

  try {
    const res = await fetch(`${tgvBase()}/api/support/${opts.path}`, init);
    const d = await res.json().catch(() => ({}));
    return NextResponse.json(d, { status: res.status });
  } catch {
    return NextResponse.json({ error: "tgv_unreachable" }, { status: 502 });
  }
}
