import "server-only";
// Folding@home donor hosts — which boxes Office can switch folding on/off on.
//
// Each host runs Folding@home (fah-client) plus `fah-ctl` (mono rcs-stack/folding-at-home.md), reached
// over SSH as a locked-down user whose key may ONLY run fah-ctl (forced command):
//   status | start | stop | team <n> | user <name>
// Configure with FOLDING_HOSTS (JSON array) in Office's .env.local; the default is RCS1 on the mesh.
// The key + known_hosts paths default to the Office runtime user's ~/.ssh.
import os from "node:os";
import path from "node:path";

export type FoldingHost = {
  id: string;
  label: string;
  /** shown on the tile, e.g. "standby box" */
  role?: string;
  host: string;
  port: number;
  user: string;
};

const DEFAULT_HOSTS: FoldingHost[] = [
  { id: "rcs1", label: "RCS1", role: "standby box", host: "100.64.0.8", port: 27720, user: "fahctl" },
];

export function foldingHosts(): FoldingHost[] {
  const raw = process.env.FOLDING_HOSTS;
  if (!raw) return DEFAULT_HOSTS;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return DEFAULT_HOSTS;
    return arr
      .filter((h) => h && typeof h.id === "string" && typeof h.host === "string")
      .map((h) => ({
        id: String(h.id),
        label: String(h.label ?? h.id),
        role: h.role ? String(h.role) : undefined,
        host: String(h.host),
        port: Number(h.port) || 22,
        user: String(h.user ?? "fahctl"),
      }));
  } catch {
    return DEFAULT_HOSTS;
  }
}

export const sshKeyPath = () => process.env.FOLDING_SSH_KEY || path.join(os.homedir(), ".ssh", "fahctl_ed25519");
export const knownHostsPath = () => process.env.FOLDING_KNOWN_HOSTS || path.join(os.homedir(), ".ssh", "known_hosts_fahctl");

/** Public stats name — the donor name every host folds under. */
export const donorName = () => process.env.FOLDING_DONOR || "TinyGlobalVillage";
