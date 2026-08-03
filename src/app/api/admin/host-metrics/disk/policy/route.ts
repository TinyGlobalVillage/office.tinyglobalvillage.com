// PATCH /api/admin/host-metrics/disk/policy — the knobs behind a gear.
//
//   { targetId, enabled?, minAgeDays?, keep? }
//
// Which directory a target points at and what a sweep does to it are code, not
// data (disk-targets.ts). This endpoint can only change HOW OLD, HOW MANY KEPT,
// and WHETHER THE BUTTON IS ARMED — within clamps, for a target that already
// opted in to being sweepable.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { allPolicies, policyFor, writePolicy } from "@/lib/host-metrics/disk-policy";
import { targetById } from "@/lib/host-metrics/disk-targets";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json(allPolicies());
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const targetId = typeof o.targetId === "string" ? o.targetId : "";

  const target = targetById(targetId);
  if (!target) return NextResponse.json({ error: "unknown target" }, { status: 404 });
  if (!target.sweep) {
    return NextResponse.json(
      { error: "target is measured only — there is no policy to set" },
      { status: 409 },
    );
  }

  const before = policyFor(target);
  const next = writePolicy(targetId, {
    ...(typeof o.enabled === "boolean" ? { enabled: o.enabled } : {}),
    ...(typeof o.minAgeDays === "number" ? { minAgeDays: o.minAgeDays } : {}),
    ...(typeof o.keep === "number" ? { keep: o.keep } : {}),
  });
  if (!next) return NextResponse.json({ error: "not writable" }, { status: 409 });

  const changed = (["enabled", "minAgeDays", "keep"] as const).filter((k) => before[k] !== next[k]);
  if (changed.length) {
    // Arming a delete is a security-relevant change, so it lands in the same log
    // as the thresholds rather than quietly in a JSON file.
    logHardeningAction({
      action: "host-metrics.disk.policy",
      target: target.label,
      user: gate.username,
      success: true,
      details: Object.fromEntries(
        changed.map((k) => [k, `${String(before[k])} → ${String(next[k])}`]),
      ),
    });
  }

  return NextResponse.json(next);
}
