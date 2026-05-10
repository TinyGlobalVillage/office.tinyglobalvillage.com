"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  initSoftphone,
  registerSoftphone,
  unregisterSoftphone,
  invite,
  hangupCurrent,
  acceptIncoming,
  sendDtmf,
  onEvent,
  getSoftphoneStatus,
  type SoftphoneStatus,
  type CallState,
  type CallDirection,
} from "./softphone";
import {
  startRingback,
  stopRingback,
  playReorder,
  playHangupClick,
  startInboundRing,
  stopInboundRing,
  RING_PROFILE_KEY,
  NOTIFICATIONS_ENABLED_KEY,
  type RingProfile,
} from "./ringTones";

export type IncomingInfo = { from: string; displayName: string };

export function useSoftphone() {
  const [status, setStatus] = useState<SoftphoneStatus>(getSoftphoneStatus());
  const [callState, setCallState] = useState<CallState>("initial");
  const [callDirection, setCallDirection] = useState<CallDirection | null>(null);
  const [incoming, setIncoming] = useState<IncomingInfo | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const lastCallStateRef = useRef<CallState>("initial");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initSoftphone();
      if (cancelled) return;
      await registerSoftphone();
    })();
    const notificationRef: { current: Notification | null } = { current: null };
    const off = onEvent((ev) => {
      if (ev.kind === "status") setStatus(ev.status);
      else if (ev.kind === "call-state") {
        const prev = lastCallStateRef.current;
        if (ev.state === "establishing" && ev.direction === "outbound") {
          startRingback();
        } else if (ev.state === "established") {
          stopRingback();
          stopInboundRing();
          notificationRef.current?.close();
          notificationRef.current = null;
        } else if (ev.state === "terminated") {
          stopRingback();
          stopInboundRing();
          notificationRef.current?.close();
          notificationRef.current = null;
          if (prev === "established") playHangupClick();
          else if (prev === "establishing" && ev.direction === "outbound") playReorder();
        }
        lastCallStateRef.current = ev.state;
        setCallState(ev.state);
        setCallDirection(ev.direction);
        if (ev.state === "terminated") {
          setIncoming(null);
          setCallDirection(null);
        }
      } else if (ev.kind === "incoming") {
        setIncoming({ from: ev.from, displayName: ev.displayName });
        // Audible ring (uses user's saved profile or 'classic' default).
        const profile = (typeof window !== "undefined"
          ? (window.localStorage.getItem(RING_PROFILE_KEY) as RingProfile | null)
          : null) ?? "classic";
        startInboundRing(profile);
        // Browser notification — gated on user opting in via the Front Desk
        // settings modal (which calls Notification.requestPermission()).
        try {
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted" &&
            window.localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) !== "false"
          ) {
            notificationRef.current = new Notification("📞 Incoming call", {
              body: `${ev.displayName || ev.from}`,
              tag: "frontdesk-incoming",
              requireInteraction: true,
            });
            notificationRef.current.onclick = () => {
              window.focus();
              notificationRef.current?.close();
              notificationRef.current = null;
            };
          }
        } catch {
          /* notifications best-effort */
        }
      } else if (ev.kind === "error") {
        setLastError(ev.detail);
      }
    });
    return () => {
      cancelled = true;
      off();
      stopRingback();
      stopInboundRing();
      notificationRef.current?.close();
      unregisterSoftphone().catch(() => {});
    };
  }, []);

  const dial = useCallback(
    (target: string, fromCid?: string, record: boolean = true) => invite(target, fromCid, record),
    [],
  );
  const hangup = useCallback(() => hangupCurrent(), []);
  const accept = useCallback(() => acceptIncoming(), []);
  const dtmf = useCallback((digit: string) => sendDtmf(digit), []);

  return {
    status,
    callState,
    callDirection,
    incoming,
    lastError,
    dial,
    hangup,
    accept,
    dtmf,
  };
}
