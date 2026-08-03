/**
 * Box Usage Monitor — the disk breakdown's allow-list.
 *
 * "Disk is at 93%" is only half an answer; the other half is WHICH DIRECTORIES,
 * and whether any of them are safe to reclaim. This file is that second half,
 * and it is deliberately a hard-coded list rather than a walk of the filesystem:
 *
 *   1. A request never carries a path. It carries a target ID, which is looked
 *      up here. There is no input that can point a delete at /etc.
 *   2. Every target states, in `what` and `consequence`, what is lost if it is
 *      swept — those strings are rendered in the modal beside the button, so
 *      nobody reclaims 32GB without reading what 32GB was.
 *   3. A target with `sweep: null` is measured and never deletable. That is the
 *      default posture; being sweepable is the exception and had to be argued
 *      for one directory at a time.
 *
 * The numbers in the comments are RCS on 2026-08-03, when disk crossed 90% and
 * this list was written from the actual `du` output.
 */
import "server-only";

/** Roots a target is allowed to live under. Belt and braces around the IDs. */
export const ALLOWED_ROOTS = [
  "/srv/refusion-core",
  "/home/admin",
  "/home/marmar",
  "/var/lib",
  "/var/log",
] as const;

export type SweepSpec =
  /** Immediate files matching `match`. Deleted, or emptied in place when `truncate`. */
  | {
      kind: "files";
      match: string;
      minAgeDays: number;
      /** Keep this many newest matches regardless of age. */
      keep: number;
      /** Ignore anything smaller than this — for "the log is huge", not "the log is old". */
      minBytes?: number;
      /**
       * Truncate rather than unlink. Required when a running process holds the
       * file open: unlinking a pm2 log frees NOTHING until the app restarts,
       * because the fd keeps the inode alive.
       */
      truncate?: boolean;
    }
  /** Immediate children (files or directories) matching `match`. Removed whole. */
  | { kind: "children"; match: string; minAgeDays: number; keep: number }
  /**
   * For each immediate subdirectory, remove these named entries inside it.
   * Build artefacts under a set of sibling checkouts: `node_modules`, `.next`.
   */
  | { kind: "nested"; entries: string[]; minAgeDays: number }
  /** A fixed argv. No shell, no interpolation — the array is the whole command. */
  | { kind: "command"; argv: string[] };

export type DiskTarget = {
  /** Stable slug — the only thing an API request may name. */
  id: string;
  label: string;
  /** Absolute, and inside ALLOWED_ROOTS. Never comes from a request. */
  path: string;
  group: "logs" | "builds" | "caches" | "system";
  /** What this directory is, in one sentence. Rendered in the modal. */
  what: string;
  /** What is lost by sweeping it. Rendered next to the button. */
  consequence: string;
  /** null = measured only. */
  sweep: SweepSpec | null;
  /** Reading it needs sudo (root-owned). Measured with `sudo -n`, else skipped. */
  needsRoot?: boolean;
};

