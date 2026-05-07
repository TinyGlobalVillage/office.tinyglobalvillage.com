import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id, dryRun = true } = (await req.json()) as { id: string; dryRun?: boolean };
  const startedAt = new Date().toISOString();
  return NextResponse.json({
    ok: true,
    id,
    dryRun,
    startedAt,
    note: "Stub — wire to /srv/refusion-core/utils/scripts/automations/<id>/check.ts when implementing each automation.",
  });
}
