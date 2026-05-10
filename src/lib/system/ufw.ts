// UFW server-side wrapper — RCS-wide read + targeted insert/delete.
//
// Like the fail2ban wrapper, this module surfaces the FULL UFW rule set
// (every rule on the box, regardless of which service it protects). The
// HardeningControlModal pattern requires operators to see whole-box
// firewall posture from any hardening modal — telephony only highlights
// the SIP-related rules; the rest still render so misconfigurations
// elsewhere (an unexpectedly-open port, a forgotten allow-rule) surface
// alongside the SIP work.

import { execFile } from "child_process";
import { promisify } from "util";

const execFileP = promisify(execFile);

export type UfwRule = {
  index: number;          // 1-based numbered rule, as `ufw status numbered` shows
  to: string;             // "Anywhere" or specific port/proto/host
  action: "ALLOW" | "DENY" | "REJECT" | "LIMIT" | string;
  direction: "IN" | "OUT" | string;
  from: string;
  comment: string | null;
};

export type UfwSnapshot = {
  active: boolean;
  defaultIncoming: string;
  defaultOutgoing: string;
  defaultRouted: string;
  rules: UfwRule[];
  raw: string;
};

const SUDO = "sudo";
const UFW = "/usr/sbin/ufw";

async function ufw(...args: string[]): Promise<string> {
  const { stdout } = await execFileP(SUDO, ["-n", UFW, ...args], {
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}

/**
 * Read the full UFW state. We parse `ufw status verbose` for defaults +
 * `ufw status numbered` for the rule list (which gives us [N] indices).
 */
export async function readUfw(): Promise<UfwSnapshot> {
  const verbose = await ufw("status", "verbose");
  const numbered = await ufw("status", "numbered");

  const active = /Status:\s*active/i.test(verbose);
  const di = (verbose.match(/Default:\s*([a-zA-Z]+)\s*\(incoming\)/) || [])[1] ?? "unknown";
  const dO = (verbose.match(/Default:[^()]+\(incoming\),\s*([a-zA-Z]+)\s*\(outgoing\)/) || [])[1] ?? "unknown";
  const dR = (verbose.match(/\(outgoing\),\s*([a-zA-Z]+)\s*\(routed\)/) || [])[1] ?? "unknown";

  const rules: UfwRule[] = [];
  // numbered output rows look like:
  //   "[ 5] 443/tcp                    ALLOW IN    Anywhere                  "
  //   "[ 4] Anywhere                   DENY IN     192.0.2.1                  # comment"
  // (alignment varies; whitespace-separate but the comment is `# ...` at end)
  for (const rawLine of numbered.split("\n")) {
    const m = rawLine.match(/^\[\s*(\d+)\]\s+(.+)$/);
    if (!m) continue;
    const index = Number(m[1]);
    const rest = m[2];

    // Split off comment first.
    let withoutComment = rest;
    let comment: string | null = null;
    const hashIdx = rest.indexOf("#");
    if (hashIdx !== -1) {
      comment = rest.slice(hashIdx + 1).trim();
      withoutComment = rest.slice(0, hashIdx).trimEnd();
    }
    // Tokenise on whitespace; format is roughly:
    //   <to>... <action> <direction> <from>...
    // Where <to> and <from> may contain spaces if "Anywhere (v6)" or "192.0.2.1/32".
    // Use the action+direction pair as a pivot since those are single tokens.
    const tokens = withoutComment.split(/\s+/).filter(Boolean);
    let pivot = -1;
    for (let i = 0; i < tokens.length - 1; i++) {
      if (
        /^(ALLOW|DENY|REJECT|LIMIT)$/.test(tokens[i]) &&
        /^(IN|OUT|FWD)$/.test(tokens[i + 1])
      ) {
        pivot = i;
        break;
      }
    }
    if (pivot === -1) continue;
    const action = tokens[pivot];
    const direction = tokens[pivot + 1];
    const to = tokens.slice(0, pivot).join(" ").trim();
    const from = tokens.slice(pivot + 2).join(" ").trim();
    rules.push({ index, to, action, direction, from, comment });
  }

  return {
    active,
    defaultIncoming: di,
    defaultOutgoing: dO,
    defaultRouted: dR,
    rules,
    raw: numbered,
  };
}

/**
 * Insert a deny-from-IP rule at the top of the chain. Used by manual ban
 * operations from the modal.
 */
export async function denyFromIp(ip: string, comment: string): Promise<void> {
  if (!/^[0-9a-fA-F:.\/]+$/.test(ip)) throw new Error(`Invalid IP: ${ip}`);
  // Comment is passed as a single argv item to execFile, so shell-injection
  // is not a concern; UFW itself sanitises by stripping non-printable.
  await execFileP(SUDO, [
    "-n", UFW, "insert", "1",
    "deny", "from", ip, "to", "any",
    "comment", comment,
  ], { timeout: 10_000 });
}

/**
 * Allow-from-IP/CIDR rule. Used to add allowlist entries (e.g. additional
 * Telnyx SBC ranges if Telnyx ever expands).
 */
export async function allowFrom(opts: {
  source: string;          // IP or CIDR
  port?: string;           // numeric port or "5080"
  proto?: "tcp" | "udp";
  comment: string;
}): Promise<void> {
  if (!/^[0-9a-fA-F:.\/]+$/.test(opts.source)) throw new Error(`Invalid source: ${opts.source}`);
  if (opts.port && !/^\d+(:\d+)?$/.test(opts.port)) throw new Error(`Invalid port: ${opts.port}`);
  if (opts.proto && !/^(tcp|udp)$/.test(opts.proto)) throw new Error(`Invalid proto: ${opts.proto}`);

  const args = [
    "-n", UFW, "allow", "from", opts.source, "to", "any",
  ];
  if (opts.port) {
    args.push("port", opts.port);
  }
  if (opts.proto) {
    args.push("proto", opts.proto);
  }
  args.push("comment", opts.comment);
  await execFileP(SUDO, args, { timeout: 10_000 });
}

/** Delete the rule at the given 1-based index from `ufw status numbered`. */
export async function deleteRule(index: number): Promise<void> {
  if (!Number.isInteger(index) || index < 1) throw new Error(`Invalid index: ${index}`);
  await execFileP(SUDO, [
    "-n", UFW, "--force", "delete", String(index),
  ], { timeout: 10_000 });
}
