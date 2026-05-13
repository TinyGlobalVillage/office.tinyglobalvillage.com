/**
 * GET /api/playbooks/index
 *
 * Walks /srv/refusion-core/utils/ to build a structured catalog of:
 *   - Scripts grouped by directory (aliases/, scripts/git/, scripts/pm2/, …),
 *     each with its README path + first-paragraph summary
 *   - Bash aliases parsed from /home/admin/.bashrc and /home/marmar/.bashrc,
 *     with redaction of obvious secrets and skip-listing of shell defaults
 *
 * Auth-gated. Used by PlaybookLibraryModal.
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const UTILS_ROOT = "/srv/refusion-core/utils";
const BASHRC_USERS = ["admin", "marmar"] as const;

// Ubuntu-default aliases inherited from /etc/skel/.bashrc — not user-authored.
const SHELL_DEFAULT_ALIASES = new Set([
  "ls", "ll", "la", "l", "dir", "vdir",
  "grep", "fgrep", "egrep",
  "alert",
]);

type ScriptEntry = {
  slug: string;            // unique id: "<group>/<name>"
  name: string;            // filename (e.g. "reload", "rebash.README.md")
  group: string;           // "aliases", "root", "scripts/pm2", …
  readmePath: string;      // absolute path to the README
  readmeRel: string;       // path relative to UTILS_ROOT (for the readme route)
  summary: string;         // first non-empty paragraph from the README
};

type AliasEntry = {
  user: string;
  name: string;
  expansion: string;        // redacted RHS
  callsScript: string | null; // slug of a catalog entry if RHS invokes a known script
};

/** Best-effort secret redactor — conservative; keeps the alias readable. */
function redact(value: string): string {
  let out = value;
  // URL-embedded creds: scheme://user:password@host → scheme://user:***@host
  out = out.replace(/(\b[a-z][a-z0-9+\-.]*:\/\/[^:\s'"]+):[^@\s'"]+@/gi, "$1:***@");
  // KEY=value when value looks token-shaped (16+ non-space chars with a digit)
  out = out.replace(/\b([A-Z][A-Z0-9_]{2,}=)([A-Za-z0-9+/_\-=]{16,})\b/g, "$1***");
  // Long bare hex/base64 tokens (32+ chars)
  out = out.replace(/\b[A-Fa-f0-9]{32,}\b/g, "<redacted-hex>");
  out = out.replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, (m) =>
    /^[A-Za-z]+$/.test(m) ? m : "<redacted-token>"
  );
  return out;
}

/** Parses `alias name='value'` and `alias name="value"` lines from a bashrc. */
function parseAliases(content: string): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  const re = /^\s*alias\s+([A-Za-z_][A-Za-z0-9_\-]*)=(?:'([^']*)'|"((?:\\.|[^"\\])*)")\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const name = m[1];
    const value = (m[2] ?? m[3] ?? "").replace(/\\(.)/g, "$1");
    out.push({ name, value });
  }
  return out;
}

/** First non-empty, non-heading paragraph from a markdown file. */
function summaryFromReadme(md: string): string {
  const lines = md.split("\n");
  const buf: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (buf.length) break;
      continue;
    }
    if (line.startsWith("#")) {
      if (buf.length) break;
      continue;
    }
    if (line.startsWith("```")) break;
    buf.push(line);
    if (buf.join(" ").length > 240) break;
  }
  return buf.join(" ").replace(/\s+/g, " ").slice(0, 240);
}

async function safeRead(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

/** Recursively collects .README.md files under UTILS_ROOT, skipping legacy/node_modules. */
async function collectReadmes(): Promise<ScriptEntry[]> {
  const out: ScriptEntry[] = [];
  async function walk(dir: string, rel: string) {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      if (e.name === "node_modules" || e.name === "legacy") continue;
      const abs = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(abs, r);
      } else if (e.isFile() && (e.name.endsWith(".README.md") || e.name === "README.md")) {
        const group = rel || "root";
        const name = e.name === "README.md" ? `${path.basename(rel) || "root"} (overview)` : e.name.replace(/\.README\.md$/, "");
        const md = (await safeRead(abs)) ?? "";
        out.push({
          slug: `${group}/${name}`,
          name,
          group,
          readmePath: abs,
          readmeRel: r,
          summary: summaryFromReadme(md),
        });
      }
    }
  }
  await walk(UTILS_ROOT, "");
  return out;
}

/** Determines if an alias's RHS invokes a known catalog script. */
function findCalledScript(rhs: string, scripts: ScriptEntry[]): string | null {
  // RHS shapes we care about: "reload foo", "sudo -u admin pm2 ...",
  // "pm2 restart X", "cd /srv/…", direct script name calls.
  // Heuristic: take the first token that isn't "sudo", "cd", "source",
  // an env-var assignment, etc., and look it up by script `name`.
  const tokens = rhs.split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (!tok || tok === "sudo" || tok === "-u" || tok === "admin" || tok === "marmar") continue;
    if (tok === "cd" || tok === "source" || tok === ".") continue;
    if (/^[A-Z_][A-Z0-9_]*=/.test(tok)) continue; // env var
    if (tok.startsWith("/") || tok.startsWith("~")) continue; // a path, not a command
    const match = scripts.find((s) => s.name === tok || s.name === `${tok}.sh` || s.name === `${tok}.py`);
    if (match) return match.slug;
    return null; // first command token decided
  }
  return null;
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Scripts
  const scripts = await collectReadmes();
  scripts.sort((a, b) =>
    a.group === b.group ? a.name.localeCompare(b.name) : a.group.localeCompare(b.group)
  );

  // Group scripts for client convenience
  const groupsMap = new Map<string, ScriptEntry[]>();
  for (const s of scripts) {
    const arr = groupsMap.get(s.group) ?? [];
    arr.push(s);
    groupsMap.set(s.group, arr);
  }
  const groups = Array.from(groupsMap.entries())
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Aliases
  const aliases: AliasEntry[] = [];
  for (const user of BASHRC_USERS) {
    const file = `/home/${user}/.bashrc`;
    const md = await safeRead(file);
    if (!md) continue;
    for (const { name, value } of parseAliases(md)) {
      if (SHELL_DEFAULT_ALIASES.has(name)) continue;
      const redacted = redact(value);
      aliases.push({
        user,
        name,
        expansion: redacted,
        callsScript: findCalledScript(redacted, scripts),
      });
    }
  }
  aliases.sort((a, b) =>
    a.user === b.user ? a.name.localeCompare(b.name) : a.user.localeCompare(b.user)
  );

  return NextResponse.json({
    groups,
    aliases,
    counts: { scripts: scripts.length, aliases: aliases.length, groups: groups.length },
  });
}
