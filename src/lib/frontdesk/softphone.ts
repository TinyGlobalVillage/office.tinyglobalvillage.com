"use client";

// Browser-side SIP.js wrapper. Registers against the sovereign FreeSWITCH
// WS profile via nginx /sip-ws TLS proxy. One UserAgent per browser tab.
//
// Public API:
//   initSoftphone()      — create + start the UserAgent (idempotent)
//   registerSoftphone()  — REGISTER with FS (auto-renew on expiry)
//   invite(target)       — place an outbound call, returns handle
//   hangupCurrent()      — terminate the active session
//   sendDtmf(digit)      — RFC 4733 DTMF on the active session
//   onEvent(cb)          — subscribe to status changes
//
// Media sink: softphone.ts appends a hidden <audio autoplay> element to
// document.body the first time audio arrives, so the tab produces sound
// without any per-component plumbing.

import {
  UserAgent,
  Registerer,
  Inviter,
  SessionState,
  type Session,
  type Invitation,
  type URI,
} from "sip.js";
import { stopRingback } from "./ringTones";

export type SoftphoneStatus =
  | "idle"
  | "connecting"
  | "registered"
  | "registering"
  | "unregistered"
  | "failed";

export type CallDirection = "inbound" | "outbound";

export type CallState =
  | "initial"
  | "establishing"
  | "established"
  | "terminated";

export type SoftphoneEvent =
  | { kind: "status"; status: SoftphoneStatus; detail?: string }
  | { kind: "incoming"; from: string; displayName: string; session: Invitation }
  | { kind: "call-state"; state: CallState; direction: CallDirection }
  | { kind: "error"; detail: string };

type Listener = (event: SoftphoneEvent) => void;

type SoftphoneConfig = {
  wsUrl: string;
  domain: string;
  user: string;
  password: string;
  displayName: string;
};

let ua: UserAgent | null = null;
let registerer: Registerer | null = null;
let currentSession: Session | null = null;
let audioSink: HTMLAudioElement | null = null;
let status: SoftphoneStatus = "idle";
const listeners = new Set<Listener>();

function emit(event: SoftphoneEvent) {
  for (const cb of listeners) {
    try { cb(event); } catch { /* swallow */ }
  }
}

function setStatus(next: SoftphoneStatus, detail?: string) {
  status = next;
  emit({ kind: "status", status: next, detail });
}

function ensureAudioSink(): HTMLAudioElement {
  if (audioSink) return audioSink;
  const el = document.createElement("audio");
  el.autoplay = true;
  el.hidden = true;
  document.body.appendChild(el);
  audioSink = el;
  return el;
}

function attachMedia(session: Session) {
  const sdh = session.sessionDescriptionHandler as unknown as {
    peerConnection?: RTCPeerConnection;
  } | undefined;
  const pc = sdh?.peerConnection;
  if (!pc) return;
  const sink = ensureAudioSink();
  const stream = new MediaStream();
  const hasExistingTrack = pc.getReceivers().some((r) => !!r.track);
  pc.getReceivers().forEach((r) => {
    if (r.track) stream.addTrack(r.track);
  });
  if (hasExistingTrack) stopRingback();
  pc.addEventListener("track", (ev) => {
    stream.addTrack(ev.track);
    sink.srcObject = stream;
    // Early media is now flowing — kill any synthesized ringback so we
    // don't overlay our 440+480Hz on top of carrier-supplied busy/tones.
    stopRingback();
  });
  sink.srcObject = stream;
}

function wireSession(session: Session, direction: CallDirection) {
  let mediaAttached = false;
  const tryAttach = () => {
    if (mediaAttached) return;
    const sdh = session.sessionDescriptionHandler as unknown as {
      peerConnection?: RTCPeerConnection;
    } | undefined;
    if (!sdh?.peerConnection) return;
    mediaAttached = true;
    attachMedia(session);
  };
  session.stateChange.addListener((state: SessionState) => {
    switch (state) {
      case SessionState.Establishing:
        emit({ kind: "call-state", state: "establishing", direction });
        // Early-media SDP may arrive with 183; attach ASAP to play it.
        setTimeout(tryAttach, 0);
        break;
      case SessionState.Established:
        tryAttach();
        emit({ kind: "call-state", state: "established", direction });
        break;
      case SessionState.Terminated:
        if (currentSession === session) currentSession = null;
        emit({ kind: "call-state", state: "terminated", direction });
        break;
    }
  });
}

function readConfig(): SoftphoneConfig | null {
  const wsUrl = process.env.NEXT_PUBLIC_SIP_WS_URL;
  const domain = process.env.NEXT_PUBLIC_SIP_DOMAIN;
  const user = process.env.NEXT_PUBLIC_SIP_USER;
  const password = process.env.NEXT_PUBLIC_SIP_PASSWORD;
  const displayName = process.env.NEXT_PUBLIC_SIP_DISPLAY_NAME ?? "TGV Front Desk";
  if (!wsUrl || !domain || !user || !password) return null;
  return { wsUrl, domain, user, password, displayName };
}

