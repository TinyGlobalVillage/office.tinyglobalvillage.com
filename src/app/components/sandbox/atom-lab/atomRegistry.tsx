"use client";
/**
 * Atom Lab registry — the 12 seed atoms: 6 basic primitives + 6 migrated
 * component-groups (DDM, PillBar, Lightswitch, Tooltip, ADDM, NeonButton —
 * the vocab six). Every renderer is a spec-driven silhouette: EVERY visual
 * decision (size, colors, effects, text) comes off the AtomSpec so the
 * Atomic Editor controls all of it live. Composites deliberately re-draw
 * the vocab shapes here instead of importing the shared components — the
 * whole point is that nothing is pinned.
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

export type AtomBox = { w: number; h: number };
export type AtomRenderProps = { spec: AtomSpec; box: AtomBox };

export type AtomDef = {
  key: string;
  name: string;
  group: "Basic Atoms" | "Component Groups";
  blurb: string;
  defaults: AtomSpec;
  /** Renderer draws an SVG → the editor grows its Icon (SVG) section. */
  hasIcon?: boolean;
  Render: React.FC<AtomRenderProps>;
};

export const ATOM_GROUPS = ["Basic Atoms", "Component Groups"] as const;

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

// ── Component-groups (the vocab six) ────────────────────────────────────

