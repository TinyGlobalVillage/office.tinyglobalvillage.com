/**
 * /api/transcripts
 *
 * GET  ?context=user&username=<u> | ?context=org&orgId=tgv-office
 *      Lists saved transcripts in the requested context.
 *
 * POST is GONE. The synchronous "transcribe-and-block" endpoint was
 * replaced by /api/transcripts/jobs (server-side persistent jobs +
 * orphan-Promise worker). Stale browser bundles that still POST here
 * get HTTP 410 with the migration pointer — fail-fast instead of
 * silently hanging the modal for 10+ minutes.
 *
 * Personal context: caller may only read their own username.
 * Org context:      any authed Office user may read.
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  listTranscripts,
  ownerKey,
  type TranscriptContext,
} from "@/lib/transcripts-store";

export const runtime = "nodejs";

function parseContextFromQuery(req: NextRequest): TranscriptContext | { error: string } {
  const url = new URL(req.url);
  const kind = url.searchParams.get("context");
  if (kind === "user") {
    const username = url.searchParams.get("username") || "";
    if (!username) return { error: "missing username" };
    return { kind: "user", username };
  }
  if (kind === "org") {
    const orgId = url.searchParams.get("orgId") || "";
    if (orgId !== "tgv-office") return { error: "unknown orgId" };
    return { kind: "org", orgId };
  }
  return { error: "context must be 'user' or 'org'" };
}

function gateRead(ctx: TranscriptContext, callerUsername: string): string | null {
  if (ctx.kind === "user" && ctx.username !== callerUsername) {
    return "You can only list your own personal transcripts";
  }
  return null;
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = parseContextFromQuery(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 400 });

  const gate = gateRead(ctx, token.username);
  if (gate) return NextResponse.json({ error: gate }, { status: 403 });

  try {
    const transcripts = listTranscripts(ctx);
    return NextResponse.json({ transcripts });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "List failed" },
      { status: 500 },
    );
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error: "POST /api/transcripts is gone — use POST /api/transcripts/jobs (async, server-persistent). Hard-refresh your browser to pick up the new client bundle.",
      code: "endpoint_moved",
      replacement: "/api/transcripts/jobs",
    },
    { status: 410 },
  );
}

// Re-export the helper used by the [id] routes so they share the same context parser.
export { ownerKey };
