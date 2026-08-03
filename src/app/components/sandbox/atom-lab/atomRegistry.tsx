"use client";
/**
 * Atom Lab registry — every SOLITARY atom in the ecosystem.
 *
 * Composition law (Gio 2026-08-02): an atom is one indivisible unit; anything
 * made of two or more atoms is a COMPONENT and belongs in the Components
 * column, not here. That is why DDM, PillBar, ADDM, SBDM, SRT, TSG and the
 * drawers are absent — they are groups, built in the Component Composer.
 *
 * Every renderer is a spec-driven silhouette: EVERY visual decision (size,
 * colors, effects, text, icon) comes off the AtomSpec so the Atomic Editor
 * controls all of it live. Atoms deliberately re-draw their vocabulary shape
 * here rather than importing the shipped component — the shipped ones hardcode
 * their styling, and the whole point is that nothing is pinned.
 *
 * Canon: ~/.claude/vocabulary/Atom.md · AtomLibrary.md · AtomSpec.md
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import {
  type AtomSpec,
  type AtomSpecPatch,
  type IconSpec,
  DEFAULT_SPEC,
  mergeSpec,
  hexToRgbTriple,
} from "./atomSpec";
import { SVG_MANIFEST } from "../../svg-lab/manifest.generated";
import { sanitizeSvgMarkup } from "../../svg-lab/svgModel";

export const ATOM_GROUP_NAMES = ["Surfaces", "Controls", "Toggles", "Text & Icons"] as const;
export type AtomGroup = (typeof ATOM_GROUP_NAMES)[number];

export type AtomBox = { w: number; h: number };
export type AtomRenderProps = { spec: AtomSpec; box: AtomBox };

export type AtomDef = {
  key: string;
  name: string;
  group: AtomGroup;
  blurb: string;
  defaults: AtomSpec;
  /** Renderer draws an SVG → the editor grows its Icon (SVG) section. */
  hasIcon?: boolean;
  Render: React.FC<AtomRenderProps>;
};

export const ATOM_GROUPS = ATOM_GROUP_NAMES;

// ── Spec → style helpers ────────────────────────────────────────────────

function shadowStack(spec: AtomSpec): string {
  const acc = hexToRgbTriple(spec.colors.accent);
  const parts: string[] = [];
  const { glow, shadow } = spec.effects;
  if (glow > 0) {
    parts.push(`0 0 ${Math.round(glow * 0.6)}px rgba(${acc}, ${(0.2 + glow * 0.006).toFixed(2)})`);
    if (glow > 40) parts.push(`inset 0 0 ${Math.round(glow * 0.25)}px rgba(${acc}, 0.14)`);
  }
  if (shadow > 0) {
    parts.push(`0 ${Math.round(shadow * 0.2)}px ${Math.round(shadow * 0.55)}px rgba(0, 0, 0, ${(0.18 + shadow * 0.004).toFixed(2)})`);
  }
  return parts.join(", ") || "none";
}

/** The atom's surface box — bg/border/radius/glow/shadow/opacity off the spec. */
export function surfaceStyle(spec: AtomSpec, box: AtomBox): React.CSSProperties {
  const { colors, effects } = spec;
  return {
    width: box.w,
    height: box.h,
    background: `rgba(${hexToRgbTriple(colors.fill)}, ${colors.fillAlpha})`,
    border: `${effects.borderWidth}px solid rgba(${hexToRgbTriple(colors.border)}, ${colors.borderAlpha})`,
    borderRadius: effects.radius,
    boxShadow: shadowStack(spec),
    opacity: effects.opacity,
    color: colors.text,
  };
}

export function fontPx(spec: AtomSpec, box: AtomBox): number {
  return spec.text.mode === "ratio"
    ? Math.max(6, Math.round(box.h * (spec.text.ratio / 100)))
    : spec.text.px;
}

export function textStyle(spec: AtomSpec, box: AtomBox): React.CSSProperties {
  return {
    fontSize: fontPx(spec, box),
    fontWeight: spec.text.weight,
    letterSpacing: `${spec.text.tracking}em`,
    textTransform: spec.text.uppercase ? "uppercase" : "none",
    color: spec.colors.text,
    lineHeight: 1.15,
    whiteSpace: "nowrap",
  };
}

const Center = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const HoverLift = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-family: inherit;
  transition: filter 0.15s ease, transform 0.15s ease;
  &:hover {
    filter: brightness(1.18);
  }
  &:active {
    transform: scale(0.97);
  }
