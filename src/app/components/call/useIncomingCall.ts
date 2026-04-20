"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RingChannel = {
  type: "dm" | "group" | "session";
  id: string;
  name: string;
};

export type RingPayload = {
  from: { id: string; name: string; avatar?: string | null };
  channel: RingChannel;
  startedAt: string;
};

export type IncomingCall = {
  ring: RingPayload | null;
  reject: () => void;
  acceptSwitch: () => void;
  acceptNotify: () => void;
};

const POLL_MS = 2000;

export function useIncomingCall(opts?: {
  /** Called after acceptSwitch to hand the caller-selected channel back to the consuming drawer. */
  onJoinActive?: (channel: RingChannel) => void;
  /** Called after acceptNotify — join the new channel in observer mode. */
  onJoinObserver?: (channel: RingChannel) => void;
}): IncomingCall {
  const [ring, setRing] = useState<RingPayload | null>(null);
  const timer = useRef<number | null>(null);
  const active = useRef(true);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/ring?for=me", { cache: "no-store" });
      if (!active.current) return;
      if (!res.ok) {
        setRing(null);
        return;
      }
      const data = (await res.json()) as { ring: RingPayload | null };
      if (!active.current) return;
      setRing(data.ring ?? null);
    } catch {
      if (active.current) setRing(null);
    }
  }, []);

  useEffect(() => {
    active.current = true;
    poll();
    timer.current = window.setInterval(poll, POLL_MS);
    return () => {
      active.current = false;
      if (timer.current != null) window.clearInterval(timer.current);
    };
  }, [poll]);

  const reject = useCallback(async () => {
    if (!ring) return;
    const snapshot = ring;
    setRing(null);
    await fetch("/api/chat/ring", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", channel: snapshot.channel, from: snapshot.from.id }),
    }).catch(() => {});
  }, [ring]);

  const acceptSwitch = useCallback(async () => {
    if (!ring) return;
    const snapshot = ring;
    setRing(null);
    await fetch("/api/chat/ring", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", channel: snapshot.channel, from: snapshot.from.id }),
    }).catch(() => {});
    opts?.onJoinActive?.(snapshot.channel);
  }, [ring, opts]);

  const acceptNotify = useCallback(async () => {
    if (!ring) return;
    const snapshot = ring;
    setRing(null);
    await fetch("/api/chat/ring", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept-notify", channel: snapshot.channel, from: snapshot.from.id }),
    }).catch(() => {});
    opts?.onJoinObserver?.(snapshot.channel);
  }, [ring, opts]);

  return { ring, reject, acceptSwitch, acceptNotify };
}

export default useIncomingCall;
