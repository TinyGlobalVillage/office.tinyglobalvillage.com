import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

// Server-issued SIP credentials for the browser softphone.
//
// Replaced the prior NEXT_PUBLIC_SIP_* env-var scheme that baked the SIP
// password into every browser bundle (telephony-security Item 1, 2026-05-01).
// The password now lives only in process.env on the server, and is handed to
// authenticated TGV Office users on demand. Phase 2 will swap the static
// password for an HMAC-derived ephemeral token validated by FreeSWITCH via
// mod_xml_curl; this endpoint shape (auth-gated GET → JSON creds) stays.
//
// Response shape is intentionally narrow — the browser uses these four
// strings to construct the SIP.js UserAgent and nothing else.
export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wsUrl = process.env.FRONTDESK_SIP_WS_URL;
  const domain = process.env.FRONTDESK_SIP_DOMAIN;
  const user = process.env.FRONTDESK_SIP_USER;
  const password = process.env.FRONTDESK_SIP_PASSWORD;
  const displayName = process.env.FRONTDESK_SIP_DISPLAY_NAME ?? "TGV Front Desk";

  if (!wsUrl || !domain || !user || !password) {
    return NextResponse.json(
      { error: "FRONTDESK_SIP_* not configured" },
      { status: 503 },
    );
  }

  // no-store: the password rotates server-side; never let an intermediary
  // (browser cache, CDN, service worker) hold a stale value.
  return new NextResponse(
    JSON.stringify({ wsUrl, domain, user, password, displayName }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    },
  );
}
