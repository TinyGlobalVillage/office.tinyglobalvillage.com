/**
 * /api/relay/tasks
 *   GET  — list active tasks.
 *   POST — create a new task. Body: { slug, title, brief, createdByEmail }.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createTask,
  listActiveTasks,
  listAllTasks,
  getRecipientByEmail,
} from "@tgv/module-connect";
import { connectDb, ensureConnectBootstrapped } from "@/lib/connect-db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await ensureConnectBootstrapped();
  const all = req.nextUrl.searchParams.get("scope") === "all";
  const tasks = all ? await listAllTasks(connectDb) : await listActiveTasks(connectDb);
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  await ensureConnectBootstrapped();
  const body = await req.json();
  const { slug, title, brief, createdByEmail } = body as {
    slug?: string;
    title?: string;
    brief?: string;
    createdByEmail?: string;
  };
  if (!slug || !title || !brief || !createdByEmail) {
    return NextResponse.json(
      { error: "Missing required fields: slug, title, brief, createdByEmail" },
      { status: 400 }
    );
  }
  const creator = await getRecipientByEmail(connectDb, createdByEmail);
  if (!creator) {
    return NextResponse.json(
      { error: `No recipient found for email "${createdByEmail}". Add them first.` },
      { status: 404 }
    );
  }
  try {
    const task = await createTask(connectDb, {
      slug,
      title,
      brief,
      createdBy: creator.id,
    });
    return NextResponse.json({ task });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