function DdmAtom({ spec, box }: AtomRenderProps) {
  const [open, setOpen] = useState(true);
  const acc = spec.colors.accent;
  const accRgb = hexToRgbTriple(acc);
  const f = fontPx(spec, box);
  const items = ["Save Word", "Save PDF", "Copy Text"];
  return (
    <div style={{ position: "relative", width: box.w }}>
      <HoverLift
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ ...surfaceStyle(spec, box), width: "100%", justifyContent: "flex-start", padding: `0 ${Math.max(10, Math.round(box.h * 0.3))}px`, gap: 8, position: "relative" }}
      >
        <LeadIcon spec={spec} box={box} />
        {spec.text.enabled && <span style={{ ...textStyle(spec, box), flex: 1, textAlign: "left" }}>{spec.text.content}</span>}
        {/* Filled triangle, never a chevron stroke — DDM canon. */}
        <span
          aria-hidden="true"
          style={{
            width: 0,
            height: 0,
            borderLeft: `${f * 0.38}px solid transparent`,
            borderRight: `${f * 0.38}px solid transparent`,
            borderTop: `${f * 0.5}px solid ${acc}`,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
          }}
        />
      </HoverLift>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: box.h + 6,
            left: 0,
            width: "100%",
            background: `rgba(13, 11, 22, 0.97)`,
            border: `1px solid rgba(${accRgb}, 0.4)`,
            borderRadius: Math.min(spec.effects.radius, 14),
            boxShadow: `0 0 ${Math.round(spec.effects.glow * 0.5 + 8)}px rgba(${accRgb}, 0.3)`,
            padding: 5,
            zIndex: 2,
          }}
        >
          {items.map((it, i) => (
            <div
              key={it}
              role="menuitem"
              style={{
                padding: `${Math.max(4, Math.round(f * 0.45))}px 9px`,
                borderRadius: Math.min(Math.max(spec.effects.radius - 4, 4), 9),
                fontSize: Math.max(9, Math.round(f * 0.85)),
                fontWeight: 600,
                color: i === 0 ? acc : spec.colors.text,
                background: i === 0 ? `rgba(${accRgb}, 0.14)` : "transparent",
                cursor: "pointer",
              }}
            >
              {it}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PillBarAtom({ spec, box }: AtomRenderProps) {
  const [active, setActive] = useState(0);
  const acc = spec.colors.accent;
  const accRgb = hexToRgbTriple(acc);
  const f = fontPx(spec, box);
  const labels = [spec.text.enabled ? spec.text.content : "One", "Browse", "Saved"];
  return (
    <div
      role="tablist"
      style={{
        ...surfaceStyle(spec, box),
        width: box.w,
        height: box.h,
        display: "flex",
        alignItems: "stretch",
        gap: 6,
        padding: 4,
      }}
    >
      {labels.map((l, i) => (
        <HoverLift
          key={i}
          type="button"
          role="tab"
          aria-selected={active === i}
          onClick={() => setActive(i)}
          style={{
            flex: "1 1 0",
            background: active === i ? `rgba(${accRgb}, 0.14)` : "transparent",
            border: `1px solid ${active === i ? `rgba(${accRgb}, 0.4)` : "transparent"}`,
            borderRadius: Math.max(spec.effects.radius - 3, 3),
            color: active === i ? acc : spec.colors.text,
            fontSize: f,
            fontWeight: spec.text.weight,
            letterSpacing: `${spec.text.tracking}em`,
            textTransform: spec.text.uppercase ? "uppercase" : "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {l}
        </HoverLift>
      ))}
    </div>
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

function AddmAtom({ spec, box }: AtomRenderProps) {
  const [open, setOpen] = useState(true);
  const acc = spec.colors.accent;
  const accRgb = hexToRgbTriple(acc);
  const f = fontPx(spec, box);
  return (
    <div style={{ width: box.w }}>
      <HoverLift
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          ...surfaceStyle(spec, { w: box.w, h: box.h }),
          width: "100%",
          justifyContent: "flex-start",
          gap: 8,
          padding: `0 ${Math.max(10, Math.round(box.h * 0.3))}px`,
        }}
      >
        <span
          style={{
            ...textStyle(spec, box),
            color: `rgba(${accRgb}, 0.85)`,
            textTransform: spec.text.uppercase ? "uppercase" : "none",
            flex: 1,
            textAlign: "left",
          }}
        >
          {spec.text.enabled ? spec.text.content : "Group"}
        </span>
        <span style={{ fontSize: Math.max(8, Math.round(f * 0.75)), fontWeight: 700, color: `rgba(${accRgb}, 0.6)` }}>6</span>
        <span style={{ fontSize: Math.round(f * 1.1), fontWeight: 800, color: acc, lineHeight: 1 }}>
          {open ? "−" : "+"}
        </span>
      </HoverLift>
      {open && (
        <div
          style={{
            marginTop: 4,
            border: `1px solid rgba(${accRgb}, 0.18)`,
            borderRadius: Math.min(spec.effects.radius, 10),
            padding: 5,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {["First item", "Second item", "Third item"].map((it) => (
            <div
              key={it}
              style={{
                padding: `${Math.max(3, Math.round(f * 0.35))}px 8px`,
                borderRadius: 6,
                fontSize: Math.max(8, Math.round(f * 0.8)),
                color: spec.colors.text,
                background: `rgba(${accRgb}, 0.05)`,
              }}
            >
              {it}
            </div>
          ))}
        </div>
      )}
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

// ── Registry ────────────────────────────────────────────────────────────

function def(
  key: string,
  name: string,
  group: AtomDef["group"],
  blurb: string,
  patch: AtomSpecPatch,
  Render: React.FC<AtomRenderProps>,
  hasIcon = false,
): AtomDef {
  return { key, name, group, blurb, defaults: mergeSpec(DEFAULT_SPEC, patch), hasIcon, Render };
}

export const ATOMS: AtomDef[] = [
  // ── Basic Atoms ──
  def("box", "Box", "Basic Atoms", "The bare surface every other atom sits on.", {
    size: { widthPct: 40, heightPct: 30 },
    colors: { fill: "#10131d" },
    text: { enabled: false },
  }, BoxAtom),
  def("button", "Button", "Basic Atoms", "A clickable box with centered text and an optional icon.", {
    size: { widthPct: 30, heightPct: 14 },
    colors: { fill: "#1a1f2e" },
    effects: { radius: 10 },
    text: { content: "Button", ratio: 36 },
  }, ButtonAtom, true),
  def("text", "Text", "Basic Atoms", "Type only — size as ratio of its box.", {
    size: { widthPct: 62, heightPct: 14 },
    colors: { fillAlpha: 0 },
    effects: { borderWidth: 0, glow: 0, shadow: 0 },
    text: { content: "The quick brown fox", ratio: 44, weight: 600 },
  }, TextAtom),
  def("icon", "Icon", "Basic Atoms", "Any ecosystem icon — or the built-in spark — fully repaintable.", {
    size: { widthPct: 16, heightPct: 24 },
    colors: { fillAlpha: 0 },
    effects: { borderWidth: 0, glow: 0, shadow: 0 },
    text: { enabled: false },
    icon: { enabled: true, glow: 30 },
  }, IconAtom, true),
  def("input", "Input", "Basic Atoms", "A text field — placeholder rides the text controls.", {
    size: { widthPct: 44, heightPct: 13 },
    colors: { fill: "#0f1320", borderAlpha: 0.4, text: "#9aa3c0" },
    effects: { radius: 9, glow: 8 },
    text: { content: "Type here…", ratio: 34, weight: 500 },
  }, InputAtom),
  def("pill", "Pill / Badge", "Basic Atoms", "The little rounded status chip.", {
    size: { widthPct: 16, heightPct: 9 },
    colors: { fill: "#ff4ecb", fillAlpha: 0.16, borderAlpha: 0.5 },
    effects: { radius: 200, glow: 14 },
    text: { content: "NEW", ratio: 42, tracking: 0.12, uppercase: true },
  }, PillAtom, true),

  // ── Component Groups ──
  def("ddm", "DDM", "Component Groups", "Dropdown Menu — pill trigger + floating menu card.", {
    size: { widthPct: 32, heightPct: 12 },
    colors: { fill: "#171325", accent: "#b18cff", border: "#b18cff", borderAlpha: 0.5 },
    effects: { radius: 200, glow: 20 },
    text: { content: "Save Word", ratio: 34, weight: 600 },
  }, DdmAtom, true),
  def("pillbar", "PillBar", "Component Groups", "Segmented view-switcher — recessed rail, floating pill.", {
    size: { widthPct: 52, heightPct: 11 },
    colors: { fill: "#16161c", accent: "#00e4fd", border: "#2a2a35", borderAlpha: 1 },
    effects: { radius: 10, glow: 0, shadow: 8 },
    text: { content: "My Courses", ratio: 34, weight: 700 },
  }, PillBarAtom),
  def("lightswitch", "Lightswitch", "Component Groups", "Circle-on-stick toggle — click it.", {
    size: { widthPct: 12, heightPct: 22 },
    colors: { accent: "#22d3ee", fill: "#10131d" },
    effects: { glow: 25, borderWidth: 2, shadow: 0 },
    text: { enabled: false },
  }, LightswitchAtom),
  def("tooltip", "Tooltip", "Component Groups", "Themed bubble + arrow above its target.", {
    size: { widthPct: 28, heightPct: 22 },
    colors: { fill: "#171325", accent: "#22d3ee", border: "#22d3ee", borderAlpha: 0.5 },
    effects: { radius: 10, glow: 22 },
    text: { content: "Copied!", ratio: 26, weight: 700, tracking: 0.08 },
  }, TooltipAtom),
  def("addm", "ADDM", "Component Groups", "Accordion group header with +/− toggle.", {
    size: { widthPct: 56, heightPct: 12 },
    colors: { fill: "#131722", accent: "#ff4ecb" },
    effects: { radius: 8, glow: 6 },
    text: { content: "Buttons", ratio: 30, weight: 800, tracking: 0.08, uppercase: true },
  }, AddmAtom),
  def("neonbutton", "NeonButton", "Component Groups", "Accent pill with the text-shadow glow.", {
    size: { widthPct: 26, heightPct: 12 },
    colors: { fill: "#00e4fd", fillAlpha: 0.1, accent: "#00e4fd", border: "#00e4fd", borderAlpha: 0.45 },
    effects: { radius: 200, glow: 40 },
    text: { content: "Launch", ratio: 36, weight: 700, tracking: 0.06 },
  }, NeonButtonAtom, true),
];

export const ATOM_BY_KEY: Record<string, AtomDef> = Object.fromEntries(
  ATOMS.map((a) => [a.key, a]),
);
