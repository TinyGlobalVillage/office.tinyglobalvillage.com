import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import nodemailer from "nodemailer";
import { getAllUserEmails } from "@/lib/users-config";
import {
  getAllAnnouncements,
  addAnnouncement,
  dismissAnnouncement,
  takeUnseenStackUpdates,
  type ProjectUpdates,
  type StackUpdateItem,
} from "@/lib/announcements-store";

const EMAIL_ACCENT = "#f7b700"; // colour-literal: mail clients cannot read CSS tokens; matches the older announcement emails

const CLASS_ORDER = { security: 0, major: 1, perf: 2, feature: 3 } as const;
const CLASS_WORD = { security: "SECURITY", major: "MAJOR", perf: "PERF", feature: "FEATURE" } as const;
const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const ANNOUNCE_TOKEN = process.env.ANNOUNCE_TOKEN;

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT ?? "465", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  });
}

// GET — list all announcements (member session required)
export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) {
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

  // stack-update: one alert per version, ever. Already-announced versions are dropped here;
  // nothing new → nothing posted, nobody emailed.
  if (body.type === "stack-update") {
    const raw = Array.isArray(body.data?.items) ? (body.data.items as StackUpdateItem[]) : [];
    const fresh = takeUnseenStackUpdates(raw.slice(0, 500))
      .sort((a, b) => (CLASS_ORDER[a.class] ?? 9) - (CLASS_ORDER[b.class] ?? 9) || a.name.localeCompare(b.name));
    if (!fresh.length) return NextResponse.json({ ok: true, skipped: true, new: 0 });
    const sec = fresh.filter((i) => i.class === "security").length;
    body.title = `${fresh.length} stack update${fresh.length === 1 ? "" : "s"}${sec ? ` · ${sec} security` : ""}`;
    body.data = { items: fresh };
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
    let text: string;
    let html: string;

    if (body.type === "dep-update") {
      const projectLines = (body.data.projects as ProjectUpdates[])
        .map(
          (p) =>
            `${p.name}:\n` +
            p.updates
              .map((u) => `  • ${u.package}: ${u.current} → ${u.latest} [${u.type.toUpperCase()}]`)
              .join("\n")
        )
        .join("\n\n");

      text = `${body.title}\n\n${projectLines}\n\nView in TGV Office: ${officeUrl}/dashboard`;
      html = `
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
  <a href="${officeUrl}/dashboard" style="color:${EMAIL_ACCENT};">Open TGV Office →</a>
</p>`;
    } else if (body.type === "stack-update") {
      const items = body.data.items as StackUpdateItem[];
      text = `${body.title}\n\n${items
        .map((u) => `  • [${CLASS_WORD[u.class]}] ${u.name}: ${u.current} → ${u.latest} — ${u.why}`)
        .join("\n")}\n\nNothing is upgraded automatically.\nView in TGV Office: ${officeUrl}/dashboard`;
      html = `
<h2 style="font-family:sans-serif;color:${EMAIL_ACCENT};">${esc(body.title)}</h2>
<ul style="font-family:monospace;font-size:13px;">
${items
  .map(
    (u) =>
      `<li><b>[${CLASS_WORD[u.class]}] ${esc(u.name)}</b>: ${esc(u.current)} → ${esc(u.latest)} — ${esc(u.why)}${u.url ? ` <a href="${esc(u.url)}">notes</a>` : ""}</li>`
  )
  .join("")}
</ul>
<p style="font-family:sans-serif;">Nothing is upgraded automatically.</p>
<p style="font-family:sans-serif;margin-top:20px;">
  <a href="${officeUrl}/dashboard" style="color:${EMAIL_ACCENT};">Open TGV Office →</a>
</p>`;
    } else {
      // Generic fallback used by recordings-storage and any future types.
      // Title carries the message; body just links to the dashboard.
      text = `${body.title}\n\nView in TGV Office: ${officeUrl}/dashboard`;
      html = `
<h2 style="font-family:sans-serif;color:#f7b700;">${body.title}</h2>
<p style="font-family:sans-serif;margin-top:20px;">
  <a href="${officeUrl}/dashboard" style="color:${EMAIL_ACCENT};">Open TGV Office →</a>
</p>`;
    }

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

// PATCH — dismiss an announcement (member session required)
export async function PATCH(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json().catch(() => ({}));
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const username = token.name ?? token.username ?? "unknown";
  const ok = dismissAnnouncement(id, username);

  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
