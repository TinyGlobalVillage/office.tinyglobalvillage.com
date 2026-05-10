/**
 * /api/shortener/links
 *
 * GET  ?context=user&username=<u> | ?context=org&orgId=tgv-office
 *      Lists short links in the requested context.
 *      Personal context: only the logged-in user can read their own bucket.
 *      Org context: any authed Office user can read the shared bucket.
 *
 * POST body:
 *   { destination, code?, expiresAt?, tags?, context: { kind: "user"|"org", ... } }
 *      Personal context: must equal the caller's own username.
 *      Org context: any authed Office user can create in the shared bucket.
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  createLink,
  listLinks,
  type CreateInput,
  type ShortLinkContext,
} from "@/lib/shortener-store";

function parseContextFromQuery(req: NextRequest): ShortLinkContext | { error: string } {
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

function gateContextRead(ctx: ShortLinkContext, callerUsername: string): string | null {
  if (ctx.kind === "user" && ctx.username !== callerUsername) {
    return "You can only list your own personal links";
  }
  return null;
}

function gateContextWrite(ctx: ShortLinkContext, callerUsername: string): string | null {
  if (ctx.kind === "user" && ctx.username !== callerUsername) {
    return "You can only create links under your own personal context";
  }
  return null;
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = parseContextFromQuery(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 400 });

  const gate = gateContextRead(ctx, token.username);
  if (gate) return NextResponse.json({ error: gate }, { status: 403 });

  try {
    const links = listLinks(ctx);
    return NextResponse.json({ links });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "List failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Partial<CreateInput> | null;
  if (!body || typeof body.destination !== "string" || !body.context) {
    return NextResponse.json({ error: "Missing destination or context" }, { status: 400 });
  }

  const gate = gateContextWrite(body.context, token.username);
  if (gate) return NextResponse.json({ error: gate }, { status: 403 });

  try {
    const link = createLink({
      destination: body.destination,
      code: body.code,
      expiresAt: body.expiresAt ?? null,
      tags: body.tags ?? [],
      context: body.context,
    });
    return NextResponse.json({ link });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
