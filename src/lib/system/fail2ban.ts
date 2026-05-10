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
};

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
  };
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
