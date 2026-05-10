/**
 * /api/transcripts/[id]
 *
 * PATCH  body: { name?, notes?, tags? } — soft edits only. Re-transcribing
 *        is a fresh POST (audio + engine cost is non-trivial; we don't
 *        invisibly re-run on rename).
 * DELETE removes the audio file + soft-deletes the metadata record.
 *
 * Both routes require the caller to be the record's owner. Org records
 * (createdBy === "org:tgv-office") are editable by any authed Office user
 * — the personal/org distinction is the only ACL we have.
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  deleteTranscript,
  getTranscript,
  updateTranscript,
} from "@/lib/transcripts-store";
import type { UpdateTranscriptInput } from "@tgv/module-connect/transcriber/types";

export const runtime = "nodejs";

function callerOwnerForRecord(
  recordOwner: string,
  callerUsername: string,
): string | null {
  // Org-owned records: anyone authed in Office can edit.
  if (recordOwner.startsWith("org:")) return recordOwner;
  // Personal records: only the original creator.
  if (recordOwner === callerUsername) return recordOwner;
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = getTranscript(id);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const owner = callerOwnerForRecord(record.createdBy, token.username);
  if (!owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ transcript: record });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = getTranscript(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const owner = callerOwnerForRecord(existing.createdBy, token.username);
  if (!owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const patch = (await req.json().catch(() => null)) as UpdateTranscriptInput | null;
  if (!patch) return NextResponse.json({ error: "Missing body" }, { status: 400 });

  try {
    const updated = updateTranscript(id, patch, owner);
    return NextResponse.json({ transcript: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = getTranscript(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const owner = callerOwnerForRecord(existing.createdBy, token.username);
  if (!owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    deleteTranscript(id, owner);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 400 },
    );
  }
}
