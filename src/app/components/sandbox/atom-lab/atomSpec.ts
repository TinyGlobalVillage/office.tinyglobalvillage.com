/**
 * Atom Lab spec model — the one "control atom" shape every atom in the lab is
 * driven by: canvas (the area the atom sits on), size (atom box as a ratio of
 * that canvas), colors, effects, and text (with sizes as ratios of the atom
 * box). Pure TS on purpose: imported by both the client view and the API
 * route, so no React/styled imports here. clampSpec() is the single
 * sanitizer for anything coming off disk or the wire.
 */

export type AtomSpec = {
  canvas: { width: number; height: number; bg: string; grid: boolean };
  /** Atom box as % of the canvas — "how big and small the atom gets". */
  size: { widthPct: number; heightPct: number };
  colors: {
    fill: string;
    fillAlpha: number;
    border: string;
    borderAlpha: number;
    text: string;
    accent: string;
  };
  effects: {
    radius: number;
    borderWidth: number;
    glow: number;
    shadow: number;
    opacity: number;
  };
  text: {
    enabled: boolean;
    content: string;
    /** "ratio" sizes the font as % of the atom box height; "px" is absolute. */
    mode: "ratio" | "px";
    ratio: number;
    px: number;
    weight: number;
    /** Letter-spacing in em. */
    tracking: number;
    uppercase: boolean;
  };
};

export type AtomSpecPatch = { [K in keyof AtomSpec]?: Partial<AtomSpec[K]> };

export const SPEC_LIMITS = {
  canvas: { width: [120, 1600], height: [80, 1000] },
  size: { widthPct: [4, 100], heightPct: [4, 100] },
  alpha: [0, 1],
  radius: [0, 200],
  borderWidth: [0, 12],
  glow: [0, 100],
  shadow: [0, 100],
  opacity: [0.1, 1],
  textRatio: [2, 90],
  textPx: [6, 200],
  weight: [100, 900],
  tracking: [0, 0.3],
  content: 80,
} as const;

export const DEFAULT_SPEC: AtomSpec = {
  canvas: { width: 480, height: 320, bg: "#0b0d13", grid: true },
  size: { widthPct: 34, heightPct: 16 },
  colors: {
    fill: "#141824",
    fillAlpha: 1,
    border: "#ff4ecb",
    borderAlpha: 0.55,
    text: "#f4f6ff",
    accent: "#ff4ecb",
  },
  effects: { radius: 12, borderWidth: 1, glow: 18, shadow: 12, opacity: 1 },
  text: {
    enabled: true,
    content: "Atom",
    mode: "ratio",
    ratio: 34,
    px: 14,
    weight: 700,
    tracking: 0.04,
    uppercase: false,
  },
};

export function mergeSpec(base: AtomSpec, patch: AtomSpecPatch): AtomSpec {
  return {
    canvas: { ...base.canvas, ...patch.canvas },
    size: { ...base.size, ...patch.size },
    colors: { ...base.colors, ...patch.colors },
    effects: { ...base.effects, ...patch.effects },
    text: { ...base.text, ...patch.text },
  };
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function num(v: unknown, min: number, max: number, fb: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fb;
  return Math.min(max, Math.max(min, n));
}
function hex(v: unknown, fb: string): string {
  return typeof v === "string" && HEX_RE.test(v) ? v : fb;
}
function bool(v: unknown, fb: boolean): boolean {
  return typeof v === "boolean" ? v : fb;
}
function str(v: unknown, fb: string, maxLen: number): string {
  return typeof v === "string" ? v.slice(0, maxLen) : fb;
}

/** Sanitize an untrusted spec (disk / wire) against a known-good base. */
export function clampSpec(raw: unknown, base: AtomSpec = DEFAULT_SPEC): AtomSpec {
  const r = (raw ?? {}) as Record<string, Record<string, unknown>>;
  const L = SPEC_LIMITS;
  const canvas = r.canvas ?? {};
  const size = r.size ?? {};
  const colors = r.colors ?? {};
  const effects = r.effects ?? {};
  const text = r.text ?? {};
  return {
    canvas: {
      width: num(canvas.width, L.canvas.width[0], L.canvas.width[1], base.canvas.width),
      height: num(canvas.height, L.canvas.height[0], L.canvas.height[1], base.canvas.height),
      bg: hex(canvas.bg, base.canvas.bg),
      grid: bool(canvas.grid, base.canvas.grid),
    },
    size: {
      widthPct: num(size.widthPct, L.size.widthPct[0], L.size.widthPct[1], base.size.widthPct),
      heightPct: num(size.heightPct, L.size.heightPct[0], L.size.heightPct[1], base.size.heightPct),
    },
    colors: {
      fill: hex(colors.fill, base.colors.fill),
      fillAlpha: num(colors.fillAlpha, L.alpha[0], L.alpha[1], base.colors.fillAlpha),
      border: hex(colors.border, base.colors.border),
      borderAlpha: num(colors.borderAlpha, L.alpha[0], L.alpha[1], base.colors.borderAlpha),
      text: hex(colors.text, base.colors.text),
      accent: hex(colors.accent, base.colors.accent),
    },
    effects: {
      radius: num(effects.radius, L.radius[0], L.radius[1], base.effects.radius),
      borderWidth: num(effects.borderWidth, L.borderWidth[0], L.borderWidth[1], base.effects.borderWidth),
      glow: num(effects.glow, L.glow[0], L.glow[1], base.effects.glow),
      shadow: num(effects.shadow, L.shadow[0], L.shadow[1], base.effects.shadow),
      opacity: num(effects.opacity, L.opacity[0], L.opacity[1], base.effects.opacity),
    },
    text: {
      enabled: bool(text.enabled, base.text.enabled),
      content: str(text.content, base.text.content, L.content),
      mode: text.mode === "px" ? "px" : text.mode === "ratio" ? "ratio" : base.text.mode,
      ratio: num(text.ratio, L.textRatio[0], L.textRatio[1], base.text.ratio),
      px: num(text.px, L.textPx[0], L.textPx[1], base.text.px),
      weight: Math.round(num(text.weight, L.weight[0], L.weight[1], base.text.weight) / 100) * 100,
      tracking: num(text.tracking, L.tracking[0], L.tracking[1], base.text.tracking),
      uppercase: bool(text.uppercase, base.text.uppercase),
    },
  };
}

/** "#ff4ecb" → "255, 78, 203" (3- and 6-digit hex). */
export function hexToRgbTriple(h: string): string {
  const m = HEX_RE.test(h) ? h.slice(1) : "ffffff";
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
