import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { encode } from "next-auth/jwt";
import { getUser } from "@/lib/users";

const COOKIE_NAME = "authjs.session-token";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return redirectError(req, "Missing token");

  const parts = token.split(".");
  if (parts.length !== 2) return redirectError(req, "Malformed token");

  const [payload, sig] = parts;

  // Verify signature
  const expectedSig = createHmac("sha256", process.env.AUTH_SECRET!)
    .update(payload)
    .digest("base64url");

  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return redirectError(req, "Invalid token");
    }
  } catch {
    return redirectError(req, "Invalid token");
  }

  // Decode payload
  let data: { username: string; exp: number };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return redirectError(req, "Malformed payload");
  }

  if (!data.username || !data.exp || Date.now() > data.exp) {
    return redirectError(req, "Expired or invalid link");
  }

  const user = getUser(data.username);
  if (!user) return redirectError(req, "User not found");

  // Issue NextAuth-compatible session JWT
  const sessionToken = await encode({
    token: {
      sub: data.username,
      name: user.displayName,
      username: data.username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    },
    secret: process.env.AUTH_SECRET!,
    salt: COOKIE_NAME,
  });

  const base = process.env.AUTH_URL ?? `https://${req.headers.get("host")}`;
  const res = NextResponse.redirect(new URL("/verify-2fa", base));
  res.cookies.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  return res;
}

function redirectError(req: NextRequest, reason: string) {
  const base = process.env.AUTH_URL ?? `https://${req.headers.get("host")}`;
  const url = new URL("/login", base);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}
