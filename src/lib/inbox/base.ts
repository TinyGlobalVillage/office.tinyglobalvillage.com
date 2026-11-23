// Office's public origin, for building OAuth return addresses. AUTH_URL when set (the
// request's own origin is the internal localhost behind nginx), else the Host header.
import type { NextRequest } from "next/server";

export function officeBase(req: NextRequest): string {
  const fixed = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").trim();
  if (fixed) return fixed.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "office.tinyglobalvillage.com";
  return `https://${host}`;
}
