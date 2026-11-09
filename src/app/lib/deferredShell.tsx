"use client";

// Stack-efficiency P2: the Office shell's drawers (Front Desk, chat, forum,
// inbox, sessions, legend, terminal, call overlays) load AFTER hydration
// instead of in every page's first-load JS. Each one only listens for its
// window events once its chunk has arrived, so anything fired in that gap —
// a `?alert=` deep link, `?tile=` arrival, a fast click on a tile — would be
// lost. This module catches those events from the moment the shell is
// imported and replays them once, after every deferred piece has mounted.

import { useEffect, type ComponentType, type ReactNode } from "react";

const EVENTS = [
  "tgv-drawer-open",
  "tgv-drawer-tab",
  "tgv-call-accept",
  "frontdesk-dial-prefill",
  "frontdesk-sms-open",
] as const;

// Give up waiting after this long (a chunk that never arrives must not hold
// the buffer forever) and replay what we have.
const MAX_WAIT_MS = 15_000;

type Held = { type: string; detail: unknown };
const held: Held[] = [];
const expected = new Set<string>();
const mounted = new Set<string>();
let buffering = typeof window !== "undefined";
let replaying = false;
let timer: number | undefined;

function hold(e: Event) {
  if (!buffering || replaying) return;
  held.push({ type: e.type, detail: (e as CustomEvent).detail });
}

if (buffering) {
  EVENTS.forEach((t) => window.addEventListener(t, hold));
  timer = window.setTimeout(flush, MAX_WAIT_MS);
}

function flush() {
  if (!buffering) return;
  buffering = false;
  if (timer !== undefined) window.clearTimeout(timer);
  EVENTS.forEach((t) => window.removeEventListener(t, hold));
  // Static listeners already saw these once; every handler on this list is an
  // idempotent "open X" / "go to tab Y", so a second delivery is harmless.
  replaying = true;
  try {
    held.splice(0).forEach(({ type, detail }) =>
      window.dispatchEvent(new CustomEvent(type, { detail })),
    );
  } finally {
    replaying = false;
  }
}

function markMounted(id: string) {
  mounted.add(id);
  if (buffering && [...expected].every((k) => mounted.has(k))) flush();
}

/** Parent effects run after their children's, so by the time this fires the
 *  wrapped drawer has attached its listeners. */
function Ready({ id, children }: { id: string; children: ReactNode }) {
  useEffect(() => markMounted(id), [id]);
  return <>{children}</>;
}

/**
 * Wrap a dynamically-imported shell piece so it reports in when mounted.
 * `deferShellPiece("frontdesk", () => import("./FrontDeskDrawer").then(m => m.default))`
 * → hand the result to `next/dynamic`.
 */
export function deferShellPiece<P extends object>(
  id: string,
  load: () => Promise<ComponentType<P>>,
): () => Promise<ComponentType<P>> {
  expected.add(id);
  return () =>
    load().then((C) => {
      function Deferred(props: P) {
        return (
          <Ready id={id}>
            <C {...props} />
          </Ready>
        );
      }
      Deferred.displayName = `Deferred(${id})`;
      return Deferred;
    });
}
