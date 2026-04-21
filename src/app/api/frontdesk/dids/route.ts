import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { isExec, toE164 } from "@/lib/frontdesk/store";
import { listDids, createDid } from "@/lib/frontdesk/dids";
import type { DidAssignment } from "@/lib/frontdesk/types";
import { orderNumber, TelnyxNotConfigured } from "@/lib/frontdesk/telnyx";

function parseAssignment(raw: unknown): DidAssignment {
  if (raw && typeof raw === "object") {
    const r = raw as { kind?: unknown; username?: unknown };
    if (r.kind === "user" && typeof r.username === "string" && r.username.trim()) {
      return { kind: "user", username: r.username.trim() };
    }
    if (r.kind === "unassigned") return { kind: "unassigned" };
  }
  return { kind: "frontdesk" };
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ dids: listDids() });
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  if (!isExec(username)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const e164 = toE164(String(body.phoneNumber ?? ""));
  if (!e164) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });

  let telnyxId: string | null = null;
  if (body.provision === true) {
    try {
      const ordered = await orderNumber(e164);
      telnyxId = ordered.id;
    } catch (err) {
      if (err instanceof TelnyxNotConfigured) {
        return NextResponse.json({ error: "Telnyx not configured" }, { status: 503 });
      }
      return NextResponse.json({ error: (err as Error).message }, { status: 502 });
    }
  }

  try {
    const did = createDid({
      e164,
      label: typeof body.label === "string" ? body.label : "",
      assignment: parseAssignment(body.assignment),
      telnyxId,
      createdBy: username,
    });
    return NextResponse.json({ did });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
