// Backend mode of the TGV desktop app — server side (plan tgv-desktop-app.md P3).
//
// The app calls /api/backend/* with `Authorization: Bearer tgvapp_…` (resolved by module-auth). Who may do
// what comes from @tgv/module-auth appAccess.computeEntitlements — the same function that decides the app's
// tiles — so the allow-list a superadmin / village owner edits in "App access" is enforced here per call.
// File, search and git work is done by ONE stdlib-Python helper shared with the SSH transport
// (apps/tgv-desktop/remote/tgv_backend.py): it realpaths every path and refuses anything outside the roots.
// Every mutating call lands in the hardening audit log.
import "server-only";
import { spawn } from "child_process";
import path from "path";
import { db } from "@/lib/db-drizzle";
import { officeMemberAuth } from "@/lib/member-auth/config";
import { computeEntitlements, type BackendGrant } from "@tgv/module-auth/auth/member-auth/appAccess";
import { logHardeningAction } from "@/lib/audit-log";

export type BackendCaller = {
  memberId: string;
  email: string;
  name: string | null;
  grant: BackendGrant;
};

export function helperDir(): string {
  return process.env.TGV_BACKEND_HELPERS || path.resolve(process.cwd(), "../../apps/tgv-desktop/remote");
}
const PYTHON = process.env.TGV_PYTHON || "python3";

/** null → 401 (no session); "forbidden" → 403 (signed in, no Backend grant). Cookie or app bearer. */
export async function getBackendCaller(): Promise<BackendCaller | null | "forbidden"> {
  const s = await officeMemberAuth.getActiveSession();
  if (!s || !s.twoFactorVerified) return null;
  if (s.impersonatedBy) return "forbidden";
  const e = await computeEntitlements(db, { id: s.userId, role: s.user.role });
  if (!e.backend || !e.modes.includes("backend")) return "forbidden";
  return { memberId: s.userId, email: s.user.email, name: s.user.name, grant: e.backend };
}

export const MUTATING = new Set(["write", "create", "rename", "delete", "git.commit"]);
export const OPS = new Set(["roots", "list", "stat", "read", "write", "create", "rename", "delete", "files", "search", "git.status", "git.diff", "git.commit"]);

export async function runHelper(
  caller: BackendCaller,
  op: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const req = {
    op,
    args,
    roots: caller.grant.roots,
    writable: caller.grant.writable,
    git: caller.grant.git,
  };
  const out = await new Promise<string>((resolve, reject) => {
    const child = spawn(PYTHON, ["-I", path.join(helperDir(), "tgv_backend.py")], { stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let size = 0;
    const timer = setTimeout(() => child.kill("SIGKILL"), 30_000);
    child.stdout.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 64 * 1024 * 1024) child.kill("SIGKILL");
      else chunks.push(c);
    });
    child.on("error", reject);
    child.on("close", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    child.stdin.end(JSON.stringify(req));
  });
  let res: Record<string, unknown>;
  try {
    res = JSON.parse(out);
  } catch {
    res = { ok: false, error: "helper failed" };
  }
  if (MUTATING.has(op)) {
    logHardeningAction({
      action: `backend.${op}`,
      target: String(args.path ?? args.to ?? args.repo ?? "") || null,
      user: caller.email,
      success: res.ok === true,
      details: { via: "office", from: args.from ?? null, files: op === "git.commit" ? args.files : undefined, error: res.error ?? null },
    });
  }
  return res;
}

export function inRoots(p: string, roots: string[]): boolean {
  const r = path.resolve(p);
  return roots.some((top) => r === top || r.startsWith(top + "/"));
}
