// GET /api/hardening/mesh-vpn/status
//
// Consolidated snapshot consumed by MeshVpnControlModal. Composes:
//   - service state          via `systemctl is-active headscale`
//   - last config modified   via `stat -c %y /etc/headscale/config.yaml`
//   - enrolled devices       via `headscale nodes list -o json`
//   - enrolled users         via `headscale users list -o json`
//   - per-user preauth keys  via `headscale preauthkeys list -u <user> -o json`
//   - UFW status             via `ufw status verbose`
//   - Office-side prefs      from data/mesh-vpn/mesh-vpn-config.json
//
// Every shell-out is wrapped in try/catch so a single failing call still
// returns a degraded-but-renderable payload. Errors leak to server logs
// only, never to the response body.

import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireAdmin } from "@/lib/api-admin";

const execFileP = promisify(execFile);
const EXEC_TIMEOUT_MS = 5_000;

type ServiceState = "running" | "stopped" | "error" | "unknown";

type HeadscaleNode = {
  id?: number | string;
  name?: string;
  given_name?: string;
  user?: { name?: string } | string;
  ip_addresses?: string[];
  last_seen?: string;
  online?: boolean;
  // Headscale tags some fields differently across versions — we tolerate
  // both snake_case and camelCase via lookups in normalize().
  [k: string]: unknown;
};

type HeadscaleUser = { id?: number | string; name?: string };

type HeadscalePreAuthKey = {
  id?: string;
  key?: string;
  user?: { name?: string } | string;
  reusable?: boolean;
  used?: boolean;
  ephemeral?: boolean;
  created_at?: string;
  expiration?: string;
};

type UfwRule = {
  to: string;
  action: string;
  from: string;
  comment: string | null;
};

type MeshVpnConfig = {
  publicSshPort?: number;
  ufwTemporaryAllowances?: unknown[];
  fail2banJailName?: string;
  uiFlags?: Record<string, unknown>;
  lastUpdated?: string | null;
  version?: number;
};

function readMeshVpnConfig(): MeshVpnConfig {
  try {
    const p = path.join(process.cwd(), "data", "mesh-vpn", "mesh-vpn-config.json");
    return JSON.parse(fs.readFileSync(p, "utf8")) as MeshVpnConfig;
  } catch {
    return {};
  }
}

async function getServiceState(): Promise<ServiceState> {
  try {
    const { stdout } = await execFileP("systemctl", ["is-active", "headscale"], {
      timeout: EXEC_TIMEOUT_MS,
    });
    const v = stdout.trim();
    if (v === "active") return "running";
    if (v === "inactive") return "stopped";
    if (v === "failed") return "error";
    return "unknown";
  } catch (e) {
    // systemctl returns non-zero when unit is inactive/failed; parse from
    // err.stdout if present.
    const err = e as { stdout?: string; code?: number };
    const v = (err.stdout ?? "").trim();
    if (v === "inactive") return "stopped";
    if (v === "failed") return "error";
    return "unknown";
  }
}

