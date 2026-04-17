export const colors = {
  pink:   "#ff4ecb",
  cyan:   "#00bfff",
  gold:   "#f7b700",
  orange: "#d97757",
  violet: "#a78bfa",
  green:  "#4ade80",
  red:    "#ef4444",
} as const;

export const rgb = {
  pink:   "255,78,203",
  cyan:   "0,191,255",
  gold:   "247,183,0",
  orange: "217,119,87",
  violet: "167,139,250",
  green:  "74,222,128",
  red:    "239,68,68",
} as const;

export type GlowColor = keyof typeof colors;

export const dark = {
  bg:          "#0a0a0a",
  surface:     "rgba(6,8,12,0.99)",
  surfaceAlt:  "rgba(20,15,35,0.98)",
  text:        "#ededed",
  textMuted:   "rgba(255,255,255,0.55)",
  textFaint:   "rgba(255,255,255,0.35)",
  textGhost:   "rgba(255,255,255,0.20)",
  border:      "rgba(255,255,255,0.06)",
  borderStrong:"rgba(255,255,255,0.12)",
  inputBg:     "rgba(255,255,255,0.04)",
  overlay:     "rgba(0,0,0,0.75)",
  cardGrad:    "linear-gradient(180deg, rgba(20,15,35,0.98), rgba(8,6,16,0.98))",
} as const;

export const light = {
  bg:          "#f8f6f3",
  surface:     "rgba(255,255,255,0.98)",
  surfaceAlt:  "rgba(245,243,240,0.98)",
  text:        "#1a1a2e",
  textMuted:   "rgba(26,26,46,0.6)",
  textFaint:   "rgba(26,26,46,0.4)",
  textGhost:   "rgba(26,26,46,0.2)",
  border:      "rgba(0,0,0,0.06)",
  borderStrong:"rgba(0,0,0,0.12)",
  inputBg:     "rgba(0,0,0,0.03)",
  overlay:     "rgba(255,255,255,0.6)",
  cardGrad:    "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,243,240,0.98))",
} as const;

export type ThemeTokens = { [K in keyof typeof dark]: string };

export function t(token: keyof ThemeTokens): string {
  return `var(--t-${token})`;
}

export function glowRgba(color: GlowColor, alpha: number): string {
  return `rgba(${rgb[color]},${alpha})`;
}

export function glowShadow(color: GlowColor, spread = 40, alpha = 0.15): string {
  return `0 24px 80px rgba(0,0,0,0.7), 0 0 ${spread}px rgba(${rgb[color]},${alpha})`;
}

export function glowBorder(color: GlowColor, alpha = 0.25): string {
  return `1px solid rgba(${rgb[color]},${alpha})`;
}
