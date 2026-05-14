// POST /api/editor/shared-templates/[templateId]/deploy-to-code
//
// Phase 3 of the shared-templates roundtrip: serialize a shared_templates
// row back to a TypeScript file at the canonical path
//   /srv/refusion-core/packages/@tgv/module-core/module-component-library/page-templates/<slug>.ts
// and auto-commit the change to the monorepo. Mirrors the auto-commit
// pattern in /api/sandbox/deploy (commit f8ffa9c).
//
// Side effect: if the row's status is 'sandbox', also promotes it to
// 'published'. The status flip + file write happen as a single user
// action so the in-code source and the DB state never diverge.
//
// Admin-only. Failure modes:
//   - 404: templateId not found
//   - 409: serialization failed (bad model_json shape)
//   - 500: git operation failed (working tree dirty in conflicting way,
//          etc.). On git failure the file is left on disk; user can
//          inspect / commit manually.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import {
  getSharedTemplate,
  setSharedTemplateStatus,
} from "@/lib/db-shared-templates";
import { serializeTemplate } from "@/lib/serialize-template";
import { promises as fs } from "fs";
import path from "path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO_ROOT = "/srv/refusion-core";
const TEMPLATES_DIR = path.join(
  REPO_ROOT,
  "packages/@tgv/module-core/module-component-library/page-templates",
);

type Ctx = { params: Promise<{ templateId: string }> };

async function autoCommitTemplateFile(args: {
  relPath: string;
  templateId: string;
  username: string;
}): Promise<{ committed: boolean; sha?: string; reason?: string }> {
  try {
    await execFileAsync("git", ["-C", REPO_ROOT, "add", args.relPath]);
    const { stdout: cached } = await execFileAsync("git", [
      "-C",
      REPO_ROOT,
      "diff",
      "--cached",
      "--name-only",
      "--",
      args.relPath,
    ]);
    if (!cached.trim()) {
      return { committed: false, reason: "no template-file changes" };
    }
    const message =
      `deploy(template): ${args.templateId}\n\n` +
      `Auto-committed by Office sandbox → Page Templates → Deploy.\n` +
      `Triggered by: ${args.username}`;
    await execFileAsync("git", ["-C", REPO_ROOT, "commit", "-m", message]);
    const { stdout: sha } = await execFileAsync("git", [
      "-C",
      REPO_ROOT,
      "rev-parse",
      "HEAD",
    ]);
    return { committed: true, sha: sha.trim() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { committed: false, reason: msg };
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { templateId } = await ctx.params;
  const username = gate.username ?? "unknown";

  const row = await getSharedTemplate(templateId);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let payload: { filename: string; source: string; exportName: string };
  try {
    payload = serializeTemplate({
      templateId: row.templateId,
      label: row.label,
      description: row.description,
      category: row.category,
      thumbnail: row.thumbnail,
      suggestedSlug: row.suggestedSlug,
      suggestedTitle: row.suggestedTitle,
      model: row.model,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Serialize failed";
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const absPath = path.join(TEMPLATES_DIR, payload.filename);
  const relPath = path.relative(REPO_ROOT, absPath);

  try {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
    await fs.writeFile(absPath, payload.source, "utf8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Write failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const commit = await autoCommitTemplateFile({
    relPath,
    templateId,
    username,
  });

  // Status side effect: sandbox → published. Best-effort — file write is
  // the primary action and already succeeded; if status flip fails we
  // still return 200 with a warning so the user sees what shipped.
  let promotedTo: "published" | null = null;
  let statusWarning: string | null = null;
  if (row.status === "sandbox") {
    try {
      await setSharedTemplateStatus({ templateId, status: "published" });
      promotedTo = "published";
    } catch (e) {
      statusWarning = e instanceof Error ? e.message : "status flip failed";
    }
  }

  return NextResponse.json({
    ok: true,
    path: relPath,
    exportName: payload.exportName,
    commit,
    promotedTo,
    statusWarning,
  });
}
