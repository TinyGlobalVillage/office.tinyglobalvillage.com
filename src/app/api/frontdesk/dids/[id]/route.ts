import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { isExec } from "@/lib/frontdesk/store";
import { getDid, renameDid, updateDidAssignment, releaseDid } from "@/lib/frontdesk/dids";
import type { DidAssignment } from "@/lib/frontdesk/types";
import { releaseNumber, TelnyxNotConfigured } from "@/lib/frontdesk/telnyx";

function parseAssignment(raw: unknown): DidAssignment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { kind?: unknown; username?: unknown };
  if (r.kind === "frontdesk") return { kind: "frontdesk" };
  if (r.kind === "unassigned") return { kind: "unassigned" };
  if (r.kind === "user" && typeof r.username === "string" && r.username.trim()) {
    return { kind: "user", username: r.username.trim() };
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const did = getDid(id);
  if (!did) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ did });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  if (!isExec(username)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  let did = getDid(id);
  if (!did) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (typeof body.label === "string") {
    did = renameDid(id, body.label) ?? did;
  }
  const assignment = parseAssignment(body.assignment);
  if (assignment) {
    did = updateDidAssignment(id, assignment) ?? did;
  }
  return NextResponse.json({ did });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  if (!isExec(username)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  const did = getDid(id);
  if (!did) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (did.telnyxId) {
    try {
      await releaseNumber(did.telnyxId);
    } catch (err) {
      if (err instanceof TelnyxNotConfigured) {
        // No Telnyx — fall through and release locally anyway.
      } else {
        return NextResponse.json({ error: (err as Error).message }, { status: 502 });
      }
    }
  }
  const released = releaseDid(id);
  return NextResponse.json({ did: released });
}
