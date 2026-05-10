"use client";

// Standard US call-progress tones synthesized via Web Audio.
// Keeping synthesis client-side guarantees correct US cadence regardless of
// carrier early-media behavior, and starts audibly before any RTP arrives.

let ctx: AudioContext | null = null;
let ringbackTimer: ReturnType<typeof setTimeout> | null = null;
let ringbackActive = false;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function playToneBurst(
  freqs: number[],
  durationMs: number,
  gain = 0.12,
  attackMs = 5,
  releaseMs = 15,
): void {
  const c = ensureCtx();
  if (!c) return;
  const now = c.currentTime;
  const dur = durationMs / 1000;
  const attack = attackMs / 1000;
  const release = releaseMs / 1000;
  const master = c.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(gain, now + attack);
  master.gain.setValueAtTime(gain, now + Math.max(attack, dur - release));
  master.gain.linearRampToValueAtTime(0, now + dur);
  master.connect(c.destination);
  for (const f of freqs) {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    osc.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }
}

export function startRingback(): void {
  if (ringbackActive) return;
  ringbackActive = true;
  const tick = () => {
    if (!ringbackActive) return;
    playToneBurst([440, 480], 2000, 0.08, 20, 60);
    ringbackTimer = setTimeout(tick, 6000);
  };
  tick();
}

export function stopRingback(): void {
  ringbackActive = false;
  if (ringbackTimer) {
    clearTimeout(ringbackTimer);
    ringbackTimer = null;
  }
}

export function playBusy(): void {
  stopRingback();
  for (let i = 0; i < 4; i++) {
    setTimeout(() => playToneBurst([480, 620], 500, 0.1, 5, 25), i * 1000);
  }
}

export function playReorder(): void {
  stopRingback();
  for (let i = 0; i < 8; i++) {
    setTimeout(() => playToneBurst([480, 620], 250, 0.1, 5, 15), i * 500);
  }
}

export function playHangupClick(): void {
  stopRingback();
  playToneBurst([250], 45, 0.05, 2, 35);
}

const DTMF_FREQS: Record<string, [number, number]> = {
  "1": [697, 1209], "2": [697, 1336], "3": [697, 1477],
  "4": [770, 1209], "5": [770, 1336], "6": [770, 1477],
  "7": [852, 1209], "8": [852, 1336], "9": [852, 1477],
  "*": [941, 1209], "0": [941, 1336], "#": [941, 1477],
};

export function playDtmf(digit: string): void {
  const f = DTMF_FREQS[digit];
  if (!f) return;
  playToneBurst([f[0], f[1]], 120, 0.1, 3, 20);
}

// ── Inbound ringtone ──────────────────────────────────────────────
//
// Plays repeatedly until stopInboundRing() is called. Distinct from the
// outbound ringback tone — uses a richer pattern so it's instantly
// recognizable. Three preset profiles selectable via the Front Desk
// Settings modal; selection persists in localStorage.

export type RingProfile = "classic" | "chime" | "neon" | "soft";

const RING_PROFILES: Record<RingProfile, () => void> = {
  classic: () => {
    // North-American 2-second on / 4-second off cadence, but doubled-up.
    playToneBurst([440, 480], 1800, 0.12, 25, 80);
  },
  chime: () => {
    // Rising 3-tone arpeggio that loops every 2.5s.
    playToneBurst([523.25], 200, 0.12, 5, 30); // C5
    setTimeout(() => playToneBurst([659.25], 200, 0.12, 5, 30), 220); // E5
    setTimeout(() => playToneBurst([783.99], 600, 0.12, 5, 80), 440); // G5
  },
  neon: () => {
    // Synth-y pad with a perfect-fifth interval — TGV vibe.
    playToneBurst([330, 494], 1500, 0.1, 80, 200);
  },
  soft: () => {
    // Single soft 600 Hz pulse, gentler for quiet rooms.
    playToneBurst([600], 800, 0.08, 50, 120);
  },
};

let inboundActive = false;
let inboundTimer: ReturnType<typeof setTimeout> | null = null;

export function startInboundRing(profile: RingProfile = "classic"): void {
  if (inboundActive) return;
  inboundActive = true;
  const tick = () => {
    if (!inboundActive) return;
    (RING_PROFILES[profile] ?? RING_PROFILES.classic)();
    inboundTimer = setTimeout(tick, 2500);
  };
  tick();
}

export function stopInboundRing(): void {
  inboundActive = false;
  if (inboundTimer) {
    clearTimeout(inboundTimer);
    inboundTimer = null;
  }
}

export const RING_PROFILE_LABELS: Record<RingProfile, string> = {
  classic: "Classic (Bell)",
  chime: "Chime",
  neon: "Neon Pad",
  soft: "Soft Pulse",
};

export const RING_PROFILE_KEY = "frontdesk:ringtone-profile";
export const NOTIFICATIONS_ENABLED_KEY = "frontdesk:notifications-enabled";
