// GET → serve workshop-bootstrap.sh (the onboarding one-liner curls this). Public:
// the script carries no secrets — the one-time token arrives as a CLI arg from the
// wizard's one-liner, never baked in. Single canonical copy lives in the rcs repo.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";

const SCRIPT = "/srv/refusion-core/utils/scripts/project/workshop/workshop-bootstrap.sh";

export async function GET() {
  try {
    return new NextResponse(readFileSync(SCRIPT, "utf8"), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "bootstrap script unavailable" }, { status: 500 });
  }
}
