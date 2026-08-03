/**
 * Box Usage Monitor — WHEN to raise an alert. Pure decision logic, no I/O, so
 * `node --test` runs it straight off the source alongside compute.ts.
 *
 * The hard part of a capacity alert is not detecting 90% — it is not sending
 * the same alert 288 times a day. Four rules, in order of how much noise each
 * one removes:
 *
 * 1. SUSTAIN. A level has to hold for `minStreak` consecutive samples before it
 *    counts. At a five-minute cadence, 3 is fifteen minutes — long enough that
 *    a backup job or a single build doesn't page anyone, short enough to be
 *    ahead of the problem.
 *
 * 2. EDGES, NOT STATES. Alerts fire on the way UP only. A box parked at 92%
 *    fires once; it doesn't re-fire every tick until someone fixes it. The
 *    Office tile is already red the whole time — the alert's job is to say
 *    "this just changed", not "this is still true".
 *
 * 3. RECOVERY CLEARS. Dropping back to ok (also sustained) fires one recovery
 *    notice and re-arms the alert, so the next crossing is heard. Without this,
 *    a box that flaps daily would alert exactly once, ever.
 *
 * 4. HYSTERESIS ON THE WAY DOWN. Recovery uses a margin below the warn line, so
 *    a box hovering at exactly 75% doesn't alternate ok/warn every five minutes
 *    and emit a matched pair of alerts each time.
 */

export type AlertLevel = "ok" | "warn" | "critical";

export type AlertState = {
  /** The level currently being observed (not necessarily alerted yet). */
  level: AlertLevel;
  /** How many consecutive samples have agreed on `level`. */
  streak: number;
  /** The highest level we have actually sent an alert for, until recovery. */
  firedLevel: AlertLevel | null;
  /** When that alert went out, ms epoch. */
  firedAt: number | null;
};

export type AlertDecision = {
  next: AlertState;
  /** Null when nothing should be sent this tick. */
  fire: {
    level: AlertLevel;
    /** "raise" on the way up; "recover" when it settles back to ok. */
    kind: "raise" | "recover";
  } | null;
};

export const INITIAL_ALERT_STATE: AlertState = {
  level: "ok",
  streak: 0,
  firedLevel: null,
  firedAt: null,
};

export const ALERT_DEFAULTS = {
  /** Consecutive agreeing samples before a level counts. */
  minStreak: 3,
  /**
   * How far below the warn line the box must fall to count as recovered.
   * Without it, 75.0% flapping either side of the line pages twice an hour.
   */
  recoveryMarginPct: 5,
  /**
   * Floor between two alerts for the SAME level. Only reachable after a
   * recovery, so this is a backstop against a pathological flap, not the main
   * defence — rule 2 is.
   */
  cooldownMs: 60 * 60_000,
} as const;

const RANK: Record<AlertLevel, number> = { ok: 0, warn: 1, critical: 2 };

/** Level of a reading against the configured bounds, with recovery hysteresis. */
export function levelFor(
  pct: number,
  warnPct: number,
  criticalPct: number,
  /** True when we're currently alerting — applies the downward margin. */
  alerting: boolean,
  recoveryMarginPct: number = ALERT_DEFAULTS.recoveryMarginPct,
): AlertLevel {
  if (pct >= criticalPct) return "critical";
  if (pct >= warnPct) return "warn";
  // On the way back down, stay in warn until it clears the line by the margin.
  if (alerting && pct > warnPct - recoveryMarginPct) return "warn";
  return "ok";
}

/**
 * Fold one reading into the state and say whether to send something.
 *
 * `now` is passed in rather than read, so the tests are deterministic and the
 * caller (which already has a sample timestamp) doesn't disagree with it.
 */
export function decideAlert(
  prev: AlertState,
  observed: AlertLevel,
  now: number,
  opts: {
    minStreak?: number;
    cooldownMs?: number;
  } = {},
): AlertDecision {
  const minStreak = opts.minStreak ?? ALERT_DEFAULTS.minStreak;
  const cooldownMs = opts.cooldownMs ?? ALERT_DEFAULTS.cooldownMs;

  const streak = observed === prev.level ? prev.streak + 1 : 1;
  const next: AlertState = { ...prev, level: observed, streak };

  if (streak < minStreak) return { next, fire: null };

  // Recovery: sustained ok after having alerted. Re-arms for the next crossing.
  if (observed === "ok") {
    if (prev.firedLevel === null) return { next, fire: null };
    return {
      next: { ...next, firedLevel: null, firedAt: now },
      fire: { level: "ok", kind: "recover" },
    };
  }

  const already = prev.firedLevel;

  // De-escalation (critical → warn) is good news, so it sends nothing — but the
  // ceiling drops so that going back up to critical is heard again.
  if (already !== null && RANK[observed] < RANK[already]) {
    return { next: { ...next, firedLevel: observed }, fire: null };
  }

  // Same level we already alerted for: silent, unless the cooldown has expired
  // (only reachable after a recovery cleared firedLevel, so effectively a
  // belt-and-braces guard).
  if (already !== null && RANK[observed] === RANK[already]) {
    if (prev.firedAt !== null && now - prev.firedAt < cooldownMs) {
      return { next, fire: null };
    }
    return { next: { ...next, firedAt: now }, fire: { level: observed, kind: "raise" } };
  }

  // New, or an escalation.
  return {
    next: { ...next, firedLevel: observed, firedAt: now },
    fire: { level: observed, kind: "raise" },
  };
}
