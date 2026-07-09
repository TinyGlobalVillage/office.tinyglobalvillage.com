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
import { requireAuth } from "@/lib/api-auth";
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

/** Resolve + attribute the acting office staffer for a tgv.com internal-seam call. Gate is
 *  requireAuth (ANY office staffer, not just execs — punch-in is the desk gate now, 2026-07-09);
 *  tgv.com re-validates that the resolved members.id is is_staff, so this can't widen access
 *  beyond platform staff. Returns the seam headers or an error response. */
async function seamHeaders(req: NextRequest): Promise<NextResponse | Record<string, string>> {
  const tok = await requireAuth(req);
  if (!tok?.username) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ error: "internal_secret_unconfigured" }, { status: 503 });

  const memberId = await resolveAdminMemberId(tok.username);
  if (!memberId) return NextResponse.json({ error: "no_member_identity" }, { status: 403 });

  return {
    "content-type": "application/json",
    "x-internal-secret": secret,
    "x-operator-member-id": memberId,
  };
}

async function proxyToTgv(req: NextRequest, url: string, method: "GET" | "POST") {
  const headers = await seamHeaders(req);
  if (headers instanceof NextResponse) return headers;

  const init: RequestInit = { method, headers, cache: "no-store" };
  if (method === "POST") init.body = await req.text();

  try {
    const res = await fetch(url, init);
    const d = await res.json().catch(() => ({}));
    return NextResponse.json(d, { status: res.status });
  } catch {
    return NextResponse.json({ error: "tgv_unreachable" }, { status: 502 });
  }
}

/** Proxy a support-desk action to tgv.com over the internal seam. `path` is the /api/support/ subpath. */
export async function proxySupport(
  req: NextRequest,
  opts: { path: string; method: "GET" | "POST" },
) {
  return proxyToTgv(req, `${tgvBase()}/api/support/${opts.path}`, opts.method);
}

/** Proxy the staff time clock (punch in/out, breaks) to tgv.com's /api/staff/timeclock — the
 *  SAME clock the TIM dashboard bubble drives, attributed to the same members.id. */
export async function proxyTimeclock(req: NextRequest, method: "GET" | "POST") {
  return proxyToTgv(req, `${tgvBase()}/api/staff/timeclock`, method);
}
