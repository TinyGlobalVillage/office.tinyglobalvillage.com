import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import QRCode from "qrcode";
import { generateTotpSecret, generateTotpUri, verifyTotp } from "@/lib/totp";
import { getUser, updateUser } from "@/lib/users";
import { set2faCookie } from "@/lib/twofa-cookie";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  const username = token?.username;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = getUser(username);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const secret = generateTotpSecret();
  const uri = generateTotpUri(username, secret);
  const qr = await QRCode.toDataURL(uri);

  return NextResponse.json({ secret, qr });
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  const username = token?.username;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { secret, code } = await req.json().catch(() => ({}));
  if (!secret || !code) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  if (!verifyTotp(secret, code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  updateUser(username, { totpSecret: secret, totpEnabled: true });
  // User just proved possession of the authenticator — issue the 2FA cookie
  // immediately so they don't have to re-enter a code on the next request.
  const res = NextResponse.json({ ok: true });
  set2faCookie(res, username);
  return res;
}
