// POST /api/admin/host-metrics/disk/sweep — preview, then reclaim.
//
//   { targetId }                → PREVIEW. Lists exactly what would go, and how
//                                 much that frees. Touches nothing.
//   { targetId, apply: true }   → does it.
//
// Preview is the default because the interesting failure here is not "the button
// didn't work", it's "the button worked and I didn't know what it would do".
//
// The request names a target, never a path — see disk-targets.ts. Applies are
// audit-logged with the byte count and the first paths, so the log answers
// "where did 32GB go" a month from now.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { applySweep, planSweep } from "@/lib/host-metrics/disk-usage";
import { targetById } from "@/lib/host-metrics/disk-targets";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
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
  const apply = o.apply === true;

  const target = targetById(targetId);
  if (!target) return NextResponse.json({ error: "unknown target" }, { status: 404 });

  const plan = await planSweep(targetId);
  if (!apply) return NextResponse.json({ mode: "preview", target: target.label, plan });

  if (!plan.armed) {
    return NextResponse.json(
      { error: plan.reason ?? "not armed", mode: "apply", plan },
      { status: 409 },
    );
  }

  const result = await applySweep(targetId);

  logHardeningAction({
    action: "host-metrics.disk.sweep",
    target: target.label,
    user: gate.username,
    success: result.errors.length === 0,
    details: {
      targetId,
      path: target.path,
      removed: String(result.removed),
      // Both, always: the gap between them is the hardlink story, and a log that
      // only kept the plan's number would repeat the same lie a month later.
      freedBytes: String(result.freedBytes),
      claimedBytes: String(result.claimedBytes),
      // Enough to recognise what went without pasting a hundred paths into the log.
      sample: plan.candidates.slice(0, 5).map((c) => c.path).join(", ") || plan.opaqueCommand || "—",
      ...(result.errors.length ? { errors: result.errors.slice(0, 3).join(" · ") } : {}),
    },
  });

  return NextResponse.json({ mode: "apply", target: target.label, result });
}
