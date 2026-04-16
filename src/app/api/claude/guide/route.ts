import { type NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";

const GUIDE_PATH = "/srv/refusion-core/client/CLAUDE-GUIDE.md";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const content = await fs.readFile(GUIDE_PATH, "utf8");
    const stat = await fs.stat(GUIDE_PATH);
    return NextResponse.json({
      path: GUIDE_PATH,
      content,
      bytes: stat.size,
      mtime: stat.mtimeMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: `Failed to read guide: ${message}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content : null;
  if (content === null) return NextResponse.json({ error: "content required" }, { status: 400 });

  try {
    await fs.writeFile(GUIDE_PATH, content, "utf8");
    return NextResponse.json({ ok: true, bytes: Buffer.byteLength(content, "utf8") });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: `Failed to write guide: ${message}` }, { status: 500 });
  }
}
