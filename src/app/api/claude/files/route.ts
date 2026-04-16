import { type NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const VOCAB_DIR = path.join(CLAUDE_DIR, "vocabulary");

const ROOT_FILES = ["CLAUDE.md", "VOCABULARY.md", "VOCABULARY-SUMMARIES.md"] as const;
type RootFile = (typeof ROOT_FILES)[number];

type FileRef =
  | { kind: "root"; name: RootFile; path: string; deletable: false }
  | { kind: "vocab"; name: string; path: string; deletable: true };

function resolveFile(rel: string): FileRef | null {
  if (rel.includes("..") || rel.includes("\0")) return null;

  if ((ROOT_FILES as readonly string[]).includes(rel)) {
    return { kind: "root", name: rel as RootFile, path: path.join(CLAUDE_DIR, rel), deletable: false };
  }

  const vocabMatch = rel.match(/^vocabulary\/([A-Za-z0-9_-]+)\.md$/);
  if (vocabMatch) {
    return { kind: "vocab", name: rel, path: path.join(VOCAB_DIR, `${vocabMatch[1]}.md`), deletable: true };
  }

  return null;
}

async function safeStat(p: string) {
  try {
    const s = await fs.stat(p);
    return { exists: true, bytes: s.size, mtime: s.mtimeMs };
  } catch {
    return { exists: false, bytes: 0, mtime: 0 };
  }
}

// GET /api/claude/files                   → list all
// GET /api/claude/files?file=CLAUDE.md   → read single
export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fileParam = req.nextUrl.searchParams.get("file");

  if (fileParam) {
    const ref = resolveFile(fileParam);
    if (!ref) return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    try {
      const content = await fs.readFile(ref.path, "utf8");
      const stat = await safeStat(ref.path);
      return NextResponse.json({ name: ref.name, kind: ref.kind, deletable: ref.deletable, content, ...stat });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      return NextResponse.json({ error: `Failed to read: ${message}` }, { status: 500 });
    }
  }

  // List root + vocab
  const items: Array<FileRef & { exists: boolean; bytes: number; mtime: number }> = [];

  for (const name of ROOT_FILES) {
    const p = path.join(CLAUDE_DIR, name);
    const stat = await safeStat(p);
    items.push({ kind: "root", name, path: p, deletable: false, ...stat });
  }

  try {
    const entries = await fs.readdir(VOCAB_DIR);
    for (const f of entries.sort()) {
      if (!f.endsWith(".md")) continue;
      const rel = `vocabulary/${f}`;
      const stat = await safeStat(path.join(VOCAB_DIR, f));
      items.push({ kind: "vocab", name: rel, path: path.join(VOCAB_DIR, f), deletable: true, ...stat });
    }
  } catch {
    // vocab dir may not exist yet
  }

  return NextResponse.json({ items });
}

// PUT /api/claude/files  { file: "vocabulary/Foo.md", content: "..." }
export async function PUT(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const file = typeof body?.file === "string" ? body.file : null;
  const content = typeof body?.content === "string" ? body.content : null;
  if (!file || content === null) return NextResponse.json({ error: "file and content required" }, { status: 400 });

  const ref = resolveFile(file);
  if (!ref) return NextResponse.json({ error: "Invalid file path" }, { status: 400 });

  try {
    if (ref.kind === "vocab") {
      await fs.mkdir(VOCAB_DIR, { recursive: true });
    }
    await fs.writeFile(ref.path, content, "utf8");
    return NextResponse.json({ ok: true, name: ref.name, bytes: Buffer.byteLength(content, "utf8") });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: `Failed to write: ${message}` }, { status: 500 });
  }
}

// DELETE /api/claude/files?file=vocabulary/Foo.md
export async function DELETE(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fileParam = req.nextUrl.searchParams.get("file");
  if (!fileParam) return NextResponse.json({ error: "file required" }, { status: 400 });

  const ref = resolveFile(fileParam);
  if (!ref) return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  if (!ref.deletable) return NextResponse.json({ error: "This file cannot be deleted via the UI" }, { status: 403 });

  try {
    await fs.unlink(ref.path);
    return NextResponse.json({ ok: true, name: ref.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: `Failed to delete: ${message}` }, { status: 500 });
  }
}
