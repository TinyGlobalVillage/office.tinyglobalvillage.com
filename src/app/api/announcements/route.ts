import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import nodemailer from "nodemailer";
import { getAllUserEmails } from "@/lib/users-config";
import {
  getAllAnnouncements,
  addAnnouncement,
  dismissAnnouncement,
  type ProjectUpdates,
} from "@/lib/announcements-store";

const ANNOUNCE_TOKEN = process.env.ANNOUNCE_TOKEN;

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT ?? "465", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  });
}

// GET — list all announcements (session auth required)
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(getAllAnnouncements());
}

// POST — create announcement (bearer token from cron script)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!ANNOUNCE_TOKEN || authHeader !== `Bearer ${ANNOUNCE_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.type || !body?.title || !body?.data) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const announcement = addAnnouncement({
    title: body.title,
    type: body.type,
    status: "pending",
    data: body.data,
  });

  // Email recipients — joint inbox only
  const to = getAllUserEmails();

  if (to.length > 0) {
    const officeUrl = process.env.AUTH_URL ?? "https://office.tinyglobalvillage.com";
    const projectLines = (body.data.projects as ProjectUpdates[])
      .map(
        (p) =>
          `${p.name}:\n` +
          p.updates
            .map((u) => `  • ${u.package}: ${u.current} → ${u.latest} [${u.type.toUpperCase()}]`)
            .join("\n")
      )
      .join("\n\n");

    const text = `${body.title}\n\n${projectLines}\n\nView in TGV Office: ${officeUrl}/dashboard`;

    const html = `
<h2 style="font-family:sans-serif;color:#f7b700;">${body.title}</h2>
${(body.data.projects as ProjectUpdates[])
  .map(
    (p) => `
  <h3 style="font-family:monospace;color:#00bfff;margin-bottom:4px;">${p.name}</h3>
  <ul style="font-family:monospace;font-size:13px;">
    ${p.updates
      .map(
        (u) =>
          `<li><b>${u.package}</b>: ${u.current} → <span style="color:${u.type === "major" ? "#ff4ecb" : "#4ade80"}">${u.latest}</span> [${u.type.toUpperCase()}]</li>`
      )
      .join("")}
  </ul>`
  )
  .join("")}
<p style="font-family:sans-serif;margin-top:20px;">
  <a href="${officeUrl}/dashboard" style="color:#f7b700;">Open TGV Office →</a>
</p>`;

    await getTransport()
      .sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to,
        subject: body.title,
        text,
        html,
      })
      .catch(console.error);
  }

  return NextResponse.json(announcement, { status: 201 });
}

// PATCH — dismiss an announcement (session auth required)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json().catch(() => ({}));
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const username =
    (session.user as { name?: string })?.name ?? "unknown";
  const ok = dismissAnnouncement(id, username);

  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
