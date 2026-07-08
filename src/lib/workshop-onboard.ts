// src/lib/workshop-onboard.ts
// Server helpers for the authenticated-Workshop onboarding wizard (Stage 3 of
// workshop-multiuser-authenticated). Three concerns, all backed by files under
// /srv/refusion-core/data/workshop/ (the same state home as jobs.json):
//
//   • accounts.json  — THE approved-users registry (also read by workshop.ts).
//     A staff member may only onboard if their Office username has a row with
//     approved:true. Adding rows stays a manual edit by Gio (locked decision 6).
//   • onboarding/<account>.json — live wizard state: hashed one-time token +
//     per-step status the bootstrap script reports as it runs on the new Mac.
//   • privileged writes — append the new Mac's pubkey to admin's authorized_keys
//     and write the `mac-<account>` ssh alias into admin's ~/.ssh/config, so the
//     workshop engine (RCS-side) can reach that laptop. Both idempotent+audited.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const pexec = promisify(execFile);
const STATE_DIR = "/srv/refusion-core/data/workshop";
const ACCOUNTS = path.join(STATE_DIR, "accounts.json");
const ONBOARD_DIR = path.join(STATE_DIR, "onboarding");

export const ACCOUNT_RE = /^[a-z][a-z0-9-]{1,30}$/;
export const STEPS = [
  "machine-check", "ssh-key", "rcs-access", "reverse-access",
  "workspace", "install", "tunnel-test", "done",
] as const;
export type StepId = (typeof STEPS)[number];
export type StepState = { status: "pending" | "run" | "ok" | "fail"; detail?: string; at?: string };

export type AccountRec = {
  account: string;
  macHost: string;
  webport: number;
  devport?: number;
  approved: boolean;
  addedBy?: string;
  addedAt?: string;
  bootstrappedAt?: string;
};
export type OnboardState = {
  account: string;
  tokenHash: string;
  startedAt: string;
  steps: Partial<Record<StepId, StepState>>;
  pubkeyInstalled?: boolean;
  aliasInstalled?: boolean;
  meshIp?: string;
  macUser?: string;
};

/* ── accounts registry ─────────────────────────────────────────── */
export function readAccounts(): AccountRec[] {
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS, "utf8")).accounts ?? [];
  } catch {
    return [];
  }
}
export function readAccount(account: string): AccountRec | null {
  return readAccounts().find((a) => a.account === account) ?? null;
}
export function patchAccount(account: string, patch: Partial<AccountRec>): void {
  const raw = JSON.parse(fs.readFileSync(ACCOUNTS, "utf8"));
  raw.accounts = (raw.accounts ?? []).map((a: AccountRec) =>
    a.account === account ? { ...a, ...patch } : a,
  );
  fs.writeFileSync(ACCOUNTS, JSON.stringify(raw, null, 2) + "\n");
}

/* ── onboarding state + one-time token ─────────────────────────── */
function stateFile(account: string): string {
  return path.join(ONBOARD_DIR, `${account}.json`);
}
export function readOnboard(account: string): OnboardState | null {
  try {
    return JSON.parse(fs.readFileSync(stateFile(account), "utf8"));
  } catch {
    return null;
  }
}
function writeOnboard(s: OnboardState): void {
  fs.mkdirSync(ONBOARD_DIR, { recursive: true });
  fs.writeFileSync(stateFile(s.account), JSON.stringify(s, null, 2) + "\n");
}
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** (Re)start onboarding for an approved account → plaintext token (shown ONCE in the wizard). */
export function startOnboarding(account: string): { token: string; state: OnboardState } {
  const token = randomBytes(16).toString("hex");
  const state: OnboardState = {
    account, tokenHash: hash(token), startedAt: new Date().toISOString(), steps: {},
  };
  writeOnboard(state);
  return { token, state };
}
export function verifyToken(account: string, token: string): OnboardState | null {
  const s = readOnboard(account);
  if (!s || !token) return null;
  const a = Buffer.from(s.tokenHash, "hex");
  const b = Buffer.from(hash(token), "hex");
  return a.length === b.length && timingSafeEqual(a, b) ? s : null;
}
export function recordStep(account: string, step: StepId, st: StepState): OnboardState {
  const s = readOnboard(account);
  if (!s) throw new Error("no onboarding in flight");
  s.steps[step] = { ...st, at: new Date().toISOString() };
  writeOnboard(s);
  return s;
}

/* ── privileged, idempotent host wiring (runs as admin on RCS) ──── */
const SSH_DIR = path.join(os.homedir(), ".ssh");
const ED25519_PUB_RE = /^ssh-ed25519 [A-Za-z0-9+/=]+( [\w@.:-]+)?$/;

/** Append the new Mac's pubkey to admin's authorized_keys (dedup; ed25519 only). */
export function installPubkey(account: string, pubkey: string): boolean {
  const key = pubkey.trim();
  if (!ED25519_PUB_RE.test(key)) return false;
  const file = path.join(SSH_DIR, "authorized_keys");
  const cur = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (!cur.includes(key.split(" ").slice(0, 2).join(" "))) {
    fs.appendFileSync(file, `${key} workshop:${account}\n`, { mode: 0o600 });
  }
  const s = readOnboard(account);
  if (s) { s.pubkeyInstalled = true; writeOnboard(s); }
  return true;
}

/** Write the Host mac-<account> alias into admin's ~/.ssh/config + verify reachability. */
export async function installMacAlias(account: string, meshIp: string, macUser: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(meshIp)) return { ok: false, error: "bad mesh ip" };
  if (!/^[a-z_][a-z0-9_-]{0,31}$/i.test(macUser)) return { ok: false, error: "bad mac user" };
  const alias = `mac-${account}`;
  const cfg = path.join(SSH_DIR, "config");
  const cur = fs.existsSync(cfg) ? fs.readFileSync(cfg, "utf8") : "";
  if (!new RegExp(`^Host ${alias}$`, "m").test(cur)) {
    fs.appendFileSync(
      cfg,
      `\n# workshop onboarding (auto-managed)\nHost ${alias}\n  HostName ${meshIp}\n  User ${macUser}\n  StrictHostKeyChecking accept-new\n  ServerAliveInterval 30\n`,
      { mode: 0o600 },
    );
  }
  try {
    await pexec("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", alias, "true"], { timeout: 20_000 });
  } catch (e) {
    return { ok: false, error: `alias written but ${alias} unreachable: ${String(e).slice(0, 160)}` };
  }
  const s = readOnboard(account);
  if (s) { s.aliasInstalled = true; s.meshIp = meshIp; s.macUser = macUser; writeOnboard(s); }
  return { ok: true };
}
