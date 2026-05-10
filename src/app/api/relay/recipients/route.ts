/**
 * /api/relay/recipients
 *   GET  — list all recipients (with channels).
 *   POST — add a channel to an existing recipient. Body: { actorEmail, targetEmail, channel }.
 *
 * Channels are added by an admin acting on behalf of (or as) another user.
 * The policy module enforces that admins cannot mutate the superAdmin record.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  listRecipients,
  getRecipientByEmail,
  addChannel,
  PolicyError,
} from "@tgv/module-connect";
import { connectDb, ensureConnectBootstrapped } from "@/lib/connect-db";
import type { RecipientChannel } from "@tgv/module-connect";

export const runtime = "nodejs";

export async function GET() {
  await ensureConnectBootstrapped();
  const recipients = await listRecipients(connectDb);
  return NextResponse.json({ recipients });
}

export async function POST(req: NextRequest) {
  await ensureConnectBootstrapped();
  const body = (await req.json()) as {
    actorEmail?: string;
    targetEmail?: string;
    channel?: RecipientChannel;
  };
  if (!body.actorEmail || !body.targetEmail || !body.channel) {
    return NextResponse.json(
      { error: "Missing actorEmail, targetEmail, or channel" },
      { status: 400 }
    );
  }
  const actor = await getRecipientByEmail(connectDb, body.actorEmail);
  if (!actor) {
    return NextResponse.json({ error: "Actor not found" }, { status: 403 });
  }
  const target = await getRecipientByEmail(connectDb, body.targetEmail);
  if (!target) {
    return NextResponse.json({ error: "Target recipient not found" }, { status: 404 });
  }
  try {
    const updated = await addChannel(connectDb, {
      actor,
      targetRecipientId: target.id,
      channel: body.channel,
    });
    return NextResponse.json({ recipient: updated });
  } catch (err) {
    if (err instanceof PolicyError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
