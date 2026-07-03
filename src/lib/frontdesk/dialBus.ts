"use client";

/**
 * One-shot handoff for cross-tab intents inside the Front Desk drawer.
 *
 * Drawer tabs are conditionally MOUNTED ({activeTab === "phone" && <PhoneTab/>}),
 * so a CustomEvent dispatched from another tab (Contacts → "Call") fires
 * before the target tab exists and its payload is lost. Dispatchers store
 * the intent here as well; the target tab consumes it on mount. The live
 * CustomEvent path still covers the already-mounted case — event handlers
 * must ALSO consume (clear) the pending intent so it can't re-fire on a
 * later mount. Intents expire after a few seconds so a stale one can never
 * place a call minutes later.
 */

export type DialIntent = { to: string; autoDial?: boolean };
export type SmsIntent = { peer: string };

const TTL_MS = 5_000;

let pendingDial: { intent: DialIntent; at: number } | null = null;
let pendingSms: { intent: SmsIntent; at: number } | null = null;

export function setPendingDial(intent: DialIntent): void {
  pendingDial = { intent, at: Date.now() };
}

export function consumePendingDial(): DialIntent | null {
  const p = pendingDial;
  pendingDial = null;
  return p && Date.now() - p.at <= TTL_MS ? p.intent : null;
}

export function setPendingSms(intent: SmsIntent): void {
  pendingSms = { intent, at: Date.now() };
}

export function consumePendingSms(): SmsIntent | null {
  const p = pendingSms;
  pendingSms = null;
  return p && Date.now() - p.at <= TTL_MS ? p.intent : null;
}
