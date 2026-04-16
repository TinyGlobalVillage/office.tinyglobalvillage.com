import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { verifyTotp } from "@/lib/totp";
import { getUser } from "@/lib/users";
import { set2faCookie } from "@/lib/twofa-cookie";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const username = token?.username as string | undefined;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json().catch(() => ({}));
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const user = getUser(username);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!user.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: "2FA not configured" }, { status: 400 });
  }

  if (!verifyTotp(user.totpSecret, code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  set2faCookie(res, username);
  return res;
}
