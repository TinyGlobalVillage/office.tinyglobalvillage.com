// /api/files/[...path] — authed reads from the PRIVATE file store (bug
// cdn-media-unauthenticated, fix B, 2026-07-30). The nginx /media/ alias serves
// /srv/refusion-core/cdn/ to ANYONE — fine for genuinely public assets, wrong
// for chat/DM attachments (deterministic paths). Private files now live under
// /srv/refusion-core/cdn-private/ which nginx does NOT alias; every read comes
// through here: session auth + per-file authorization + traversal guard
// (esign/pdf/[sigId] precedent).
//
// Authorization model:
//   chat/dm_<a>_<b>/…  → only the two participants (or an office admin)
//   chat/…             → any authed staff (the office group chat)
//   anything else      → admin-only until a policy is written for it
import { type NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAuth } from "@/lib/api-auth";
import { getOfficeRole } from "@/lib/member-auth/bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_ROOT = "/srv/refusion-core/cdn-private";

const MIME: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

function allowed(rel: string, username: string): boolean {
  const segments = rel.split("/");
  if (segments[0] !== "chat") {
    // No policy written for other private trees yet — admin-only.
    return getOfficeRole(username) === "admin";
  }
  const chatId = segments[1] ?? "";
  if (chatId.startsWith("dm_")) {
    const participants = chatId.slice(3).split("_");
    if (participants.includes(username)) return true;
    return getOfficeRole(username) === "admin";
  }
  return true; // group chat — any authed staff
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const token = await requireAuth(req);
  if (!token?.username && !token?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const username = token.username ?? token.sub ?? "";

  const { path: parts } = await ctx.params;
  const rel = (parts ?? []).join("/");
  const resolved = path.resolve(PRIVATE_ROOT, rel);
  if (resolved !== PRIVATE_ROOT && !resolved.startsWith(PRIVATE_ROOT + path.sep)) {
    return NextResponse.json({ error: "Refusing path outside the store" }, { status: 403 });
  }

  if (!allowed(rel, username)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let buf: Buffer;
  try {
    buf = await readFile(resolved);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Length": String(buf.length),
      // Private by definition — never let a shared cache hold these.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
