/**
 * RCS Maintenance — WHEN a "reboot needed" / "updates needed" notice goes out.
 * Pure, no I/O, tested with node --test (policy.test.mjs).
 *
 * Box Health's reboot pill is edge-triggered: it tells the team once and then
 * goes quiet for as long as the condition holds. That is how RCS sat on a
 * pending kernel from 2026-10-14 to November with nobody acting on it (Gio,
 * 2026-11-01: "so we don't wait this long"). A maintenance notice is the
 * opposite shape on purpose — it fires once the condition has been true for
 * `thresholdMs`, and then REPEATS every `reminderMs` until the condition clears,
 * plus one closing notice when it does.
 */

export type NoticeKind = "reboot" | "updates";
export type NoticeSend = "raise" | "remind" | "resolve";

export type NoticeState = {
  /** When the condition was first seen true. Null while it is false. */
  activeSince: number | null;
  /** When a raise/remind last actually went out. */
  lastSentAt: number | null;
  /** How many raise/remind notices this episode has sent. */
  sentCount: number;
};

export const INITIAL_NOTICE: NoticeState = { activeSince: null, lastSentAt: null, sentCount: 0 };

export type NoticeTiming = {
  /** How long the condition must hold before the first notice. 0 = at once. */
  thresholdMs: number;
  /** Gap between repeats while it still holds. */
  reminderMs: number;
};

/**
 * Fold one observation into the notice state.
 *
 * `observedSince` is the condition's own start time when the box can tell us
 * (the mtime of /var/run/reboot-required), so a freshly deployed Office does
 * not believe a month-old pending reboot started this minute. It only ever
 * moves the start EARLIER than what is remembered, never later.
 *
 * `suppressed` keeps tracking the episode but sends nothing — used when the
 * reboot notice already carries the update count, so one mail says both.
 */
export function decideNotice(
  prev: NoticeState,
  active: boolean,
  now: number,
  timing: NoticeTiming,
  observedSince: number | null = null,
  suppressed = false,
): { next: NoticeState; send: NoticeSend | null } {
  if (!active) {
    // Close out only an episode somebody was actually told about; a condition
    // that cleared before its threshold never needs a "resolved".
    const send: NoticeSend | null = prev.activeSince !== null && prev.sentCount > 0 ? "resolve" : null;
    return { next: INITIAL_NOTICE, send };
  }

  let since = prev.activeSince ?? now;
  if (observedSince !== null && Number.isFinite(observedSince) && observedSince < since) since = observedSince;
  const next: NoticeState = { ...prev, activeSince: since };

  if (suppressed) return { next, send: null };
  if (now - since < timing.thresholdMs) return { next, send: null };

  if (prev.lastSentAt === null) {
    return { next: { ...next, lastSentAt: now, sentCount: 1 }, send: "raise" };
  }
  if (now - prev.lastSentAt >= timing.reminderMs) {
    return { next: { ...next, lastSentAt: now, sentCount: prev.sentCount + 1 }, send: "remind" };
  }
  return { next, send: null };
}

/** When the next notice is due, for the modal. Null when nothing is pending. */
export function nextDueAt(s: NoticeState, timing: NoticeTiming): number | null {
  if (s.activeSince === null) return null;
  if (s.lastSentAt === null) return s.activeSince + timing.thresholdMs;
  return s.lastSentAt + timing.reminderMs;
}

/** Parse apt-check's "<all>;<security>" (it writes it to stderr). */
export function parseAptCheck(text: string): { all: number; security: number } | null {
  const m = text.trim().match(/(\d+);(\d+)\s*$/);
  if (!m) return null;
  return { all: Number(m[1]), security: Number(m[2]) };
}

/**
 * The reboot-required.pkgs file repeats a package once per kernel that wanted
 * the reboot (four `linux-base` lines on RCS, 2026-11-01). The notice lists
 * each once, kernels first.
 */
export function uniquePkgs(pkgs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of pkgs.map((x) => x.trim()).filter(Boolean)) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out.sort((a, b) => Number(b.startsWith("linux-image")) - Number(a.startsWith("linux-image")) || a.localeCompare(b));
}

/** "17 days", "5 hours", "40 minutes" — for the subject-adjacent sentence. */
export function ageText(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 90) return `${min} minute${min === 1 ? "" : "s"}`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}
