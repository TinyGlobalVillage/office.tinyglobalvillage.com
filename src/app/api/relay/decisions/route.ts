/**
 * /api/relay/decisions
 *   POST — create a new decision and dispatch it across configured providers.
 *          Body: { taskSlug, question, options?, context?, providers? }
 *
 * Use this from the Stop hook, the relay-ask CLI, or the Office UI's
 * "Send test decision" button. The autonomous Claude resume runner uses
 * `createDecision` directly (without dispatch) since it has DB access.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createDecision,
  dispatchDecision,
  getTask,
  listRecipients,
} from "@tgv/module-connect";
import { connectDb, ensureConnectBootstrapped } from "@/lib/connect-db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await ensureConnectBootstrapped();
  const body = (await req.json()) as {
    taskSlug?: string;
    question?: string;
    options?: { id: string; label: string }[];
    context?: string;
    providers?: ("telegram" | "whatsapp")[];
  };

  if (!body.taskSlug || !body.question) {
    return NextResponse.json({ error: "Missing taskSlug or question" }, { status: 400 });
  }

  const task = await getTask(connectDb, body.taskSlug);
  if (!task) {
    return NextResponse.json({ error: `Task not found: ${body.taskSlug}` }, { status: 404 });
  }

  const decision = await createDecision(connectDb, {
    taskId: task.id,
    question: body.question,
    options: body.options,
    context: body.context,
  });

  const recipients = await listRecipients(connectDb);
  const result = await dispatchDecision(connectDb, task, decision, recipients, {
    providers: body.providers,
  });

  return NextResponse.json({ decision, dispatch: result });
}
