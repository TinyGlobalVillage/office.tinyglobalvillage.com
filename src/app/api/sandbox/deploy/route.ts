import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const USERS_FILE = path.join(process.cwd(), "data", "users.json");
const WEBHOOK_URL = process.env.TGV_COMPONENT_WEBHOOK_URL || "http://localhost:4003";
const TRIGGER_TOKEN = process.env.TGV_COMPONENT_WEBHOOK_TRIGGER_TOKEN || "";
const REPO_ROOT = "/srv/refusion-core";

function isAdmin(username: string | undefined): boolean {
  if (!username) return false;
  try {
    const db = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    return db[username]?.role === "admin";
  } catch { return false; }
}

/**
 * Best-effort auto-commit of pending @tgv/* package changes before
 * dispatching the deploy webhook. Scoped to packages/@tgv/ so other
 * dirty paths (clients, webhooks, etc.) are not bundled. Silently
 * skipped if there is nothing to commit; logged but not fatal on
 * failure (deploy still proceeds with the working-tree state).
 */
async function autoCommitPendingPackageChanges(
  components: string[],
  username: string,
): Promise<{ committed: boolean; sha?: string; reason?: string }> {
  try {
    await execFileAsync("git", ["-C", REPO_ROOT, "add", "packages/@tgv/"]);
    const { stdout: cached } = await execFileAsync("git", [
      "-C", REPO_ROOT, "diff", "--cached", "--name-only", "--", "packages/@tgv/",
    ]);
    if (!cached.trim()) {
      return { committed: false, reason: "no @tgv/* changes" };
    }
    const label = components.join(", ") || "@tgv/*";
    const message = `deploy(sandbox): ${label}\n\nAuto-committed by Office sandbox Deploy action.\nTriggered by: ${username}`;
    await execFileAsync("git", ["-C", REPO_ROOT, "commit", "-m", message]);
    const { stdout: sha } = await execFileAsync("git", ["-C", REPO_ROOT, "rev-parse", "HEAD"]);
    return { committed: true, sha: sha.trim() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[sandbox-deploy] auto-commit failed:", msg);
    return { committed: false, reason: msg };
  }
}

/**
 * POST /api/sandbox/deploy
 * Body: { components: ["@tgv/module-ui"], targets?: ["refusionist.com"], preview?: boolean }
 *
 * Admin-only. Proxies to tgv-component-webhook /trigger so the bearer token
 * never leaves the server.
 */
export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(token.username)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  let body: { components?: string[]; targets?: string[]; preview?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  if (!body.components || !body.components.length) {
    return NextResponse.json({ error: "components[] required" }, { status: 400 });
  }
  if (!TRIGGER_TOKEN) {
    return NextResponse.json({ error: "TGV_COMPONENT_WEBHOOK_TRIGGER_TOKEN not configured" }, { status: 500 });
  }

  // Preview mode: not yet implemented downstream; for now we just return the plan
  if (body.preview) {
    return NextResponse.json({ preview: true, plan: { components: body.components, targets: body.targets ?? "all" } });
  }

  // Auto-commit any pending @tgv/* changes so this deploy is reproducible
  // and revertable. Best-effort: failure is logged but does NOT block the
  // webhook trigger — the rebuild still picks up the working-tree state.
  const commit = await autoCommitPendingPackageChanges(body.components, token.username);

  const res = await fetch(`${WEBHOOK_URL}/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TRIGGER_TOKEN}` },
    body: JSON.stringify({ components: body.components, targets: body.targets }),
  }).catch((e) => ({ ok: false, status: 502, json: async () => ({ error: e.message }) } as Response));

  if (!res.ok) {
    return NextResponse.json({ error: "webhook unreachable", status: res.status, commit }, { status: 502 });
  }
  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ accepted: true, commit, ...data });
}