export const DISK_TARGETS: DiskTarget[] = [
  {
    id: "freeswitch-logs",
    label: "FreeSWITCH logs",
    path: "/srv/refusion-core/telephony/install/var/log/freeswitch",
    group: "logs",
    what:
      "FreeSWITCH rotates its log at 1GB and keeps 32 of them — by design that is a 32GB ceiling, " +
      "and on 2026-08-03 it was holding the full set from April and May.",
    consequence:
      "Loses old SIP/call traces. Nothing live depends on them; the current freeswitch.log is never touched.",
    sweep: { kind: "files", match: "^freeswitch\\.log\\.\\d+$", minAgeDays: 14, keep: 2 },
  },
  {
    id: "office-logs",
    label: "Office daily logs",
    path: "/srv/refusion-core/logs/tgv-office",
    group: "logs",
    what: "One file per day from the Office log writer, around 340MB a day, never pruned.",
    consequence: "Loses history the Logs tile can page back through. No running state lives here.",
    sweep: { kind: "files", match: "^\\d{4}-\\d{2}-\\d{2}\\.log$", minAgeDays: 30, keep: 7 },
  },
  {
    id: "pm2-logs",
    label: "pm2 stdout/stderr",
    path: "/home/admin/.pm2/logs",
    group: "logs",
    what:
      "Per-app pm2 logs. One crash loop writes gigabytes: demo.tinyglobalvillage.com-error.log " +
      "alone was 1.5GB.",
    consequence:
      "Emptied in place, not deleted — pm2 holds these files open, so unlinking would free nothing " +
      "until every app restarted. Loses old console output only.",
    sweep: {
      kind: "files",
      match: "\\.log$",
      minAgeDays: 1,
      keep: 0,
      minBytes: 50 * 1024 * 1024,
      truncate: true,
    },
  },
  {
    id: "rcs-worktrees",
    label: "RCS-side lanes",
    path: "/srv/refusion-core/.claude/worktrees",
    group: "builds",
    what:
      "Git worktrees left on RCS by earlier Claude sessions, each carrying its own node_modules " +
      "and .next. Building on RCS is banned (it OOMs the box), so these are dead weight.",
    consequence:
      "Removes node_modules/.next/.turbo inside each lane — regenerable with an install. The source " +
      "and any uncommitted edits in the lane are left alone.",
    sweep: { kind: "nested", entries: ["node_modules", ".next", ".turbo"], minAgeDays: 14 },
  },
  {
    id: "deploy-rollbacks",
    label: "Deploy rollback copies",
    path: "/srv/refusion-core/clients",
    group: "builds",
    what:
      "mac-deploy keeps the previous build as .next.prev beside each client so a failed smoke test " +
      "can roll back. A copy older than a week is not a rollback anyone is going to take.",
    consequence:
      "Loses one-command rollback for clients not deployed recently. The live .next is untouched; " +
      "recovery becomes a redeploy instead of a folder swap.",
    sweep: { kind: "nested", entries: [".next.prev"], minAgeDays: 7 },
  },
  {
    id: "npm-cache",
    label: "npm cache",
    path: "/home/admin/.npm/_cacache",
    group: "caches",
    what: "Tarballs npm has already downloaded, kept so the next install can skip the network.",
    consequence: "Nothing breaks; the next install re-downloads what it needs and is slower once.",
    sweep: { kind: "children", match: ".", minAgeDays: 0, keep: 0 },
  },
  {
    id: "pnpm-store",
    label: "pnpm store",
    path: "/home/admin/.local/share/pnpm",
    group: "caches",
    what:
      "pnpm's content-addressed store. Installed node_modules hardlink INTO it, so this is shared " +
      "storage, not a throwaway cache.",
    consequence:
      "Swept with `pnpm store prune`, which removes only packages no installed project references. " +
      "Deleting the directory outright is NOT offered — that is how you break every workspace at once.",
    sweep: { kind: "command", argv: ["pnpm", "store", "prune"] },
  },
  {
    id: "playwright-cache",
    label: "Playwright browsers",
    path: "/home/admin/.cache/ms-playwright",
    group: "caches",
    what: "Downloaded Chromium builds, one directory per version.",
    consequence:
      "Old versions go, the newest is kept. A UAT run that wants a pruned version re-downloads it.",
    sweep: { kind: "children", match: ".", minAgeDays: 30, keep: 1 },
  },
  {
    id: "puppeteer-cache",
    label: "Puppeteer browsers",
    path: "/home/admin/.cache/puppeteer",
    group: "caches",
    what: "The same thing again for Puppeteer — a second copy of Chrome, by version.",
    consequence: "Same as Playwright: old versions go, newest stays, re-downloaded on demand.",
    sweep: { kind: "children", match: ".", minAgeDays: 30, keep: 1 },
  },
  {
    id: "containerd",
    label: "containerd images",
    path: "/var/lib/containerd",
    group: "system",
    what:
      "Container image layers and overlayfs snapshots. containerd is running, and what still " +
      "references these layers is not knowable from a directory listing.",
    consequence:
      "MEASURED ONLY. Pruning images is a `ctr`/`docker` operation with its own idea of what is in " +
      "use; doing it blind from a web modal could delete the layers under a running container.",
    sweep: null,
    needsRoot: true,
  },
  {
    id: "clients",
    label: "Client checkouts",
    path: "/srv/refusion-core/clients",
    group: "builds",
    what: "The deployed apps themselves — source, node_modules and the live .next for each site.",
    consequence: "MEASURED ONLY. This is production.",
    sweep: null,
  },
  {
    id: "archive",
    label: "Archive",
    path: "/srv/refusion-core/archive",
    group: "system",
    what: "Retired webhooks and old code kept deliberately.",
    consequence: "MEASURED ONLY. It is an archive; deleting it is a decision, not a cleanup.",
    sweep: null,
  },
  {
    id: "marmar-home",
    label: "marmar home",
    path: "/home/marmar",
    group: "system",
    what: "Marthe's home directory.",
    consequence: "MEASURED ONLY. Someone else's files.",
    sweep: null,
  },
];

export function targetById(id: string): DiskTarget | null {
  return DISK_TARGETS.find((t) => t.id === id) ?? null;
}

/** A target's path must sit under an allowed root — checked again at sweep time. */
export function isPathAllowed(p: string): boolean {
  return ALLOWED_ROOTS.some((root) => p === root || p.startsWith(`${root}/`));
}
