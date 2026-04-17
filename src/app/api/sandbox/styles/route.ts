import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { requireAuth } from "@/lib/api-auth";

const ROOT = "/srv/refusion-core/client";

function safe(p: string): string | null {
  const resolved = path.resolve(p);
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

function extractStyledBlocks(content: string): string {
  const lines = content.split("\n");
  const blocks: string[] = [];
  let inBlock = false;
  let blockLines: string[] = [];
  let depth = 0;

  for (const line of lines) {
    if (!inBlock && /^(?:export )?const \w+ = styled[\.(]/.test(line)) {
      inBlock = true;
      blockLines = [line];
      depth = (line.match(/`/g) || []).length;
      if (depth % 2 === 0) {
        blocks.push(blockLines.join("\n"));
        inBlock = false;
        blockLines = [];
        depth = 0;
      }
      continue;
    }
    if (inBlock) {
      blockLines.push(line);
      depth += (line.match(/`/g) || []).length;
      if (depth % 2 === 0) {
        blocks.push(blockLines.join("\n"));
        inBlock = false;
        blockLines = [];
        depth = 0;
      }
    }
  }
  return blocks.join("\n\n");
}

function replaceStyledBlocks(original: string, newStyles: string): string {
  const newBlocks = new Map<string, string>();
  const blockRegex = /(?:export )?const (\w+) = styled[\s\S]*?`;/g;
  let m: RegExpExecArray | null;
  while ((m = blockRegex.exec(newStyles)) !== null) {
    newBlocks.set(m[1], m[0]);
  }

  let result = original;
  for (const [name, newBlock] of newBlocks) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `(?:export )?const ${escapedName} = styled[\\s\\S]*?\`;`,
      "g"
    );
    result = result.replace(pattern, newBlock);
  }
  return result;
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawPath = req.nextUrl.searchParams.get("path");
  if (!rawPath) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const fp = safe(rawPath);
  if (!fp) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const content = readFileSync(fp, "utf8");
    const styles = extractStyledBlocks(content);
    return NextResponse.json({ styles, path: rawPath });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

export async function PUT(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (token.username !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.path || typeof body.styles !== "string")
    return NextResponse.json({ error: "Missing path or styles" }, { status: 400 });

  const fp = safe(body.path);
  if (!fp) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const original = readFileSync(fp, "utf8");
    const updated = replaceStyledBlocks(original, body.styles);
    writeFileSync(fp, updated, "utf8");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