`;

// ── Basic atoms ─────────────────────────────────────────────────────────

function BoxAtom({ spec, box }: AtomRenderProps) {
  return (
    <Center as="div" style={surfaceStyle(spec, box)}>
      {spec.text.enabled && <span style={textStyle(spec, box)}>{spec.text.content}</span>}
    </Center>
  );
}

/** Leading icon for atoms that can carry one — nothing unless icon.enabled. */
function LeadIcon({ spec, box }: AtomRenderProps) {
  if (!spec.icon.enabled) return null;
  return <SpecIcon spec={spec} size={Math.max(8, box.h * (spec.icon.sizePct / 100) * 0.62)} />;
}

function ButtonAtom({ spec, box }: AtomRenderProps) {
  return (
    <HoverLift
      type="button"
      style={{ ...surfaceStyle(spec, box), gap: Math.round(box.h * 0.16), position: "relative" }}
    >
      <LeadIcon spec={spec} box={box} />
      {spec.text.enabled && <span style={textStyle(spec, box)}>{spec.text.content}</span>}
    </HoverLift>
  );
}

function TextAtom({ spec, box }: AtomRenderProps) {
  return (
    <Center style={{ ...surfaceStyle(spec, box), overflow: "visible" }}>
      <span style={{ ...textStyle(spec, box), whiteSpace: "normal", textAlign: "center" }}>
        {spec.text.content || "Text"}
      </span>
    </Center>
  );
}

/** The four-point spark used when no manifest icon is picked. */
const BUILTIN_GLYPH =
  '<svg viewBox="0 0 24 24"><path d="M12 2 L14.6 9.4 L22 12 L14.6 14.6 L12 22 L9.4 14.6 L2 12 L9.4 9.4 Z" /></svg>';

/**
 * Renders the spec's icon: the built-in glyph, or any SVG_MANIFEST entry
 * serialized once from a hidden mount (the SVG Lab's trick — icon components
 * stay untouched, we paint a serialized copy) and re-painted from the IconSpec
 * on every edit.
 */
export function SpecIcon({ spec, size }: { spec: AtomSpec; size: number }) {
  const icon: IconSpec = spec.icon;
  const variantId = icon.source.startsWith("variant:") ? icon.source.slice(8) : null;
  const entry = useMemo(
    () =>
      icon.source && !variantId
        ? SVG_MANIFEST.find((e) => e.key === icon.source) ?? null
        : null,
    [icon.source, variantId],
  );
  const captureRef = useRef<HTMLSpanElement | null>(null);
  const [markup, setMarkup] = useState<string>(BUILTIN_GLYPH);

  useEffect(() => {
    if (variantId) return; // fetched by the effect below
    if (!entry) {
      setMarkup(BUILTIN_GLYPH);
      return;
    }
    const el = captureRef.current?.querySelector("svg");
    if (el) setMarkup(sanitizeSvgMarkup(el.outerHTML));
  }, [entry, variantId]);

  // Saved SVG Lab variants live server-side — fetch the markup for variant:<id>.
  useEffect(() => {
    if (!variantId) return;
    let alive = true;
    fetch("/api/svg-lab/variants")
      .then((r) => (r.ok ? r.json() : { variants: [] }))
      .then((d: { variants?: Array<{ id: string; svg: string }> }) => {
        if (!alive) return;
        const v = d.variants?.find((x) => x.id === variantId);
        setMarkup(v ? sanitizeSvgMarkup(v.svg) : BUILTIN_GLYPH);
      })
      .catch(() => {
        if (alive) setMarkup(BUILTIN_GLYPH);
      });
    return () => {
      alive = false;
    };
  }, [variantId]);

  const acc = spec.colors.accent;
  const fill =
    icon.fillMode === "none"
      ? "none"
      : `rgba(${hexToRgbTriple(icon.fillMode === "accent" ? acc : icon.fill)}, ${icon.fillAlpha})`;
  const stroke =
    icon.strokeMode === "none"
      ? "none"
      : `rgba(${hexToRgbTriple(icon.strokeMode === "accent" ? acc : icon.stroke)}, ${icon.strokeAlpha})`;
  const glowRgb = hexToRgbTriple(
    icon.strokeMode === "accent" || icon.fillMode === "accent" ? acc : icon.stroke,
  );
  const filters = [
    icon.glow > 0 ? `drop-shadow(0 0 ${Math.round(icon.glow * 0.3)}px rgba(${glowRgb}, 0.85))` : "",
    icon.blur > 0 ? `blur(${(icon.blur * 0.4).toFixed(2)}px)` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // The serialized markup carries its own viewBox + geometry; the children go
  // into a fresh <svg> so the paint attributes cascade onto every path.
  const inner = markup.replace(/^<svg[^>]*>/i, "").replace(/<\/svg\s*>$/i, "");
  const vb = /viewBox\s*=\s*["']([^"']+)["']/i.exec(markup)?.[1] ?? "0 0 24 24";

  return (
    <>
      {entry && (
        <span
          ref={captureRef}
          aria-hidden
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", opacity: 0 }}
        >
          <entry.Comp />
        </span>
      )}
      <svg
        width={size}
        height={size}
        viewBox={vb}
        fill={fill}
        stroke={stroke}
        strokeWidth={icon.strokeWidth}
        strokeLinecap={icon.linecap}
        strokeLinejoin={icon.linejoin}
        strokeDasharray={icon.dash > 0 ? `${icon.dash} ${icon.dashGap}` : undefined}
        strokeDashoffset={icon.dash > 0 ? icon.dashOffset : undefined}
        style={{
          filter: filters || undefined,
          opacity: icon.opacity,
          // Variants can carry currentColor; resolve it to the icon's paint.
          color: icon.strokeMode === "none" ? undefined : stroke,
          transform: [
            `translate(${icon.offsetX}%, ${icon.offsetY}%)`,
            `rotate(${icon.rotate}deg)`,
            `scale(${icon.scale * (icon.flipX ? -1 : 1)}, ${icon.scale * (icon.flipY ? -1 : 1)})`,
          ].join(" "),
          overflow: "visible",
        }}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: inner }}
      />
    </>
  );
}

function IconAtom({ spec, box }: AtomRenderProps) {
  const s = Math.max(10, Math.min(box.w, box.h) * (spec.icon.sizePct / 100));
  return (
    <Center style={{ ...surfaceStyle(spec, box), overflow: "visible", position: "relative" }}>
      <SpecIcon spec={spec} size={s} />
    </Center>
  );
}

function InputAtom({ spec, box }: AtomRenderProps) {
  const f = fontPx(spec, box);
  return (
    <input
      type="text"
      placeholder={spec.text.enabled ? spec.text.content : ""}
      style={{
        ...surfaceStyle(spec, box),
        padding: `0 ${Math.max(8, Math.round(box.h * 0.25))}px`,
        fontSize: f,
        fontWeight: spec.text.weight,
        letterSpacing: `${spec.text.tracking}em`,
        fontFamily: "inherit",
        outline: "none",
      }}
    />
  );
}

function PillAtom({ spec, box }: AtomRenderProps) {
  return (
    <Center style={{ ...surfaceStyle(spec, box), gap: Math.round(box.h * 0.18), position: "relative" }}>
      <LeadIcon spec={spec} box={box} />
      {spec.text.enabled && (
        <span style={{ ...textStyle(spec, box), color: spec.colors.accent }}>
          {spec.text.content}
        </span>
      )}
    </Center>
  );
}

function LightswitchAtom({ spec, box }: AtomRenderProps) {
  const [on, setOn] = useState(true);
  const acc = spec.colors.accent;
  const accRgb = hexToRgbTriple(acc);
  const h = box.h;
  const ball = Math.max(10, Math.round(h * 0.42));
  const stickH = Math.max(8, Math.round(h * 0.4));
  return (
    <Center style={{ ...surfaceStyle(spec, box), background: "transparent", border: "none", boxShadow: "none" }}>
      <HoverLift
        type="button"
        onClick={() => setOn((v) => !v)}
        aria-pressed={on}
        style={{
          background: "transparent",
          border: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
          transition: "transform 0.2s ease",
          transform: on ? "none" : "rotate(180deg)",
        }}
      >
        <span
          style={{
            width: ball,
            height: ball,
            borderRadius: "50%",
            background: on
              ? `radial-gradient(circle at 32% 30%, rgba(255,255,255,0.85), rgba(${accRgb}, 1) 55%)`
              : `rgba(${hexToRgbTriple(spec.colors.fill)}, 1)`,
            border: `${Math.max(1, spec.effects.borderWidth)}px solid rgba(${accRgb}, ${on ? 0.9 : 0.45})`,
            boxShadow: on ? `0 0 ${Math.round(spec.effects.glow * 0.4 + 4)}px rgba(${accRgb}, 0.7)` : "none",
          }}
        />
        <span
          style={{
            width: Math.max(2, Math.round(spec.effects.borderWidth * 1.5)),
            height: stickH,
            background: `rgba(${accRgb}, ${on ? 0.8 : 0.4})`,
            borderRadius: 2,
          }}
        />
      </HoverLift>
    </Center>
  );
}

function TooltipAtom({ spec, box }: AtomRenderProps) {
  const acc = spec.colors.accent;
  const accRgb = hexToRgbTriple(acc);
  const f = fontPx(spec, box);
  const bubbleH = Math.round(box.h * 0.42);
  return (
    <div
      style={{
        width: box.w,
        height: box.h,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: Math.round(box.h * 0.14),
        opacity: spec.effects.opacity,
      }}
    >
      <div style={{ position: "relative" }}>
        <div
          style={{
            padding: `${Math.round(bubbleH * 0.22)}px ${Math.round(bubbleH * 0.5)}px`,
            background: `linear-gradient(160deg, rgba(${hexToRgbTriple(spec.colors.fill)}, ${spec.colors.fillAlpha}), rgba(13, 11, 22, 0.96))`,
            border: `${spec.effects.borderWidth}px solid rgba(${accRgb}, ${spec.colors.borderAlpha})`,
            borderRadius: spec.effects.radius,
            boxShadow: shadowStack(spec),
            fontSize: Math.max(8, Math.round(f * 0.8)),
            fontWeight: spec.text.weight,
            letterSpacing: `${Math.max(spec.text.tracking, 0.06)}em`,
            textTransform: "uppercase",
            color: spec.colors.text,
            whiteSpace: "nowrap",
          }}
        >
          {spec.text.enabled ? spec.text.content : "Tooltip"}
        </div>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            bottom: -6,
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: `6px solid rgba(${accRgb}, ${spec.colors.borderAlpha})`,
          }}
        />
      </div>
      <div
        style={{
          padding: "4px 12px",
          borderRadius: 8,
          border: `1px dashed rgba(${accRgb}, 0.4)`,
          color: `rgba(${accRgb}, 0.75)`,
          fontSize: Math.max(8, Math.round(f * 0.7)),
          fontWeight: 600,
        }}
      >
        hover target
      </div>
    </div>
  );
}

function NeonButtonAtom({ spec, box }: AtomRenderProps) {
  const acc = spec.colors.accent;
  const accRgb = hexToRgbTriple(acc);
  return (
    <HoverLift
      type="button"
      style={{
        ...surfaceStyle(spec, box),
        color: acc,
        gap: Math.round(box.h * 0.16),
        position: "relative",
      }}
    >
      <LeadIcon spec={spec} box={box} />
      {spec.text.enabled && (
        <span
          style={{
            ...textStyle(spec, box),
            color: acc,
            textShadow: spec.effects.glow > 0 ? `0 0 ${Math.round(spec.effects.glow * 0.25)}px rgba(${accRgb}, 0.9)` : "none",
          }}
        >
          {spec.text.content}
        </span>
      )}
    </HoverLift>
  );
}

// ── Surfaces ────────────────────────────────────────────────────────────

/** Tile — accent-tinted section card: ambient glow + uppercase accent title. */
function TileAtom({ spec, box }: AtomRenderProps) {
  const acc = spec.colors.accent;
  const f = fontPx(spec, box);
  return (
    <div
      style={{
        ...surfaceStyle(spec, box),
        display: "flex",
        flexDirection: "column",
        gap: Math.round(box.h * 0.06),
        padding: Math.max(8, Math.round(box.h * 0.09)),
        position: "relative",
      }}
    >
      {spec.text.enabled && (
        <span
          style={{
            ...textStyle(spec, box),
            fontSize: Math.max(8, Math.round(f * 0.5)),
            color: acc,
            textTransform: "uppercase",
            letterSpacing: `${Math.max(spec.text.tracking, 0.1)}em`,
          }}
        >
          {spec.text.content}
        </span>
      )}
      <div
        style={{
          flex: 1,
          borderRadius: Math.max(spec.effects.radius - 4, 3),
          background: `rgba(${hexToRgbTriple(acc)}, 0.05)`,
          border: `1px dashed rgba(${hexToRgbTriple(acc)}, 0.2)`,
        }}
      />
    </div>
  );
}

/** RSD — Row Section Divider: a 1px accent hairline. Structural, no glow. */
function RsdAtom({ spec, box }: AtomRenderProps) {
  const acc = hexToRgbTriple(spec.colors.border);
  const vertical = box.h >= box.w;
  return (
    <div
      style={{
        width: vertical ? Math.max(1, spec.effects.borderWidth) : box.w,
        height: vertical ? box.h : Math.max(1, spec.effects.borderWidth),
        background: `rgba(${acc}, ${spec.colors.borderAlpha})`,
        opacity: spec.effects.opacity,
        borderRadius: spec.effects.radius,
      }}
    />
  );
}

/** Scrollbar — themed thin track + accent thumb. */
function ScrollbarAtom({ spec, box }: AtomRenderProps) {
  const acc = hexToRgbTriple(spec.colors.accent);
  const vertical = box.h >= box.w;
  const thickness = Math.max(4, vertical ? box.w : box.h);
  return (
    <div
      style={{
        width: vertical ? thickness : box.w,
        height: vertical ? box.h : thickness,
        background: `rgba(${hexToRgbTriple(spec.colors.fill)}, ${spec.colors.fillAlpha})`,
        borderRadius: spec.effects.radius,
        opacity: spec.effects.opacity,
        display: "flex",
        alignItems: vertical ? "flex-start" : "center",
        padding: 1,
      }}
    >
      <div
        style={{
          width: vertical ? "100%" : "45%",
          height: vertical ? "45%" : "100%",
          borderRadius: spec.effects.radius,
          background: `rgba(${acc}, ${spec.colors.borderAlpha})`,
          boxShadow: spec.effects.glow > 0 ? `0 0 ${Math.round(spec.effects.glow * 0.3)}px rgba(${acc}, 0.6)` : "none",
        }}
      />
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────────

/** ResetButton — the canonical 20×20 cyan square with the ↺ glyph. */
function ResetButtonAtom({ spec, box }: AtomRenderProps) {
  const s = Math.min(box.w, box.h);
  return (
    <HoverLift type="button" style={{ ...surfaceStyle(spec, { w: s, h: s }), position: "relative" }}>
      <span style={{ ...textStyle(spec, { w: s, h: s }), color: spec.colors.accent }}>↺</span>
    </HoverLift>
  );
}

/** DaB — Dashed+Add Button: dashed border, accent "+ Add" label. */
function DashedAddAtom({ spec, box }: AtomRenderProps) {
  const acc = spec.colors.accent;
  return (
    <HoverLift
      type="button"
      style={{
        ...surfaceStyle(spec, box),
        border: `${Math.max(1, spec.effects.borderWidth)}px dashed rgba(${hexToRgbTriple(spec.colors.border)}, ${spec.colors.borderAlpha})`,
        gap: Math.round(box.h * 0.14),
        position: "relative",
      }}
    >
      <span style={{ ...textStyle(spec, box), color: acc, fontWeight: 800 }}>+</span>
      {spec.text.enabled && <span style={{ ...textStyle(spec, box), color: acc }}>{spec.text.content}</span>}
    </HoverLift>
  );
}

/** TileButton — clickable launcher: icon over uppercase label + sub-line. */
function TileButtonAtom({ spec, box }: AtomRenderProps) {
  const acc = spec.colors.accent;
  const f = fontPx(spec, box);
  return (
    <HoverLift
      type="button"
      style={{
        ...surfaceStyle(spec, box),
        flexDirection: "column",
        gap: Math.round(box.h * 0.07),
        padding: Math.max(6, Math.round(box.h * 0.1)),
        position: "relative",
      }}
    >
      {spec.icon.enabled && <SpecIcon spec={spec} size={Math.max(10, box.h * (spec.icon.sizePct / 100) * 0.42)} />}
      {spec.text.enabled && (
        <>
          <span style={{ ...textStyle(spec, box), fontSize: Math.max(8, Math.round(f * 0.55)), color: acc, textTransform: "uppercase" }}>
            {spec.text.content}
          </span>
          <span style={{ ...textStyle(spec, box), fontSize: Math.max(7, Math.round(f * 0.4)), fontWeight: 500, color: `rgba(${hexToRgbTriple(acc)}, 0.6)` }}>
            sub-line
          </span>
        </>
      )}
    </HoverLift>
  );
}

/** DrawerMenuButton — accent-FILLED square with a bold glyph + glow. */
function DrawerMenuButtonAtom({ spec, box }: AtomRenderProps) {
  const acc = spec.colors.accent;
  const accRgb = hexToRgbTriple(acc);
  const s = Math.min(box.w, box.h);
  return (
    <HoverLift
      type="button"
      style={{
        width: s,
        height: s,
        background: `rgba(${accRgb}, ${spec.colors.fillAlpha})`,
        border: `${spec.effects.borderWidth}px solid rgba(${accRgb}, ${spec.colors.borderAlpha})`,
        borderRadius: spec.effects.radius,
        boxShadow: spec.effects.glow > 0 ? `0 0 ${Math.round(spec.effects.glow * 0.4)}px rgba(${accRgb}, 0.7)` : "none",
        opacity: spec.effects.opacity,
        position: "relative",
      }}
    >
      {spec.icon.enabled ? (
        <SpecIcon spec={spec} size={s * (spec.icon.sizePct / 100) * 0.7} />
      ) : (
        <span style={{ ...textStyle(spec, { w: s, h: s }), color: spec.colors.text, fontWeight: 800 }}>
          {spec.text.enabled ? spec.text.content : "≡"}
        </span>
      )}
    </HoverLift>
  );
}

/** DrawerKnob — edge-pinned tab pill: identity glyph + vertical-rl label. */
function DrawerKnobAtom({ spec, box }: AtomRenderProps) {
  const acc = spec.colors.accent;
  const accRgb = hexToRgbTriple(acc);
  const r = spec.effects.radius;
  return (
    <HoverLift
      type="button"
      style={{
        width: box.w,
        height: box.h,
        flexDirection: "column",
        gap: Math.round(box.h * 0.05),
        background: `rgba(${accRgb}, ${spec.colors.fillAlpha})`,
        border: `${spec.effects.borderWidth}px solid rgba(${accRgb}, ${spec.colors.borderAlpha})`,
        borderLeft: "none",
        // Rounded on the non-edge side only — the knob is pinned to an edge.
        borderRadius: `0 ${r}px ${r}px 0`,
        boxShadow: shadowStack(spec),
        opacity: spec.effects.opacity,
        position: "relative",
      }}
    >
      {spec.icon.enabled && <SpecIcon spec={spec} size={Math.max(9, box.w * (spec.icon.sizePct / 100) * 0.6)} />}
      {spec.text.enabled && (
        <span
          style={{
            ...textStyle(spec, box),
            writingMode: "vertical-rl",
            fontSize: Math.max(7, Math.round(fontPx(spec, box) * 0.3)),
            color: acc,
            textTransform: "uppercase",
            letterSpacing: `${Math.max(spec.text.tracking, 0.14)}em`,
          }}
        >
          {spec.text.content}
        </span>
      )}
    </HoverLift>
  );
}

// ── Toggles ─────────────────────────────────────────────────────────────

function EclAtom({ spec, box }: AtomRenderProps) {
  const [open, setOpen] = useState(true);
  const acc = spec.colors.accent;
  const s = Math.min(box.w, box.h);
  return (
    <HoverLift
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-pressed={open}
      style={{ ...surfaceStyle(spec, { w: s, h: s }), position: "relative" }}
    >
      <span
        style={{
          width: s * 0.42,
          height: s * 0.42,
          borderRadius: "50%",
          background: open ? acc : "transparent",
          border: `${Math.max(1, spec.effects.borderWidth)}px solid ${acc}`,
          boxShadow: open && spec.effects.glow > 0 ? `0 0 ${Math.round(spec.effects.glow * 0.3)}px ${acc}` : "none",
          transition: "background 0.15s ease",
        }}
      />
    </HoverLift>
  );
}

/** Eyeball — square with the inline eye / eye-off SVG. Always SVG, never emoji. */
function EyeballAtom({ spec, box }: AtomRenderProps) {
  const [on, setOn] = useState(true);
  const acc = spec.colors.accent;
  const s = Math.min(box.w, box.h);
  const g = s * 0.62;
  return (
    <HoverLift
      type="button"
      onClick={() => setOn((v) => !v)}
      aria-pressed={on}
      style={{ ...surfaceStyle(spec, { w: s, h: s }), position: "relative" }}
    >
      <svg width={g} height={g} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12Z" />
        <circle cx="12" cy="12" r="3.2" />
        {!on && <path d="M3 3 L21 21" />}
      </svg>
    </HoverLift>
  );
}

/** LDM — Light-Dark Mode: moon ⇄ sun. */
function LdmAtom({ spec, box }: AtomRenderProps) {
  const [dark, setDark] = useState(true);
  const acc = spec.colors.accent;
  const s = Math.min(box.w, box.h);
  const g = s * 0.6;
  return (
    <HoverLift
      type="button"
      onClick={() => setDark((v) => !v)}
      aria-pressed={dark}
      style={{ ...surfaceStyle(spec, { w: s, h: s }), position: "relative" }}
    >
      <svg width={g} height={g} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dark ? (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 1.6v2.6M12 19.8v2.6M4.2 4.2l1.9 1.9M17.9 17.9l1.9 1.9M1.6 12h2.6M19.8 12h2.6M4.2 19.8l1.9-1.9M17.9 6.1l1.9-1.9" />
          </>
        )}
      </svg>
    </HoverLift>
  );
}

/** DTog — Drag Toggle: thin rail + hairline + neon grip (3 bars + triangles). */
function DtogAtom({ spec, box }: AtomRenderProps) {
  const acc = spec.colors.accent;
  const accRgb = hexToRgbTriple(acc);
  const w = Math.max(6, box.w);
  return (
    <div
      style={{
        width: w,
        height: box.h,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        opacity: spec.effects.opacity,
        cursor: "col-resize",
      }}
    >
      {/* the rail's outside hairline — what an RSD aligns to */}
      <span
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: Math.max(1, spec.effects.borderWidth),
          background: `rgba(${accRgb}, ${spec.colors.borderAlpha})`,
        }}
      />
      <svg width={Math.min(w, 10)} height={Math.min(box.h, 26)} viewBox="0 0 10 26" fill={acc} aria-hidden="true"
        style={{ filter: spec.effects.glow > 0 ? `drop-shadow(0 0 ${Math.round(spec.effects.glow * 0.25)}px rgba(${accRgb}, 0.9))` : undefined }}>
        <path d="M5 0 L8 4 H2 Z" />
        <rect x="1.5" y="8" width="7" height="1.4" rx="0.7" />
        <rect x="1.5" y="12" width="7" height="1.4" rx="0.7" />
        <rect x="1.5" y="16" width="7" height="1.4" rx="0.7" />
        <path d="M5 26 L8 22 H2 Z" />
      </svg>
    </div>
  );
}

/** Preview Toggle — labelled pill switch (the admin-wizard shape). */
function PreviewToggleAtom({ spec, box }: AtomRenderProps) {
  const [on, setOn] = useState(true);
  const acc = spec.colors.accent;
  const accRgb = hexToRgbTriple(acc);
  const track = Math.max(22, box.h * 0.8);
  return (
    <HoverLift
      type="button"
      onClick={() => setOn((v) => !v)}
      aria-pressed={on}
      style={{
        ...surfaceStyle(spec, box),
        gap: Math.round(box.h * 0.2),
        padding: `0 ${Math.max(8, Math.round(box.h * 0.28))}px`,
        justifyContent: "space-between",
        position: "relative",
      }}
    >
      {spec.text.enabled && <span style={textStyle(spec, box)}>{spec.text.content}</span>}
      <span
        style={{
          flex: "none",
          width: track,
          height: track * 0.55,
          borderRadius: 999,
          position: "relative",
          background: on ? `rgba(${accRgb}, 0.35)` : "rgba(255,255,255,0.08)",
          border: `1px solid rgba(${accRgb}, ${on ? 0.7 : 0.25})`,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: on ? `calc(100% - ${track * 0.42}px)` : "2px",
            transform: "translateY(-50%)",
            width: track * 0.36,
            height: track * 0.36,
            borderRadius: "50%",
            background: on ? acc : "rgba(255,255,255,0.5)",
            boxShadow: on ? `0 0 ${Math.round(spec.effects.glow * 0.25 + 3)}px rgba(${accRgb}, 0.8)` : "none",
            transition: "left 0.15s ease",
          }}
        />
      </span>
    </HoverLift>
  );
}

// ── Text & Icons ────────────────────────────────────────────────────────

/** RRT — Read Receipt Tag: the small neon "NEW" pill on a list row. */
function RrtAtom({ spec, box }: AtomRenderProps) {
  const acc = spec.colors.accent;
  const accRgb = hexToRgbTriple(acc);
  return (
    <Center
      style={{
        ...surfaceStyle(spec, box),
        background: `rgba(${accRgb}, ${spec.colors.fillAlpha})`,
        cursor: "pointer",
      }}
    >
      {spec.text.enabled && (
        <span
          style={{
            ...textStyle(spec, box),
            color: acc,
            textShadow: spec.effects.glow > 0 ? `0 0 ${Math.round(spec.effects.glow * 0.2)}px rgba(${accRgb}, 0.9)` : "none",
          }}
        >
          {spec.text.content}
        </span>
      )}
    </Center>
  );
}

// ── Registry ────────────────────────────────────────────────────────────

function def(
  key: string,
  name: string,
  group: AtomGroup,
  blurb: string,
  patch: AtomSpecPatch,
  Render: React.FC<AtomRenderProps>,
  hasIcon = false,
): AtomDef {
  return { key, name, group, blurb, defaults: mergeSpec(DEFAULT_SPEC, patch), hasIcon, Render };
}

export const ATOMS: AtomDef[] = [
  // ── Surfaces ──
  def("box", "Box", "Surfaces", "The bare surface every other atom sits on.", {
    size: { widthPct: 40, heightPct: 30 },
    colors: { fill: "#10131d" },
    text: { enabled: false },
  }, BoxAtom),
  def("tile", "Tile", "Surfaces", "Accent-tinted section card — uppercase title + a content well.", {
    size: { widthPct: 46, heightPct: 40 },
    colors: { fill: "#12111f", borderAlpha: 0.35 },
    effects: { radius: 14, glow: 22, shadow: 10 },
    text: { content: "Section", ratio: 22, weight: 800, tracking: 0.12, uppercase: true },
  }, TileAtom),
  def("rsd", "RSD", "Surfaces", "Row Section Divider — a 1px accent hairline. Structural, no glow.", {
    size: { widthPct: 5, heightPct: 46 },
    colors: { border: "#ff4ecb", borderAlpha: 0.35 },
    effects: { borderWidth: 1, radius: 0, glow: 0, shadow: 0 },
    text: { enabled: false },
  }, RsdAtom),
  def("scrollbar", "Scrollbar", "Surfaces", "Thin themed track with an accent thumb.", {
    size: { widthPct: 3, heightPct: 52 },
    colors: { fill: "#0f1320", fillAlpha: 0.6, borderAlpha: 0.55 },
    effects: { radius: 200, borderWidth: 0, glow: 10, shadow: 0 },
    text: { enabled: false },
  }, ScrollbarAtom),

  // ── Controls ──
  def("button", "Button", "Controls", "A clickable box with centered text and an optional icon.", {
    size: { widthPct: 30, heightPct: 14 },
    colors: { fill: "#1a1f2e" },
    effects: { radius: 10 },
    text: { content: "Button", ratio: 36 },
  }, ButtonAtom, true),
  def("neonbutton", "NeonButton", "Controls", "Accent pill with the text-shadow glow.", {
    size: { widthPct: 26, heightPct: 12 },
    colors: { fill: "#00e4fd", fillAlpha: 0.1, accent: "#00e4fd", border: "#00e4fd", borderAlpha: 0.45 },
    effects: { radius: 200, glow: 40 },
    text: { content: "Launch", ratio: 36, weight: 700, tracking: 0.06 },
  }, NeonButtonAtom, true),
  def("resetbutton", "ResetButton", "Controls", "The canonical 20×20 cyan square with the ↺ glyph.", {
    size: { widthPct: 6, heightPct: 9 },
    colors: { fill: "#22d3ee", fillAlpha: 0.08, accent: "#22d3ee", border: "#22d3ee", borderAlpha: 0.4 },
    effects: { radius: 5, glow: 0, shadow: 0 },
    text: { content: "↺", ratio: 62, weight: 600, tracking: 0 },
  }, ResetButtonAtom),
  def("dab", "Dashed+Add Button", "Controls", "Dashed border, accent “+ Add” — the empty-slot affordance.", {
    size: { widthPct: 24, heightPct: 13 },
    colors: { fillAlpha: 0.04, borderAlpha: 0.45 },
    effects: { radius: 10, glow: 0, shadow: 0 },
    text: { content: "Add", ratio: 34, weight: 700 },
  }, DashedAddAtom),
  def("tilebutton", "TileButton", "Controls", "Launcher tile — icon over an uppercase label and a sub-line.", {
    size: { widthPct: 22, heightPct: 34 },
    colors: { fill: "#12111f", borderAlpha: 0.3 },
    effects: { radius: 12, glow: 16, shadow: 12 },
    text: { content: "Sandbox", ratio: 20, weight: 800, tracking: 0.1 },
    icon: { enabled: true, sizePct: 70 },
  }, TileButtonAtom, true),
  def("drawermenubutton", "DrawerMenuButton", "Controls", "Accent-FILLED square with a bold glyph and glow.", {
    size: { widthPct: 8, heightPct: 12 },
    colors: { fillAlpha: 0.9, accent: "#ffb020", border: "#ffb020", borderAlpha: 0.7, text: "#0b0d13" },
    effects: { radius: 7, borderWidth: 1, glow: 30 },
    text: { content: "≡", ratio: 58, weight: 800 },
  }, DrawerMenuButtonAtom, true),
  def("drawerknob", "DrawerKnob", "Controls", "Edge-pinned tab pill — identity glyph + vertical label.", {
    size: { widthPct: 6, heightPct: 30 },
    colors: { fill: "#12111f", accent: "#22d3ee", border: "#22d3ee", borderAlpha: 0.45 },
    effects: { radius: 10, glow: 18, shadow: 10 },
    text: { content: "Inbox", ratio: 30, tracking: 0.18, uppercase: true },
    icon: { enabled: true, sizePct: 80 },
  }, DrawerKnobAtom, true),
  def("input", "Input", "Controls", "A text field — placeholder rides the text controls.", {
    size: { widthPct: 44, heightPct: 13 },
    colors: { fill: "#0f1320", borderAlpha: 0.4, text: "#9aa3c0" },
    effects: { radius: 9, glow: 8 },
    text: { content: "Type here…", ratio: 34, weight: 500 },
  }, InputAtom),

  // ── Toggles ──
  def("lightswitch", "Lightswitch", "Toggles", "Circle-on-stick toggle — click it.", {
    size: { widthPct: 12, heightPct: 22 },
    colors: { accent: "#22d3ee", fill: "#10131d" },
    effects: { glow: 25, borderWidth: 2, shadow: 0 },
    text: { enabled: false },
  }, LightswitchAtom),
  def("ecl", "ECL", "Toggles", "Expand-Collapse Lightswitch — the per-component mini toggle.", {
    size: { widthPct: 6, heightPct: 9 },
    colors: { fill: "#10131d", accent: "#ff4ecb", borderAlpha: 0.5 },
    effects: { radius: 5, glow: 12, shadow: 0, borderWidth: 1 },
    text: { enabled: false },
  }, EclAtom),
  def("eyeball", "Eyeball", "Toggles", "22×22 square with the inline eye / eye-off SVG. Never an emoji.", {
    size: { widthPct: 6.5, heightPct: 10 },
    colors: { fill: "#22d3ee", fillAlpha: 0.08, accent: "#22d3ee", border: "#22d3ee", borderAlpha: 0.4 },
    effects: { radius: 5, glow: 0, shadow: 0 },
    text: { enabled: false },
  }, EyeballAtom),
  def("ldm", "LDM", "Toggles", "Light-Dark Mode — moon ⇄ sun.", {
    size: { widthPct: 7, heightPct: 11 },
    colors: { fill: "#12111f", accent: "#ffb020", border: "#ffb020", borderAlpha: 0.4 },
    effects: { radius: 200, glow: 18, shadow: 0 },
    text: { enabled: false },
  }, LdmAtom),
  def("dtog", "DTog", "Toggles", "Drag Toggle — rail + hairline + neon grip. Drag to resize, click to collapse.", {
    size: { widthPct: 3, heightPct: 30 },
    colors: { accent: "#ff4ecb", border: "#ff4ecb", borderAlpha: 0.25 },
    effects: { borderWidth: 1, glow: 20, shadow: 0 },
    text: { enabled: false },
  }, DtogAtom),
  def("previewtoggle", "Preview Toggle", "Toggles", "Labelled pill switch — the admin-wizard shape.", {
    size: { widthPct: 34, heightPct: 13 },
    colors: { fill: "#12111f", accent: "#ff4ecb", borderAlpha: 0.3 },
    effects: { radius: 10, glow: 10 },
    text: { content: "Preview", ratio: 30, weight: 700 },
  }, PreviewToggleAtom),

  // ── Text & Icons ──
  def("text", "Text", "Text & Icons", "Type only — size as a ratio of its box.", {
    size: { widthPct: 62, heightPct: 14 },
    colors: { fillAlpha: 0 },
    effects: { borderWidth: 0, glow: 0, shadow: 0 },
    text: { content: "The quick brown fox", ratio: 44, weight: 600 },
  }, TextAtom),
  def("icon", "Icon", "Text & Icons", "Any ecosystem icon — or the built-in spark — fully repaintable.", {
    size: { widthPct: 16, heightPct: 24 },
    colors: { fillAlpha: 0 },
    effects: { borderWidth: 0, glow: 0, shadow: 0 },
    text: { enabled: false },
    icon: { enabled: true, glow: 30 },
  }, IconAtom, true),
  def("drawericon", "DrawerIcon", "Text & Icons", "A drawer's identity glyph — small, outline, accent-colored.", {
    size: { widthPct: 8, heightPct: 12 },
    colors: { fillAlpha: 0, accent: "#22d3ee" },
    effects: { borderWidth: 0, glow: 0, shadow: 0 },
    text: { enabled: false },
    icon: { enabled: true, sizePct: 92, fillMode: "none", strokeMode: "accent", strokeWidth: 1.4, glow: 14 },
  }, IconAtom, true),
  def("pill", "Pill / Badge", "Text & Icons", "The little rounded status chip.", {
    size: { widthPct: 16, heightPct: 9 },
    colors: { fill: "#ff4ecb", fillAlpha: 0.16, borderAlpha: 0.5 },
    effects: { radius: 200, glow: 14 },
    text: { content: "NEW", ratio: 42, tracking: 0.12, uppercase: true },
  }, PillAtom, true),
  def("rrt", "RRT", "Text & Icons", "Read Receipt Tag — the neon “NEW” pill that dismisses on click.", {
    size: { widthPct: 13, heightPct: 8 },
    colors: { fill: "#4ade80", fillAlpha: 0.14, accent: "#4ade80", border: "#4ade80", borderAlpha: 0.5 },
    effects: { radius: 200, glow: 20 },
    text: { content: "NEW", ratio: 46, weight: 800, tracking: 0.14, uppercase: true },
  }, RrtAtom),
  def("tooltip", "Tooltip", "Text & Icons", "Themed bubble + arrow above its target.", {
    size: { widthPct: 28, heightPct: 22 },
    colors: { fill: "#171325", accent: "#22d3ee", border: "#22d3ee", borderAlpha: 0.5 },
    effects: { radius: 10, glow: 22 },
    text: { content: "Copied!", ratio: 26, weight: 700, tracking: 0.08 },
  }, TooltipAtom),
];

export const ATOM_BY_KEY: Record<string, AtomDef> = Object.fromEntries(
  ATOMS.map((a) => [a.key, a]),
);
