// POST /api/editor/shared-templates/[templateId]/deploy-to-code/revert
//
// Body: { sha: string }
//
// Reverts a prior Deploy-to-code commit by creating a new revert commit
// (`git revert <sha> --no-edit`). Safe across additional commits made
// after the deploy — `git revert` operates on history, not the working
// tree, so unrelated subsequent commits stay intact.
//
// Sanity checks before reverting:
//   - sha matches /^[a-f0-9]{7,40}$/ (no shell injection via the param)
//   - rev-parse confirms the sha exists in the repo
//   - the commit's diff touches the expected page-templates file for
//     this templateId (prevents reverting the wrong commit by accident)
//
// Admin-only. Returns the new revert commit's SHA on success.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import path from "path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO_ROOT = "/srv/refusion-core";
const TEMPLATES_REL = "packages/@tgv/module-core/module-component-library/page-templates";

type Ctx = { params: Promise<{ templateId: string }> };

function expectedFilename(templateId: string): string {
  const stripped = templateId.startsWith("default-")
    ? templateId.slice("default-".length)
    : templateId;
  return stripped.replace(/[^a-z0-9-]/gi, "-").toLowerCase() + ".ts";
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { templateId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { sha?: unknown } | null;
  const sha = typeof body?.sha === "string" ? body.sha.trim() : "";
  if (!/^[a-f0-9]{7,40}$/.test(sha)) {
    return NextResponse.json({ error: "Invalid sha" }, { status: 400 });
  }

  // Sanity: sha exists.
  try {
    await execFileAsync("git", ["-C", REPO_ROOT, "rev-parse", "--verify", `${sha}^{commit}`]);
  } catch {
    return NextResponse.json({ error: "Commit not found" }, { status: 404 });
  }

  // Sanity: that commit actually touched this template's file.
  const expectedRel = path.join(TEMPLATES_REL, expectedFilename(templateId));
  try {
    const { stdout } = await execFileAsync("git", [
      "-C", REPO_ROOT, "show", "--name-only", "--format=", sha,
    ]);
    const files = stdout.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!files.includes(expectedRel)) {
      return NextResponse.json(
        { error: `Commit ${sha} does not touch ${expectedRel}` },
        { status: 409 },
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "git show failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Execute revert.
  try {
    await execFileAsync(
      "git",
      ["-C", REPO_ROOT, "revert", sha, "--no-edit"],
      { env: { ...process.env, GIT_EDITOR: "true" } },
    );
    const { stdout: head } = await execFileAsync("git", [
      "-C", REPO_ROOT, "rev-parse", "HEAD",
    ]);
    return NextResponse.json({ ok: true, revertSha: head.trim() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "revert failed";
    // On revert conflict, abort to leave the tree clean.
    try {
      await execFileAsync("git", ["-C", REPO_ROOT, "revert", "--abort"]);
    } catch {
      // best-effort
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
