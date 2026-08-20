// fail2ban server-side wrapper — RCS-wide read + targeted ban/unban.
//
// Used by the HardeningControlModal pattern (every hardening modal embeds
// the RCS-wide fail2ban view so operators see the full posture, not just
// their slice). The telephony modal highlights the freeswitch-toll-fraud
// jail specifically; future modals (postgres, ssh, nginx) will highlight
// their own jail.
//
// Auth: caller must already have passed admin gating. This module shells
// out to fail2ban-client via passwordless sudo (admin has it on RCS).

import { execFile } from "child_process";
import { promisify } from "util";

const execFileP = promisify(execFile);

export type Fail2banJailSummary = {
  name: string;
  filter: string | null;
  fileList: string[];
  currentlyFailed: number;
  totalFailed: number;
  currentlyBanned: number;
  totalBanned: number;
  bannedIps: string[];
  /** The jail's ignore list — addresses and CIDRs it will never ban. */
  ignoreIps: string[];
};

/**
 * An address or CIDR block, for the ignore list. Ban/unban take single
 * addresses; the ignore list is where whole carrier subnets belong, so it
 * needs the prefix length the ban validator deliberately forbids.
 */
const CIDR_RE = /^[0-9a-fA-F:.]+(\/\d{1,3})?$/;

const SUDO = "sudo";
const F2B = "/usr/bin/fail2ban-client";

async function f2b(...args: string[]): Promise<string> {
  const { stdout } = await execFileP(SUDO, ["-n", F2B, ...args], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}

/** Returns the names of every active jail, RCS-wide. */
export async function listJails(): Promise<string[]> {
  const out = await f2b("status");
  // "Jail list:\tnginx-http-auth, sshd, freeswitch-toll-fraud"
  const m = out.match(/Jail list:\s*(.+)/);
  if (!m) return [];
  return m[1]
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

/** Detail for one jail. */
export async function jailStatus(jailName: string): Promise<Fail2banJailSummary> {
  // Validate jail name to forbid shell-meta. Names should be [a-zA-Z0-9_-]+.
  if (!/^[a-zA-Z0-9_-]+$/.test(jailName)) {
    throw new Error(`Invalid jail name: ${jailName}`);
  }
  const out = await f2b("status", jailName);
  const findNum = (label: string) => {
    const m = out.match(new RegExp(`${label}:\\s*(\\d+)`));
    return m ? Number(m[1]) : 0;
  };
  const findStr = (label: string) => {
    const m = out.match(new RegExp(`${label}:\\s*(.+)`));
    return m ? m[1].trim() : "";
  };
  const filter = findStr("Filter") || null;
  const fileListRaw = findStr("File list");
  const fileList = fileListRaw
    ? fileListRaw.split(/[\s,]+/).filter(Boolean)
    : [];
  const bannedIpListRaw = findStr("Banned IP list");
  const bannedIps = bannedIpListRaw
    ? bannedIpListRaw.split(/[\s,]+/).filter(Boolean)
    : [];
  return {
    name: jailName,
    filter,
    fileList,
    currentlyFailed: findNum("Currently failed"),
    totalFailed: findNum("Total failed"),
    currentlyBanned: findNum("Currently banned"),
    totalBanned: findNum("Total banned"),
    bannedIps,
    ignoreIps: await jailIgnoreList(jailName),
  };
}

/**
 * The jail's ignore list. `status` does not carry it, so it is a second
 * call — and a jail that has none prints a header with no rows, which is
 * an empty list rather than a failure.
 */
export async function jailIgnoreList(jailName: string): Promise<string[]> {
  if (!/^[a-zA-Z0-9_-]+$/.test(jailName)) {
    throw new Error(`Invalid jail name: ${jailName}`);
  }
  let out: string;
  try {
    out = await f2b("get", jailName, "ignoreip");
  } catch {
    return [];
  }
  // "These IP addresses/networks are ignored:\n|- 127.0.0.0/8\n`- ::1"
  return out
    .split("\n")
    .map(line => line.replace(/^[|`]?-\s*/, "").trim())
    .filter(line => line && !/ignored:?$/i.test(line) && !/^These /i.test(line));
}

/** Detail for every jail on the box. */
export async function allJailStatus(): Promise<Fail2banJailSummary[]> {
  const names = await listJails();
  return Promise.all(names.map(jailStatus));
}

/** Ban an IP in a specific jail. */
export async function banIp(jailName: string, ip: string): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(jailName)) throw new Error(`Invalid jail: ${jailName}`);
  if (!/^[0-9a-fA-F:.]+$/.test(ip)) throw new Error(`Invalid IP: ${ip}`);
  await f2b("set", jailName, "banip", ip);
}

/** Unban an IP from a specific jail. */
export async function unbanIp(jailName: string, ip: string): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(jailName)) throw new Error(`Invalid jail: ${jailName}`);
  if (!/^[0-9a-fA-F:.]+$/.test(ip)) throw new Error(`Invalid IP: ${ip}`);
  await f2b("set", jailName, "unbanip", ip);
}

/**
 * Add an address or CIDR to a jail's ignore list.
 *
 * RUNTIME ONLY — fail2ban forgets this on restart. The durable home for an
 * ignore list is the jail's own `ignoreip =` line under
 * /etc/fail2ban/jail.d/, and the UI says so; this is the lever for the case
 * where a carrier IP is about to be banned and the config edit can wait.
 */
export async function addIgnoreIp(jailName: string, cidr: string): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(jailName)) throw new Error(`Invalid jail: ${jailName}`);
  if (!CIDR_RE.test(cidr)) throw new Error(`Invalid address or CIDR: ${cidr}`);
  await f2b("set", jailName, "addignoreip", cidr);
}

/** Remove an address or CIDR from a jail's ignore list. Runtime only, as above. */
export async function removeIgnoreIp(jailName: string, cidr: string): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(jailName)) throw new Error(`Invalid jail: ${jailName}`);
  if (!CIDR_RE.test(cidr)) throw new Error(`Invalid address or CIDR: ${cidr}`);
  await f2b("set", jailName, "delignoreip", cidr);
}
