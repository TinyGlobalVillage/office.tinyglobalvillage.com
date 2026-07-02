import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

// nginx auth_request backend for the /sip-ws WebSocket location.
//
// The SIP WebSocket (browser softphone → FreeSWITCH) must NEVER be reachable
// without an Office login (Gio directive 2026-07-02): nginx sub-requests this
// endpoint with the original cookies before allowing the WS upgrade; 204 lets
// the handshake through, 401 blocks it. Same-origin browser WS handshakes send
// the tgv_member_session cookie automatically, so legit softphones pass
// transparently. This is the transport gate — SIP digest auth (challenges) is
// enforced separately inside FreeSWITCH.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return new NextResponse(null, { status: 401 });
  return new NextResponse(null, { status: 204 });
}
