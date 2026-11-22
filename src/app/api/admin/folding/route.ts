// GET  /api/admin/folding — every donor host's Folding@home status + the donor's public points
// POST /api/admin/folding — { host, action: "start" | "stop" | "team", team? }
//   "stop" frees the box at once (fah-client stopped + disabled, so it stays off across reboots).
// Remote side: fah-ctl over a forced-command SSH key — see src/lib/folding/hosts.ts.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { act, donorStats, statusAll } from "@/lib/folding/remote";
import type { FoldingSnapshot } from "@/lib/folding/types";

export const dynamic = "force-dynamic";

async function snapshot(): Promise<FoldingSnapshot> {
  const hosts = await statusAll();
  const donor = await donorStats(hosts.find((h) => h.reachable && h.user)?.user);
  return { hosts, donor, checkedAt: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json(await snapshot());
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const host = typeof body.host === "string" ? body.host : "";
  const action = body.action;
  if (action !== "start" && action !== "stop" && action !== "team") {
    return NextResponse.json({ error: "action must be start, stop or team" }, { status: 400 });
  }
  const team = action === "team" ? Number(body.team) : undefined;
  const res = await act(host, action, team);
  if (!res) return NextResponse.json({ error: "Unknown host or bad team number" }, { status: 400 });
  const ok = res.reachable && !res.error;
  logHardeningAction({
    action: `folding.${action}`,
    target: host,
    user: gate.username,
    success: ok,
    details: action === "team" ? { team } : ok ? null : res.error ?? null,
  });
  if (!ok) return NextResponse.json({ error: res.error || "Host did not answer", ...(await snapshot()) }, { status: 502 });
  return NextResponse.json(await snapshot());
}
