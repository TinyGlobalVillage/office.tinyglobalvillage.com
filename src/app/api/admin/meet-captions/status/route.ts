// GET /api/admin/meet-captions/status — live status for the MeetCaptionsControlModal.
//
// Proxies the meet-captions control plane (localhost-only, bearer-token — see
// services/meet-captions) so the tile can show: service reachable?, whisper engine online?,
// which rooms are being captioned right now. Read-only. Gated by requireAdmin.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";

export const runtime = "nodejs";

const SERVICE_URL = () => process.env.MEET_CAPTIONS_URL ?? "http://127.0.0.1:3120";
const SERVICE_TOKEN = () => process.env.MEET_CAPTIONS_TOKEN ?? "";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  try {
    const res = await fetch(`${SERVICE_URL()}/status`, {
      headers: { Authorization: `Bearer ${SERVICE_TOKEN()}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return NextResponse.json({ service: "error", status: res.status });
    const body = (await res.json()) as Record<string, unknown>;
    return NextResponse.json({ service: "online", ...body });
  } catch {
    return NextResponse.json({ service: "offline" });
  }
}
