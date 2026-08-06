/**
 * GET    /api/cdn/files?project=office&page=1              → list files (newest first, 50/page)
 * DELETE /api/cdn/files?project=office&name=x&store=cloud  → delete a file
 * PATCH  /api/cdn/files  {project,name,newName,store}      → rename a file (ext kept)
 *
 * TWO STORES. Every file here lives on the RCS disk (served by office's /media/ alias) or in R2 under
 * `public/{project}/` (served by cdn.<domain>), chosen per upload. Nothing records which — the answer is
 * discovered by listing both — so each entry carries a `store` and the write operations take it back as
 * an argument. `store` defaults to "disk", which is where every file was before this existed.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
// Route-level auth (bug cdn-media-unauthenticated step 4): these handlers were
// saved only by middleware — the sibling upload route gates explicitly.
import { requireAuth } from "@/lib/api-auth";
import {
  cloudAvailable,
  fileExists,
  listAll,
  listProjects,
  parseStore,
  removeFile,
  renameFile,
} from "@/lib/cdn/stores";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const project = req.nextUrl.searchParams.get("project");
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));

  // If no project specified, return project list + file counts
  if (!project) {
    return NextResponse.json({ projects: await listProjects(), cloudAvailable: cloudAvailable() });
  }

  const files = await listAll(project);
  const total = files.length;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const slice = files.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return NextResponse.json({
    files: slice,
    total,
    page,
    totalPages,
    project,
    cloudAvailable: cloudAvailable(),
  });
}

export async function DELETE(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const project = req.nextUrl.searchParams.get("project");
  const name = req.nextUrl.searchParams.get("name");
  const store = parseStore(req.nextUrl.searchParams.get("store"));

  if (!project || !name) {
    return NextResponse.json({ error: "Missing project or name" }, { status: 400 });
  }
  // Traversal is refused in one place — stores.ts runs every project/name through path.basename, so a
  // "../" can't reach out of the CDN root or out of the `public/{project}/` prefix.
  if (!(await fileExists(store, project, name))) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    await removeFile(store, project, name);
  } catch (e) {
    return NextResponse.json(
      { error: "delete_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, store });
}

export async function PATCH(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { project?: string; name?: string; newName?: string; store?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const { project, name, newName } = body;
  const store = parseStore(body.store);
  if (!project || !name || !newName) {
    return NextResponse.json({ error: "Missing project, name, or newName" }, { status: 400 });
  }

  const safeOld = path.basename(name);
  const oldExt = path.extname(safeOld); // includes the dot, e.g. ".png"

  // Sanitize the requested new base to a URL-safe slug; always keep the
  // original extension (rename ≠ convert).
  const requested = path.basename(newName.trim());
  const reqExt = path.extname(requested);
  const rawBase = reqExt ? requested.slice(0, -reqExt.length) : requested;
  const base = rawBase
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }
  const safeNew = base + oldExt;

  if (!(await fileExists(store, project, safeOld))) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  if (safeNew !== safeOld && (await fileExists(store, project, safeNew))) {
    return NextResponse.json({ error: "A file with that name already exists" }, { status: 409 });
  }

  try {
    const { url } = await renameFile(store, project, safeOld, safeNew);
    return NextResponse.json({ ok: true, name: safeNew, url, store });
  } catch (e) {
    return NextResponse.json(
      { error: "rename_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
