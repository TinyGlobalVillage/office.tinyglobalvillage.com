// src/app/api/demo-tgv/operator-link/route.ts
// Admin-only. Mints a short-lived HMAC token (shared secret DEMO_OPERATOR_HMAC_KEY, held
// by Office + tgv.com + the demo) and returns the demo OPERATOR sign-in URL. Opening it
// logs the staff member into the SHARED tgv_demo master to curate DemoTGV in the page
// editor. The token is generated server-side so the secret never reaches the browser.
import { type NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_ORIGIN =
  process.env.DEMO_TGV_ORIGIN || "https://demo.tinyglobalvillage.com";

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const key = process.env.DEMO_OPERATOR_HMAC_KEY || "";
  if (!key) {
    return NextResponse.json(
      { error: "DemoTGV operator link not configured (missing DEMO_OPERATOR_HMAC_KEY)" },
      { status: 500 },
    );
  }

  const exp = String(Date.now() + 5 * 60 * 1000); // 5-min token
  const sig = createHmac("sha256", key).update(exp).digest("hex");
  const url = `${DEMO_ORIGIN}/api/auth/operator-login?t=${exp}.${sig}`;

  try {
    logHardeningAction({
      action: "demo-tgv.operator-link",
      user: gate.username,
      success: true,
      details: "minted DemoTGV operator sign-in link",
    });
  } catch {
    /* audit is best-effort */
  }

  return NextResponse.json({ url });
}
