import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePersonalAccess } from "@/lib/api-auth";
import { getAccount, type AccountKey } from "@/lib/fastmail";
import fs from "fs";
import path from "path";

const SCHEDULE_FILE = path.join(process.cwd(), "data", "scheduled-emails.json");

type ScheduledEmail = {
  id: string;
  account: AccountKey;
  sendAt: string; // ISO
  to: { name?: string; email: string }[];
  cc: { name?: string; email: string }[];
  bcc: { name?: string; email: string }[];
  subject: string;
  textBody: string;
  inReplyTo?: string;
  references?: string[];
  createdAt: string;
};

function readSchedule(): ScheduledEmail[] {
  try {
    if (!fs.existsSync(SCHEDULE_FILE)) return [];
    return JSON.parse(fs.readFileSync(SCHEDULE_FILE, "utf8"));
  } catch { return []; }
}

function writeSchedule(jobs: ScheduledEmail[]) {
  fs.mkdirSync(path.dirname(SCHEDULE_FILE), { recursive: true });
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(jobs, null, 2));
}

// POST — schedule a new email
export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.account || !body?.sendAt || !body?.to || !body?.subject)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const acc = getAccount(body.account as AccountKey);
  if (!acc.token) return NextResponse.json({ error: "Account not configured" }, { status: 503 });

  if (acc.personal) {
    const check = requirePersonalAccess(req, acc.ownerUsername!, token.username);
    if (check !== "ok") return NextResponse.json({ error: check }, { status: 403 });
  }

  const sendAt = new Date(body.sendAt);
  if (isNaN(sendAt.getTime()) || sendAt <= new Date())
    return NextResponse.json({ error: "sendAt must be a future date" }, { status: 400 });

  const job: ScheduledEmail = {
    id: `sch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    account: body.account,
    sendAt: sendAt.toISOString(),
    to: body.to,
    cc: body.cc ?? [],
    bcc: body.bcc ?? [],
    subject: body.subject,
    textBody: body.textBody ?? "",
    inReplyTo: body.inReplyTo,
    references: body.references,
    createdAt: new Date().toISOString(),
  };

  const jobs = readSchedule();
  jobs.push(job);
  writeSchedule(jobs);

  return NextResponse.json({ ok: true, id: job.id, sendAt: job.sendAt });
}

// GET — list pending scheduled emails (for the UI to display)
export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = readSchedule().filter((j) => new Date(j.sendAt) > new Date());
  return NextResponse.json({ jobs });
}

// DELETE — cancel a scheduled email by id
export async function DELETE(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const jobs = readSchedule();
  const filtered = jobs.filter((j) => j.id !== id);
  writeSchedule(filtered);
  return NextResponse.json({ ok: true });
}
