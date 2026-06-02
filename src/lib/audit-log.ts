// Hardening audit log — append-only JSONL writer for every state-mutating
// action issued via the System Hardening tiles (Mesh VPN, Telephony, …).
//
// Why JSONL: each line is independently parseable, append is atomic on POSIX
// for writes <PIPE_BUF, and we can `tail -f` from the box for forensics.
//
// Path resolution:
//   1. /var/log/office-hardening-audit.log if writable by the Node process
//   2. fallback to <cwd>/data/audit/hardening.log (created on demand)
// We cache the resolved path so we don't re-stat /var/log on every call.

import fs from "fs";
import path from "path";

const PRIMARY_LOG_PATH = "/var/log/office-hardening-audit.log";
const FALLBACK_LOG_PATH = path.join(
  process.cwd(),
  "data",
  "audit",
  "hardening.log",
);

let resolvedLogPath: string | null = null;

function ensureWritable(target: string): boolean {
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // Open in append+create mode to probe writability without truncating.
    const fd = fs.openSync(target, "a");
    fs.closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

function resolveLogPath(): string {
  if (resolvedLogPath) return resolvedLogPath;
  if (ensureWritable(PRIMARY_LOG_PATH)) {
    resolvedLogPath = PRIMARY_LOG_PATH;
  } else {
    // Always succeeds for project-local path under normal deploys.
    fs.mkdirSync(path.dirname(FALLBACK_LOG_PATH), { recursive: true });
    resolvedLogPath = FALLBACK_LOG_PATH;
  }
  return resolvedLogPath;
}

export type HardeningAuditEntry = {
  ts: string;                  // ISO timestamp
  action: string;              // e.g. "mesh-vpn.service.restart"
  target: string | null;       // resource id (device id, key id, …) or null
  user: string;                // username from requireAdmin()
  success: boolean;
  details?: Record<string, unknown> | string | null;
};

/**
 * Append a single audit-log entry as a JSON line. Never throws — audit log
 * write failures must not break the user-visible action.
 */
export function logHardeningAction(entry: {
  action: string;
  target?: string | null;
  user: string;
  success: boolean;
  details?: Record<string, unknown> | string | null;
}): void {
  const row: HardeningAuditEntry = {
    ts: new Date().toISOString(),
    action: entry.action,
    target: entry.target ?? null,
    user: entry.user,
    success: entry.success,
    details: entry.details ?? null,
  };
  try {
    const line = JSON.stringify(row) + "\n";
    fs.appendFileSync(resolveLogPath(), line, "utf8");
  } catch {
    // Swallow — we never want audit log I/O to surface to the caller.
  }
}
