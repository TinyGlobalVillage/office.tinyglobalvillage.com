import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import QRCode from "qrcode";
import { generateTotpSecret, generateTotpUri, verifyTotp } from "@/lib/totp";
import { getUser, updateUser } from "@/lib/users";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const username = token?.username as string | undefined;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = getUser(username);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const secret = generateTotpSecret();
  const uri = generateTotpUri(username, secret);
  const qr = await QRCode.toDataURL(uri);

  return NextResponse.json({ secret, qr });
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const username = token?.username as string | undefined;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { secret, code } = await req.json().catch(() => ({}));
  if (!secret || !code) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  if (!verifyTotp(secret, code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  updateUser(username, { totpSecret: secret, totpEnabled: true });
  return NextResponse.json({ ok: true });
}
