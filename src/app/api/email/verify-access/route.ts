import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getAccount, type AccountKey } from "@/lib/fastmail";

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { account, pin } = await req.json().catch(() => ({}));
  if (!account || !pin) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const acc = getAccount(account as AccountKey);
  if (!acc.personal) return NextResponse.json({ error: "Not a personal account" }, { status: 400 });

  if (token.username !== acc.ownerUsername)
    return NextResponse.json({ error: "This inbox belongs to someone else." }, { status: 403 });

  const envKey = acc.key === "gio" ? "GIO_EMAIL_PIN" : "MARMAR_EMAIL_PIN";
  const correctPin = process.env[envKey];
  if (!correctPin)
    return NextResponse.json({ error: "PIN not configured. Ask admin to set it." }, { status: 503 });
  if (pin !== correctPin)
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });

  return NextResponse.json({ ok: true });
}
