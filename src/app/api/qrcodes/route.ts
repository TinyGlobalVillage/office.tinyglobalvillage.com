/**
 * /api/qrcodes
 *
 * GET  ?context=user&username=<u> | ?context=org&orgId=tgv-office
 *      Lists saved QR-code configurations in the requested context.
 *      Personal context: only the logged-in user can read their own bucket.
 *      Org context:      any authed Office user can read the shared bucket.
 *
 * POST body:
 *   { name, text, errorCorrection?, transparentBg?, linkedShortCode?, tags?, context }
 *      Personal context: must equal the caller's own username.
 *      Org context:      any authed Office user can create in the shared bucket.
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  createQRCode,
  listQRCodes,
  type CreateQRInput,
  type QRContext,
} from "@/lib/qrcodes-store";

function parseContextFromQuery(req: NextRequest): QRContext | { error: string } {
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

function gateContextRead(ctx: QRContext, callerUsername: string): string | null {
  if (ctx.kind === "user" && ctx.username !== callerUsername) {
    return "You can only list your own personal QR codes";
  }
  return null;
}

function gateContextWrite(ctx: QRContext, callerUsername: string): string | null {
  if (ctx.kind === "user" && ctx.username !== callerUsername) {
    return "You can only create QR codes under your own personal context";
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
    const qrcodes = listQRCodes(ctx);
    return NextResponse.json({ qrcodes });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "List failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Partial<CreateQRInput> | null;
  if (!body || typeof body.name !== "string" || typeof body.text !== "string" || !body.context) {
    return NextResponse.json({ error: "Missing name, text, or context" }, { status: 400 });
  }

  const gate = gateContextWrite(body.context, token.username);
  if (gate) return NextResponse.json({ error: gate }, { status: 403 });

  try {
    const qrcode = createQRCode({
      name: body.name,
      text: body.text,
      errorCorrection: body.errorCorrection,
      transparentBg: body.transparentBg,
      linkedShortCode: body.linkedShortCode ?? null,
      tags: body.tags ?? [],
      context: body.context,
    });
    return NextResponse.json({ qrcode });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 400 });
  }
}
