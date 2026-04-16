import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import nodemailer from "nodemailer";
import { readUsers } from "@/lib/users";

const TTL_MS = 15 * 60 * 1000; // 15 minutes

function createMagicToken(username: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = Buffer.from(JSON.stringify({ username, exp })).toString("base64url");
  const sig = createHmac("sha256", process.env.AUTH_SECRET!)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT ?? "465", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
}

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (!email?.trim()) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  // Find user by email
  const store = readUsers();
  const entry = Object.entries(store).find(
    ([, u]) => u.email?.toLowerCase() === email.trim().toLowerCase()
  );

  if (!entry) {
    // Don't leak whether the email exists — return success anyway
    return NextResponse.json({ ok: true });
  }

  const [username, user] = entry;
  const token = createMagicToken(username);
  const link = `${process.env.AUTH_URL}/api/auth/magic-link/verify?token=${token}`;

  try {
    const transport = getTransport();
    await transport.sendMail({
      from: `"TGV Office" <${process.env.SMTP_FROM}>`,
      to: user.email,
      subject: "TGV Office — Sign-in link",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#ededed;border-radius:12px">
          <p style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#888;margin:0 0 8px">Tiny Global Village LLC</p>
          <h1 style="color:#ff4ecb;font-size:28px;font-weight:700;letter-spacing:0.2em;margin:0 0 24px">TGV Office</h1>
          <p style="color:#aaa;font-size:14px;margin:0 0 24px">Click the button below to sign in. This link expires in 15 minutes.</p>
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#ff4ecb,#7b2ff7);color:#fff;font-weight:700;font-size:14px;padding:14px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.05em">Sign in to TGV Office</a>
          <p style="color:#555;font-size:11px;margin:24px 0 0">If you didn't request this, ignore this email. This link can only be used once.</p>
          <hr style="border:none;border-top:1px solid #222;margin:24px 0" />
          <p style="color:#444;font-size:11px;margin:0">Or copy this link:<br/><span style="color:#ff4ecb;word-break:break-all;font-size:10px">${link}</span></p>
        </div>
      `,
      text: `Sign in to TGV Office:\n\n${link}\n\nThis link expires in 15 minutes.`,
    });
  } catch (e) {
    console.error("[magic-link] email send failed:", e);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
