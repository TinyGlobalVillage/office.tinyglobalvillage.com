import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "tgv-2fa";
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sign(username: string, expires: number): string {
  const payload = `${username}:${expires}`;
  const sig = createHmac("sha256", process.env.AUTH_SECRET!)
    .update(payload)
    .digest("base64url");
  return `${payload}:${sig}`;
}

export function create2faCookie(username: string): { name: string; value: string; options: object } {
  const expires = Date.now() + TTL_MS;
  return {
    name: COOKIE_NAME,
    value: sign(username, expires),
    options: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      maxAge: TTL_MS / 1000,
      path: "/",
    },
  };
}

export function verify2faCookie(req: NextRequest, username: string): boolean {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const parts = raw.split(":");
  if (parts.length !== 3) return false;
  const [user, expiresStr, sig] = parts;
  if (user !== username) return false;
  const expires = parseInt(expiresStr, 10);
  if (isNaN(expires) || Date.now() > expires) return false;
  const expected = sign(username, expires);
  try {
    return timingSafeEqual(Buffer.from(raw), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function set2faCookie(res: NextResponse, username: string): void {
  const cookie = create2faCookie(username);
  res.cookies.set(cookie.name, cookie.value, cookie.options);
}

export function clear2faCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
}
