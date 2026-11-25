import "server-only";
// Runs fah-ctl on a donor host over SSH. The remote key is a forced command, so the only words that
// matter are the validated verbs below — nothing free-form ever reaches the remote side.
import { execFile } from "node:child_process";
import { donorName, foldingHosts, knownHostsPath, sshKeyPath, type FoldingHost } from "./hosts";
import type { FoldingDonorStats, FoldingHostStatus } from "./types";

type Verb = "status" | "start" | "stop" | `team ${number}`;

function run(h: FoldingHost, verb: Verb, timeoutMs = 25000): Promise<FoldingHostStatus> {
  const args = [
    "-i", sshKeyPath(),
    "-p", String(h.port),
    "-o", "BatchMode=yes",
    "-o", "IdentitiesOnly=yes",
    "-o", "ConnectTimeout=8",
    "-o", "ControlPath=none",
    "-o", `UserKnownHostsFile=${knownHostsPath()}`,
    "-o", "StrictHostKeyChecking=yes",
    `${h.user}@${h.host}`,
    verb,
  ];
  return new Promise((resolve) => {
    execFile("ssh", args, { timeout: timeoutMs, maxBuffer: 256 * 1024 }, (err, stdout, stderr) => {
      const base = { id: h.id, label: h.label, role: h.role };
      const line = String(stdout).trim().split("\n").pop() || "";
      try {
        const j = JSON.parse(line);
        if (j && j.ok === false) return resolve({ ...base, reachable: true, error: String(j.error || "failed") });
        return resolve({ ...base, reachable: true, ...j });
      } catch {
        const msg = String(stderr).trim().split("\n").pop() || (err ? err.message : "no answer");
        return resolve({ ...base, reachable: false, error: msg.slice(0, 200) });
      }
    });
  });
}

export async function statusAll(): Promise<FoldingHostStatus[]> {
  return Promise.all(foldingHosts().map((h) => run(h, "status")));
}

export async function act(hostId: string, verb: "start" | "stop" | "team", team?: number): Promise<FoldingHostStatus | null> {
  const h = foldingHosts().find((x) => x.id === hostId);
  if (!h) return null;
  if (verb === "team") {
    if (!Number.isInteger(team) || (team as number) < 0 || (team as number) > 9_999_999_999) return null;
    return run(h, `team ${team as number}`);
  }
  return run(h, verb, 45000);
}

// Public donor stats for the name the box actually folds under (falls back to FOLDING_DONOR) — cached 5 min; a brand-new donor 404s until its first unit is credited.
let cache: { at: number; v: FoldingDonorStats } | null = null;
export async function donorStats(reported?: string | null): Promise<FoldingDonorStats> {
  const name = reported || donorName();
  if (cache && cache.v?.name === name && Date.now() - cache.at < 5 * 60_000) return cache.v;
  let v: FoldingDonorStats = { name, score: null, wus: null, rank: null };
  try {
    const r = await fetch(`https://api.foldingathome.org/user/${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      v = { name, score: typeof j.score === "number" ? j.score : null, wus: typeof j.wus === "number" ? j.wus : null, rank: typeof j.rank === "number" ? j.rank : null };
    }
  } catch {
    /* stats site down — keep nulls */
  }
  cache = { at: Date.now(), v };
  return v;
}