async function getLastConfigModified(): Promise<string | null> {
  try {
    const { stdout } = await execFileP(
      "stat",
      ["-c", "%y", "/etc/headscale/config.yaml"],
      { timeout: EXEC_TIMEOUT_MS },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function getNodes(): Promise<HeadscaleNode[]> {
  try {
    const { stdout } = await execFileP(
      "headscale",
      ["nodes", "list", "-o", "json"],
      { timeout: EXEC_TIMEOUT_MS },
    );
    const parsed = JSON.parse(stdout) as unknown;
    return Array.isArray(parsed) ? (parsed as HeadscaleNode[]) : [];
  } catch {
    return [];
  }
}

async function getUsers(): Promise<HeadscaleUser[]> {
  try {
    const { stdout } = await execFileP(
      "headscale",
      ["users", "list", "-o", "json"],
      { timeout: EXEC_TIMEOUT_MS },
    );
    const parsed = JSON.parse(stdout) as unknown;
    return Array.isArray(parsed) ? (parsed as HeadscaleUser[]) : [];
  } catch {
    return [];
  }
}

async function getPreAuthKeysFor(user: string): Promise<HeadscalePreAuthKey[]> {
  try {
    const { stdout } = await execFileP(
      "headscale",
      ["preauthkeys", "list", "-u", user, "-o", "json"],
      { timeout: EXEC_TIMEOUT_MS },
    );
    const parsed = JSON.parse(stdout) as unknown;
    return Array.isArray(parsed) ? (parsed as HeadscalePreAuthKey[]) : [];
  } catch {
    return [];
  }
}

async function getUfw(): Promise<{ enabled: boolean; rules: UfwRule[] }> {
  try {
    const { stdout } = await execFileP("ufw", ["status", "verbose"], {
      timeout: EXEC_TIMEOUT_MS,
    });
    return parseUfwStatus(stdout);
  } catch {
    try {
      // ufw frequently requires sudo for `status`; try with sudo -n.
      const { stdout } = await execFileP("sudo", ["-n", "ufw", "status", "verbose"], {
        timeout: EXEC_TIMEOUT_MS,
      });
      return parseUfwStatus(stdout);
    } catch {
      return { enabled: false, rules: [] };
    }
  }
}

function parseUfwStatus(raw: string): { enabled: boolean; rules: UfwRule[] } {
  const enabled = /Status:\s*active/i.test(raw);
  const rules: UfwRule[] = [];
  const lines = raw.split("\n");
  let inTable = false;
  for (const line of lines) {
    if (/^-+\s+-+\s+-+/.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.trim()) continue;
    // ufw verbose rule line: "<to> <action> <from> # <comment>"
    // Action is a single token like ALLOW or DENY; the "to" portion can
    // contain spaces (e.g. "22/tcp (v6)") so we split on the action keyword.
    const m = line.match(/^\s*(.+?)\s+(ALLOW IN|DENY IN|REJECT IN|LIMIT IN|ALLOW OUT|DENY OUT|ALLOW|DENY|REJECT|LIMIT)\s+(.+?)(?:\s+#\s+(.*))?$/);
    if (!m) continue;
    rules.push({
      to: m[1].trim(),
      action: m[2].trim(),
      from: m[3].trim(),
      comment: m[4]?.trim() ?? null,
    });
  }
  return { enabled, rules };
}

function pickUserName(u: HeadscaleNode["user"]): string {
  if (!u) return "";
  if (typeof u === "string") return u;
  return u.name ?? "";
}

function normalizeDevice(n: HeadscaleNode): {
  id: string;
  hostname: string;
  os: string;
  user: string;
  meshIp: string;
  lastSeen: string | null;
} {
  const id = String(n.id ?? "");
  const hostname = (n.given_name as string) || (n.name as string) || "";
  const os = ((n as { os?: string }).os ?? "") as string;
  const user = pickUserName(n.user);
  const meshIp = Array.isArray(n.ip_addresses) && n.ip_addresses.length > 0 ? n.ip_addresses[0] : "";
  const lastSeen = n.last_seen ?? null;
  return { id, hostname, os, user, meshIp, lastSeen };
}

function normalizePreAuthKey(k: HeadscalePreAuthKey): {
  id: string;
  key: string;
  user: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  reusable: boolean;
} {
  return {
    id: String(k.id ?? k.key ?? ""),
    key: String(k.key ?? ""),
    user: pickUserName(k.user as HeadscaleNode["user"]),
    createdAt: k.created_at ?? "",
    expiresAt: k.expiration ?? "",
    used: Boolean(k.used),
    reusable: Boolean(k.reusable),
  };
}

// Collapse raw UFW rules into the SSH-rule summary the modal renders. The
// modal's UfwSshRulePanel reads ufw.active/port/allowedSources/exceptions, so
// returning the raw { enabled, rules } shape crashes it (allowedSources.length
// on undefined). RCS SSH lives on 27720, firewalled to the mesh subnet
// (100.64.0.0/10); any other allowed source is a per-IP exception.
function summarizeUfwForSsh(
  ufw: { enabled: boolean; rules: UfwRule[] },
  port: string,
): { active: boolean; port: string; allowedSources: string[]; exceptions: string[] } {
  const allows = ufw.rules.filter(
    (r) => r.to.startsWith(port) && /ALLOW/i.test(r.action),
  );
  const allowedSources = allows.map((r) => r.from).filter(Boolean);
  const openToAnywhere = allowedSources.some((s) => /^anywhere/i.test(s));
  // "Restricted" = firewall on AND the SSH port is allowed only from specific
  // sources (never from Anywhere).
  const active = ufw.enabled && allowedSources.length > 0 && !openToAnywhere;
  // Per-IP exceptions = allowed sources that aren't the mesh subnet.
  const exceptions = allowedSources.filter(
    (s) => !/^100\./.test(s) && !/^anywhere/i.test(s),
  );
  return { active, port, allowedSources, exceptions };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const config = readMeshVpnConfig();

  // Fan out in parallel — every helper catches its own errors so we never
  // short-circuit the snapshot on a single failure.
  const [serviceState, lastConfigModified, nodes, users, ufw] = await Promise.all([
    getServiceState(),
    getLastConfigModified(),
    getNodes(),
    getUsers(),
    getUfw(),
  ]);

  const userNames = users
    .map(u => u.name ?? "")
    .filter((s): s is string => Boolean(s));

  // Per-user preauth keys, also in parallel.
  const perUserKeys = await Promise.all(userNames.map(getPreAuthKeysFor));
  const preauthKeys = perUserKeys.flat().map(normalizePreAuthKey);

  const sshPort = String(config.publicSshPort ?? 27720);

  return NextResponse.json({
    service: {
      state: serviceState,
      lastConfigModified,
    },
    devices: nodes.map(normalizeDevice),
    // Key matches the modal's MeshVpnStatus type (preAuthKeys, not preauthKeys).
    preAuthKeys: preauthKeys,
    ufw: summarizeUfwForSsh(ufw, sshPort),
    // This route is requireAdmin-gated, so the caller is an admin.
    currentRole: "admin" as const,
    enrolledUsers: userNames,
    fail2banJailName: config.fail2banJailName ?? "headscale-ssh",
  });
}