export function getSoftphoneStatus(): SoftphoneStatus {
  return status;
}

export function onEvent(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function initSoftphone(): Promise<void> {
  if (ua) return;
  const cfg = readConfig();
  if (!cfg) {
    setStatus("failed", "NEXT_PUBLIC_SIP_* env vars not set");
    return;
  }

  const uri = UserAgent.makeURI(`sip:${cfg.user}@${cfg.domain}`);
  if (!uri) {
    setStatus("failed", "invalid SIP URI");
    return;
  }

  setStatus("connecting");
  ua = new UserAgent({
    uri,
    authorizationUsername: cfg.user,
    authorizationPassword: cfg.password,
    displayName: cfg.displayName,
    transportOptions: {
      server: cfg.wsUrl,
      traceSip: false,
    },
    logBuiltinEnabled: false,
    sessionDescriptionHandlerFactoryOptions: {
      constraints: { audio: true, video: false },
      peerConnectionConfiguration: {
        // Sovereign STUN via LiveKit's embedded Pion STUN on the same box.
        // Browser needs this to learn its srflx (public) candidate — without
        // it, only LAN IPs get offered and FreeSWITCH's answer-side ICE
        // check fails with "no suitable candidates found" → cause 88.
        iceServers: [
          // Direct IP — office.tinyglobalvillage.com is Cloudflare-proxied
          // (HTTP/HTTPS only), so STUN/UDP never reaches the RCS box via the
          // name. TODO: add a non-proxied DNS record (e.g. stun.tgv) pointing
          // at this IP and swap back to a hostname.
          { urls: "stun:65.181.112.63:3478" },
        ],
      },
    },
    delegate: {
      onInvite: (invitation: Invitation) => {
        currentSession = invitation;
        wireSession(invitation, "inbound");
        const from = invitation.remoteIdentity?.uri?.user ?? "unknown";
        const displayName = invitation.remoteIdentity?.displayName ?? from;
        emit({ kind: "incoming", from, displayName, session: invitation });
      },
    },
  });

  try {
    await ua.start();
  } catch (err) {
    setStatus("failed", (err as Error).message);
    ua = null;
    return;
  }

  registerer = new Registerer(ua, { expires: 300 });
  registerer.stateChange.addListener((s) => {
    if (s === "Registered") setStatus("registered");
    else if (s === "Unregistered") setStatus("unregistered");
    else if (s === "Terminated") setStatus("idle");
  });
}

export async function registerSoftphone(): Promise<void> {
  if (!ua || !registerer) await initSoftphone();
  if (!registerer) return;
  setStatus("registering");
  try {
    await registerer.register();
  } catch (err) {
    setStatus("failed", (err as Error).message);
  }
}

export async function unregisterSoftphone(): Promise<void> {
  if (!registerer) return;
  try { await registerer.unregister(); } catch { /* ignore */ }
}

export async function invite(target: string, fromCid?: string): Promise<void> {
  if (!ua) {
    emit({ kind: "error", detail: "softphone not initialized" });
    return;
  }
  const cfg = readConfig();
  if (!cfg) return;
  const targetUri: URI | undefined = UserAgent.makeURI(`sip:${target}@${cfg.domain}`);
  if (!targetUri) {
    emit({ kind: "error", detail: `invalid target ${target}` });
    return;
  }
  const inviter = new Inviter(ua, targetUri, {
    sessionDescriptionHandlerOptions: {
      constraints: { audio: true, video: false },
    },
    extraHeaders: fromCid ? [`X-CID: ${fromCid}`] : [],
  });
  currentSession = inviter;
  wireSession(inviter, "outbound");
  try {
    await inviter.invite();
  } catch (err) {
    emit({ kind: "error", detail: (err as Error).message });
  }
}

export async function hangupCurrent(): Promise<void> {
  const s = currentSession;
  if (!s) return;
  try {
    switch (s.state) {
      case SessionState.Initial:
      case SessionState.Establishing:
        if ("cancel" in s && typeof (s as Inviter).cancel === "function") {
          await (s as Inviter).cancel();
        } else if ("reject" in s && typeof (s as Invitation).reject === "function") {
          await (s as Invitation).reject();
        }
        break;
      case SessionState.Established:
        await s.bye();
        break;
    }
  } catch { /* ignore */ }
  currentSession = null;
}

export async function acceptIncoming(): Promise<void> {
  const s = currentSession;
  if (!s || !("accept" in s)) return;
  try {
    await (s as Invitation).accept({
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false },
      },
    });
  } catch (err) {
    emit({ kind: "error", detail: (err as Error).message });
  }
}

export async function sendDtmf(digit: string): Promise<void> {
  const s = currentSession;
  if (!s || s.state !== SessionState.Established) return;
  try {
    const sdh = s.sessionDescriptionHandler as unknown as {
      sendDtmf?: (tones: string) => boolean;
    } | undefined;
    sdh?.sendDtmf?.(digit);
  } catch { /* ignore */ }
}
