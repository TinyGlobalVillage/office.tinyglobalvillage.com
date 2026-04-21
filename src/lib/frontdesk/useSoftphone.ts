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
    const off = onEvent((ev) => {
      if (ev.kind === "status") setStatus(ev.status);
      else if (ev.kind === "call-state") {
        const prev = lastCallStateRef.current;
        if (ev.state === "establishing" && ev.direction === "outbound") {
          startRingback();
        } else if (ev.state === "established") {
          stopRingback();
        } else if (ev.state === "terminated") {
          stopRingback();
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
      } else if (ev.kind === "error") {
        setLastError(ev.detail);
      }
    });
    return () => {
      cancelled = true;
      off();
      stopRingback();
      unregisterSoftphone().catch(() => {});
    };
  }, []);

  const dial = useCallback((target: string, fromCid?: string) => invite(target, fromCid), []);
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
