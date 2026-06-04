// Office API for the git-worktree feature-isolation tool.
// Skill: /srv/refusion-core/skills/worktree-isolation/
// Wrapper: /srv/refusion-core/utils/scripts/git/feature
//
// GET  → merged list of both Linux users' worktree registries + cron log tail
// POST → action dispatch (done|prune|start|switch) via the wrapper, run as the
//        worktree's owning Linux user (admin OR marmar via passwordless sudo).

import { spawn } from "child_process";
import { existsSync, readFileSync, statSync } from "fs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";

const WRAPPER = "/srv/refusion-core/utils/scripts/git/feature";
const PRUNE_LOG = "/var/log/claude-feature-prune.log";
const CRON_FILE = "/etc/cron.d/claude-feature-prune";

const USERS = [
  { linuxUser: "admin", homeDir: "/home/admin" },
  { linuxUser: "marmar", homeDir: "/home/marmar" },
] as const;

type LinuxUser = (typeof USERS)[number]["linuxUser"];

type RawEntry = Record<string, unknown>;

type NormalizedWorktree = {
  user: LinuxUser;
  name: string;
  repoBasename: string;
  repoRoot: string | null;
  worktreePath: string;
  branch: string;
  baseBranch: string;
  baseSha: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  existsOnDisk: boolean;
};

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function normalize(user: LinuxUser, raw: RawEntry): NormalizedWorktree | null {
  const name = str(raw.name);
  const branch = str(raw.branch);
  if (!name || !branch) return null;
  const worktreePath =
    str(raw.worktree_path) ?? str(raw.path) ?? "";
  return {
    user,
    name,
    repoBasename:
      str(raw.repo_basename) ?? str(raw.repo) ?? "unknown",
    repoRoot: str(raw.repo_root),
    worktreePath,
    branch,
    baseBranch: str(raw.base_branch) ?? str(raw.baseBranch) ?? "main",
    baseSha: str(raw.base_sha_at_creation),
    createdAt: str(raw.created_at) ?? str(raw.created),
    lastActiveAt: str(raw.last_active_at) ?? str(raw.lastTouched),
    existsOnDisk: worktreePath ? existsSync(worktreePath) : false,
  };
}

async function readRegistry(
  user: LinuxUser,
  homeDir: string,
): Promise<NormalizedWorktree[]> {
  // `/home/marmar/.claude/` is 0700, so we sudo as the owning user to read.
  return new Promise<NormalizedWorktree[]>((resolve) => {
    const child = spawn(
      "sudo",
      ["-n", "-u", user, "cat", `${homeDir}/.claude/worktrees/active.json`],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    child.stdout.on("data", (b) => (out += b.toString()));
    child.on("close", () => {
      try {
        const parsed = JSON.parse(out);
        const arr = Array.isArray(parsed?.worktrees) ? parsed.worktrees : [];
        resolve(
          arr
            .map((e: RawEntry) => normalize(user, e))
            .filter((x: NormalizedWorktree | null): x is NormalizedWorktree => x !== null),
        );
      } catch {
        resolve([]);
      }
    });
    child.on("error", () => resolve([]));
  });
}

function readCronSchedule(): string[] {
  try {
    return readFileSync(CRON_FILE, "utf8")
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("#"));
  } catch {
    return [];
  }
}

function readPruneLogTail(maxLines = 60): { lines: string[]; mtime: string | null } {
  try {
    const raw = readFileSync(PRUNE_LOG, "utf8");
    const lines = raw.split("\n").filter(Boolean).slice(-maxLines);
    const mtime = statSync(PRUNE_LOG).mtime.toISOString();
    return { lines, mtime };
  } catch {
    return { lines: [], mtime: null };
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!("ok" in auth)) return auth;

  const lists = await Promise.all(
    USERS.map((u) => readRegistry(u.linuxUser, u.homeDir)),
  );
  const worktrees = lists.flat().sort((a, b) => {
    const ta = a.lastActiveAt ?? a.createdAt ?? "";
    const tb = b.lastActiveAt ?? b.createdAt ?? "";
    return tb.localeCompare(ta);
  });

  return NextResponse.json({
    worktrees,
    cron: readCronSchedule(),
    pruneLog: readPruneLogTail(),
  });
}

type ActionBody = {
  action: "done" | "prune" | "start" | "switch";
  user: LinuxUser;
  name?: string;
  mode?: "s" | "m" | "d" | "k";
  baseBranch?: string;
  repoRoot?: string;
  dryRun?: boolean;
  days?: number;
};

const NAME_RE = /^[a-zA-Z0-9._-]+$/;
const BRANCH_RE = /^[a-zA-Z0-9._/-]+$/;
const ABS_PATH_RE = /^\/srv\/refusion-core(\/|$)/;

function bad(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}

function runWrapper(
  user: LinuxUser,
  args: string[],
  cwd?: string,
): Promise<{ ok: boolean; stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const child = spawn("sudo", ["-n", "-u", user, WRAPPER, ...args], {
      cwd: cwd && ABS_PATH_RE.test(cwd) ? cwd : "/srv/refusion-core",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.stderr.on("data", (b) => (stderr += b.toString()));
    child.on("close", (code) => {
      resolve({ ok: code === 0, stdout, stderr, exitCode: code });
    });
    child.on("error", (e) => {
      resolve({ ok: false, stdout: "", stderr: String(e), exitCode: null });
    });
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!("ok" in auth)) return auth;

  let body: ActionBody;
  try {
    body = (await req.json()) as ActionBody;
  } catch {
    return bad("Invalid JSON");
  }

  const { action, user } = body;
  if (!USERS.find((u) => u.linuxUser === user)) return bad("Unknown user");

  if (action === "start") {
    const { name, repoRoot, baseBranch } = body;
    if (!name || !NAME_RE.test(name)) return bad("Bad name");
    if (!repoRoot || !ABS_PATH_RE.test(repoRoot)) return bad("Bad repoRoot");
    if (baseBranch && !BRANCH_RE.test(baseBranch)) return bad("Bad baseBranch");
    const args = ["start", name];
    if (baseBranch) args.push("--base", baseBranch);
    const r = await runWrapper(user, args, repoRoot);
    return NextResponse.json(r);
  }

  if (action === "done") {
    const { name, mode } = body;
    if (!name || !NAME_RE.test(name)) return bad("Bad name");
    if (!mode || !["s", "m", "d", "k"].includes(mode)) return bad("Bad mode");
    const r = await runWrapper(user, ["done", name, mode]);
    return NextResponse.json(r);
  }

  if (action === "prune") {
    const { dryRun, days } = body;
    const args = ["prune"];
    if (dryRun) args.push("--dry-run");
    if (typeof days === "number" && days >= 0 && days <= 365) {
      args.push("--days", String(days));
    } else {
      args.push("--days", "14");
    }
    const r = await runWrapper(user, args);
    return NextResponse.json(r);
  }

  if (action === "switch") {
    const { name } = body;
    if (!name || !NAME_RE.test(name)) return bad("Bad name");
    const r = await runWrapper(user, ["switch", name]);
    return NextResponse.json(r);
  }

  return bad("Unknown action");
}
