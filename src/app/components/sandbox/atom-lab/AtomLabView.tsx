"use client";
/**
 * Atom Library Sandbox — the "atoms" view of the Sandbox modal (PillBar
 * switches between this and the classic component sandbox).
 *
 * Layout: [atom menu drawer | canvas stage | Atomic Editor]. Selecting an
 * atom auto-opens the editor on it — every styling control adjusts the
 * preview in realtime. Collapsing the menu drawer swaps it for a DDM on the
 * modal header row (portalled into `headerSlot`); the menu selection is the
 * DDM selection until a new atom is clicked.
 *
 * Specs persist server-side per atom (data/atom-lab via /api/atom-lab/specs,
 * debounced auto-save); Reset deletes the saved row and falls back to the
 * atom's registry defaults. Every edit pushes onto a per-atom undo stack —
 * cmd/ctrl+Z undoes, cmd/ctrl+shift+Z redoes.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled, { css } from "styled-components";
import AddmToggle from "@tgv/module-component-library/components/ui/AddmToggle";
import DdmSelect from "@tgv/module-component-library/components/ui/DdmSelect";
import SBDM from "@tgv/module-component-library/components/ui/SBDM";
import { colors, rgb } from "../../../theme";
import { PanelSidebarItem } from "../../../styled";
import Tooltip from "../../ui/Tooltip";
import { type AtomSpec, clampSpec, SPEC_LIMITS } from "./atomSpec";
import { ATOMS, ATOM_BY_KEY, ATOM_GROUPS, type AtomDef } from "./atomRegistry";
import { SVG_MANIFEST, SVG_SOURCE_GROUPS } from "../../svg-lab/manifest.generated";

const PINK = colors.pink;
const PINK_RGB = rgb.pink;

const labScrollbar = css`
  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(${PINK_RGB}, 0.3);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(${PINK_RGB}, 0.5);
  }
`;

// ── Layout ──────────────────────────────────────────────────────────────

const Wrap = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
`;

const Menu = styled.aside`
  flex: 0 0 250px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid rgba(${PINK_RGB}, 0.16);
  background: rgba(${PINK_RGB}, 0.025);

  [data-theme="light"] & {
    background: rgba(${PINK_RGB}, 0.04);
  }
`;

const MenuHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(${PINK_RGB}, 0.14);
`;

const MenuTitle = styled.span`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(${PINK_RGB}, 0.75);
`;

const MenuCount = styled.span`
  font-size: 10.5px;
  font-weight: 700;
  color: rgba(${PINK_RGB}, 0.5);
`;

const CollapseBtn = styled.button`
  margin-left: auto;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(${PINK_RGB}, 0.08);
  border: 1px solid rgba(${PINK_RGB}, 0.3);
  border-radius: 6px;
  color: ${PINK};
  font-size: 14px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  &:hover {
    background: rgba(${PINK_RGB}, 0.16);
  }
`;

const MenuScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  ${labScrollbar}
`;

const GroupHead = styled.button<{ $open: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  &:hover {
    background: rgba(${PINK_RGB}, 0.06);
  }
`;

const GroupLabel = styled.span`
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(${PINK_RGB}, 0.7);
  flex: 1;
  text-align: left;
`;

const GroupCount = styled.span`
  font-size: 10px;
  font-weight: 700;
  color: rgba(${PINK_RGB}, 0.45);
`;

const AtomItem = styled(PanelSidebarItem).attrs({ $accent: "pink" })`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const DirtyDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${PINK};
  box-shadow: 0 0 6px rgba(${PINK_RGB}, 0.8);
  flex: none;
  margin-left: auto;
`;

const ExpandRail = styled.button`
  flex: 0 0 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(${PINK_RGB}, 0.05);
  border: none;
  border-right: 1px solid rgba(${PINK_RGB}, 0.2);
  color: ${PINK};
  cursor: pointer;
  &:hover {
    background: rgba(${PINK_RGB}, 0.12);
  }
`;

const ExpandGlyph = styled.span`
  font-size: 14px;
  font-weight: 800;
`;

const ExpandLabel = styled.span`
  writing-mode: vertical-rl;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(${PINK_RGB}, 0.65);
`;

// ── Stage ───────────────────────────────────────────────────────────────

const Stage = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: auto;
  padding: 34px;
  ${labScrollbar}
`;

const CanvasFrame = styled.div`
  position: relative;
  flex: none;
  margin: auto;
  border: 1px dashed rgba(${PINK_RGB}, 0.35);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CanvasDims = styled.span`
  position: absolute;
  right: 0;
  bottom: -22px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(${PINK_RGB}, 0.55);
  font-variant-numeric: tabular-nums;
`;

const AtomName = styled.span`
  position: absolute;
  left: 0;
  top: -22px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(${PINK_RGB}, 0.6);
`;

// ── Atomic Editor panel ─────────────────────────────────────────────────

const Editor = styled.aside`
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-left: 1px solid rgba(${PINK_RGB}, 0.16);
  background: rgba(${PINK_RGB}, 0.025);

  [data-theme="light"] & {
    background: rgba(${PINK_RGB}, 0.04);
  }
`;

const EditorHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(${PINK_RGB}, 0.14);
`;

const EditorTitle = styled.span`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(${PINK_RGB}, 0.75);
`;

const EditorAtom = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${PINK};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SaveChip = styled.span<{ $state: "idle" | "saving" | "saved" | "error" }>`
  margin-left: auto;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${(p) =>
    p.$state === "error" ? "#ff6b6b" : p.$state === "saved" ? "#4ade80" : `rgba(${PINK_RGB}, 0.55)`};
  opacity: ${(p) => (p.$state === "idle" ? 0 : 1)};
  transition: opacity 0.35s ease;
  white-space: nowrap;
`;

const HistoryBtn = styled.button`
  flex: none;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  line-height: 1;
  border-radius: 6px;
  background: rgba(${PINK_RGB}, 0.08);
  border: 1px solid rgba(${PINK_RGB}, 0.3);
  color: ${PINK};
  cursor: pointer;
  &:hover:not(:disabled) {
    background: rgba(${PINK_RGB}, 0.18);
  }
  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
`;

const ResetAtomBtn = styled.button`
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(${PINK_RGB}, 0.08);
  border: 1px solid rgba(${PINK_RGB}, 0.35);
  color: ${PINK};
  cursor: pointer;
  white-space: nowrap;
  &:hover {
    background: rgba(${PINK_RGB}, 0.16);
  }
`;

const EditorScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px 24px;
  ${labScrollbar}
`;

const Section = styled.div`
  & + & {
    margin-top: 6px;
  }
`;

const SectionHead = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 6px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  &:hover {
    background: rgba(${PINK_RGB}, 0.06);
  }
`;

const SectionTitle = styled.span`
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(${PINK_RGB}, 0.7);
  flex: 1;
  text-align: left;
`;

const SectionBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 4px 6px 10px;
`;

/* Sub-group label inside a section (Fill / Stroke / Transform / Icon effects). */
const SubHead = styled.div`
  margin-top: 6px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(${PINK_RGB}, 0.45);
  border-top: 1px solid rgba(${PINK_RGB}, 0.12);
  padding-top: 7px;
`;

const IconHint = styled.div`
  font-size: 10px;
  line-height: 1.4;
  color: rgba(${PINK_RGB}, 0.45);
  padding: 0 2px;
`;

// ── Control rows ────────────────────────────────────────────────────────

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
`;

const RowLabel = styled.span`
  flex: 0 0 84px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.72);

  [data-theme="light"] & {
    color: rgba(0, 0, 0, 0.62);
  }
`;

const RangeInput = styled.input`
  flex: 1;
  min-width: 0;
  accent-color: ${PINK};
  cursor: pointer;
`;

const NumInput = styled.input`
  flex: 0 0 54px;
  width: 54px;
  padding: 3px 5px;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: inherit;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(${PINK_RGB}, 0.25);
  border-radius: 6px;
  outline: none;
  &:focus {
    border-color: rgba(${PINK_RGB}, 0.6);
  }

  [data-theme="light"] & {
    background: rgba(0, 0, 0, 0.04);
  }
`;

const TextInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  font-size: 12px;
  color: inherit;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(${PINK_RGB}, 0.25);
  border-radius: 6px;
  outline: none;
  &:focus {
    border-color: rgba(${PINK_RGB}, 0.6);
  }

  [data-theme="light"] & {
    background: rgba(0, 0, 0, 0.04);
  }
`;

const ColorSwatch = styled.input`
  flex: 0 0 30px;
  width: 30px;
  height: 22px;
  padding: 0;
  border: 1px solid rgba(${PINK_RGB}, 0.35);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  &::-webkit-color-swatch-wrapper {
    padding: 2px;
  }
  &::-webkit-color-swatch {
    border: none;
    border-radius: 4px;
  }
`;

const HexCode = styled.span`
  flex: 1;
  font-size: 10.5px;
  font-weight: 600;
  font-family: ui-monospace, monospace;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.5);
  text-transform: lowercase;

  [data-theme="light"] & {
    color: rgba(0, 0, 0, 0.45);
  }
`;

/* ResetButton vocab: 20×20 cyan square with the ↺ glyph. */
const ResetSq = styled.button`
  flex: none;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
  color: #22d3ee;
  background: rgba(34, 211, 238, 0.08);
  border: 1px solid rgba(34, 211, 238, 0.4);
  border-radius: 5px;
  cursor: pointer;
  &:hover {
    background: rgba(34, 211, 238, 0.18);
  }
`;

const SwitchBtn = styled.button<{ $on: boolean }>`
  flex: none;
  width: 34px;
  height: 18px;
  border-radius: 999px;
  position: relative;
  cursor: pointer;
  background: ${(p) => (p.$on ? `rgba(${PINK_RGB}, 0.35)` : "rgba(255,255,255,0.08)")};
  border: 1px solid ${(p) => (p.$on ? `rgba(${PINK_RGB}, 0.7)` : "rgba(255,255,255,0.2)")};
  transition: background 0.15s ease;
`;

const SwitchThumb = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 2px;
  left: ${(p) => (p.$on ? "17px" : "2px")};
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${(p) => (p.$on ? PINK : "rgba(255,255,255,0.5)")};
  box-shadow: ${(p) => (p.$on ? `0 0 6px rgba(${PINK_RGB}, 0.8)` : "none")};
  transition: left 0.15s ease, background 0.15s ease;
`;

const SizeReadout = styled.div`
  font-size: 10.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(${PINK_RGB}, 0.55);
  padding: 0 6px;
`;

const HeaderDdmWrap = styled.div`
  min-width: 170px;
  max-width: 240px;
  & button[aria-haspopup="menu"] {
    padding: 6px 12px;
    font-size: 12.5px;
  }
`;

// ── Row components ──────────────────────────────────────────────────────

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  onChange: (v: number) => void;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const shown = step < 1 ? Math.round(value * 100) / 100 : Math.round(value);
  return (
    <Row>
      <RowLabel>{label}</RowLabel>
      <RangeInput
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        aria-label={label}
      />
      <NumInput
        type="number"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
        aria-label={`${label} value`}
      />
      <Tooltip label="Reset" accent="#22d3ee">
        <ResetSq onClick={() => onChange(defaultValue)} aria-label={`Reset ${label}`}>
          ↺
        </ResetSq>
      </Tooltip>
    </Row>
  );
}

function to6(hex: string): string {
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return "#" + hex.slice(1).split("").map((c) => c + c).join("");
  }
  return hex;
}

function ColorRow({
  label,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  value: string;
  defaultValue: string;
  onChange: (v: string) => void;
}) {
  return (
    <Row>
      <RowLabel>{label}</RowLabel>
      <ColorSwatch
        type="color"
        value={to6(value)}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      />
      <HexCode>{to6(value)}</HexCode>
      <Tooltip label="Reset" accent="#22d3ee">
        <ResetSq onClick={() => onChange(defaultValue)} aria-label={`Reset ${label}`}>
          ↺
        </ResetSq>
      </Tooltip>
    </Row>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row>
      <RowLabel>{label}</RowLabel>
      <SwitchBtn $on={value} onClick={() => onChange(!value)} aria-pressed={value} aria-label={label}>
        <SwitchThumb $on={value} />
      </SwitchBtn>
    </Row>
  );
}

// ── Main view ───────────────────────────────────────────────────────────

export default function AtomLabView({
  headerSlot,
  initialKey,
}: {
  headerSlot?: HTMLElement | null;
  /** Atom to open on — the SVG Lab sets this after "Apply to atom". */
  initialKey?: string | null;
}) {
  const [active, setActive] = useState<string>(
    initialKey && ATOM_BY_KEY[initialKey] ? initialKey : ATOMS[0].key,
  );
  const [specs, setSpecs] = useState<Record<string, AtomSpec>>(() =>
    Object.fromEntries(ATOMS.map((a) => [a.key, a.defaults])),
  );
  const [menuOpen, setMenuOpen] = useState(true);
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ATOM_GROUPS.map((g) => [g, true])),
  );
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({
    canvas: true,
    size: true,
    colors: true,
    effects: true,
    text: true,
    icon: true,
  });
  // Per-atom undo/redo. past/future hold whole specs — the spec is small and
  // whole-object history keeps every control (including the Reset squares and
  // the icon picker) undoable without per-field bookkeeping.
  const [past, setPast] = useState<Record<string, AtomSpec[]>>({});
  const [future, setFuture] = useState<Record<string, AtomSpec[]>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate saved specs over the registry defaults (clamped against each
  // atom's own defaults so a partial/old file can't produce a broken spec).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/atom-lab/specs")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { specs?: Record<string, unknown> }) => {
        if (cancelled || !d.specs) return;
        setSpecs((prev) => {
          const next = { ...prev };
          for (const a of ATOMS) {
            const raw = d.specs?.[a.key];
            if (raw) next[a.key] = clampSpec(raw, a.defaults);
          }
          return next;
        });
      })
      .catch(() => {
        // No saved specs (or auth hiccup) — defaults are already in place.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timers = saveTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const queueSave = useCallback((key: string, spec: AtomSpec) => {
    const t = saveTimers.current;
    if (t[key]) clearTimeout(t[key]);
    setSaveState("saving");
    t[key] = setTimeout(() => {
      delete t[key];
      fetch("/api/atom-lab/specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, spec }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          setSaveState("saved");
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setSaveState("idle"), 1600);
        })
        .catch(() => setSaveState("error"));
    }, 650);
  }, []);

  const def: AtomDef = ATOM_BY_KEY[active] ?? ATOMS[0];
  const spec: AtomSpec = specs[def.key] ?? def.defaults;

  const HISTORY_MAX = 80;

  /** Commit a new spec for `key`, pushing the outgoing one onto its undo stack. */
  const commit = useCallback(
    (key: string, produce: (cur: AtomSpec) => AtomSpec, fallback: AtomSpec) => {
      setSpecs((prev) => {
        const cur = prev[key] ?? fallback;
        const next = produce(cur);
        if (JSON.stringify(next) === JSON.stringify(cur)) return prev;
        setPast((p) => ({ ...p, [key]: [...(p[key] ?? []), cur].slice(-HISTORY_MAX) }));
        setFuture((f) => (f[key]?.length ? { ...f, [key]: [] } : f));
        queueSave(key, next);
        return { ...prev, [key]: next };
      });
    },
    [queueSave],
  );

  const setField = useCallback(
    (section: keyof AtomSpec, field: string, value: unknown) => {
      commit(
        def.key,
        (cur) =>
          ({
            ...cur,
            [section]: { ...(cur[section] as Record<string, unknown>), [field]: value },
          }) as AtomSpec,
        def.defaults,
      );
    },
    [def, commit],
  );

  const undo = useCallback(() => {
    const stack = past[def.key] ?? [];
    if (!stack.length) return;
    const prevSpec = stack[stack.length - 1];
    setPast((p) => ({ ...p, [def.key]: stack.slice(0, -1) }));
    setFuture((f) => ({ ...f, [def.key]: [specs[def.key] ?? def.defaults, ...(f[def.key] ?? [])] }));
    setSpecs((s) => ({ ...s, [def.key]: prevSpec }));
    queueSave(def.key, prevSpec);
  }, [def, past, specs, queueSave]);

  const redo = useCallback(() => {
    const stack = future[def.key] ?? [];
    if (!stack.length) return;
    const nextSpec = stack[0];
    setFuture((f) => ({ ...f, [def.key]: stack.slice(1) }));
    setPast((p) => ({ ...p, [def.key]: [...(p[def.key] ?? []), specs[def.key] ?? def.defaults].slice(-HISTORY_MAX) }));
    setSpecs((s) => ({ ...s, [def.key]: nextSpec }));
    queueSave(def.key, nextSpec);
  }, [def, future, specs, queueSave]);

  // cmd/ctrl+Z undo, cmd/ctrl+shift+Z (and cmd/ctrl+Y) redo. Scoped to this
  // view's ownerDocument so it keeps working in the Sandbox pop-out window,
  // and it stays out of the way while a text field has focus.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const doc = rootRef.current?.ownerDocument ?? document;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k !== "z" && k !== "y") return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" && (t as HTMLInputElement).type === "text") return;
      if (tag === "TEXTAREA" || t?.isContentEditable) return;
      e.preventDefault();
      e.stopPropagation();
      if (k === "y" || e.shiftKey) redo();
      else undo();
    };
    doc.addEventListener("keydown", onKey, true);
    return () => doc.removeEventListener("keydown", onKey, true);
  }, [undo, redo]);

  const resetAtom = useCallback(() => {
    const t = saveTimers.current;
    if (t[def.key]) {
      clearTimeout(t[def.key]);
      delete t[def.key];
    }
    // Undoable like any other edit — Reset pushes onto the stack rather than
    // wiping it, so cmd+Z brings the styling back.
    setSpecs((prev) => {
      const cur = prev[def.key] ?? def.defaults;
      if (JSON.stringify(cur) === JSON.stringify(def.defaults)) return prev;
      setPast((p) => ({ ...p, [def.key]: [...(p[def.key] ?? []), cur].slice(-HISTORY_MAX) }));
      setFuture((f) => (f[def.key]?.length ? { ...f, [def.key]: [] } : f));
      return { ...prev, [def.key]: def.defaults };
    });
    fetch(`/api/atom-lab/specs?key=${encodeURIComponent(def.key)}`, { method: "DELETE" }).catch(
      () => {},
    );
    setSaveState("idle");
  }, [def]);

  const dirtyKeys = useMemo(() => {
    const set = new Set<string>();
    for (const a of ATOMS) {
      if (JSON.stringify(specs[a.key] ?? a.defaults) !== JSON.stringify(a.defaults)) set.add(a.key);
    }
    return set;
  }, [specs]);

  const box = {
    w: Math.max(8, Math.round((spec.canvas.width * spec.size.widthPct) / 100)),
    h: Math.max(8, Math.round((spec.canvas.height * spec.size.heightPct) / 100)),
  };

  const d = def.defaults;
  const Render = def.Render;

  const ddmOptions = useMemo(
    () => ATOMS.map((a) => ({ key: a.key, label: a.name, group: a.group as string })),
    [],
  );

  const toggleSection = (k: string) => setSectionOpen((p) => ({ ...p, [k]: !p[k] }));

  const canUndo = (past[def.key]?.length ?? 0) > 0;
  const canRedo = (future[def.key]?.length ?? 0) > 0;

  return (
    <Wrap ref={rootRef}>
      {/* Collapsed menu → DDM on the modal header row shows the selection. */}
      {!menuOpen &&
        headerSlot &&
        createPortal(
          <HeaderDdmWrap>
            <DdmSelect
              value={active}
              onChange={setActive}
              options={ddmOptions}
              ariaLabel="Pick an atom"
              accent={PINK}
              accentRgb={PINK_RGB}
            />
          </HeaderDdmWrap>,
          headerSlot,
        )}

      {menuOpen ? (
        <Menu>
          <MenuHead>
            <MenuTitle>Atoms</MenuTitle>
            <MenuCount>{ATOMS.length}</MenuCount>
            <Tooltip label="Collapse to header menu" accent={PINK}>
              <CollapseBtn onClick={() => setMenuOpen(false)} aria-label="Collapse atom menu">
                ‹
              </CollapseBtn>
            </Tooltip>
          </MenuHead>
          <MenuScroll>
            {ATOM_GROUPS.map((g) => {
              const items = ATOMS.filter((a) => a.group === g);
              const open = groupOpen[g] ?? true;
              return (
                <div key={g}>
                  <GroupHead
                    $open={open}
                    aria-expanded={open}
                    onClick={() => setGroupOpen((p) => ({ ...p, [g]: !open }))}
                  >
                    <GroupLabel>{g}</GroupLabel>
                    <GroupCount>{items.length}</GroupCount>
                    <AddmToggle open={open} />
                  </GroupHead>
                  {open &&
                    items.map((a) => (
                      <AtomItem
                        key={a.key}
                        $active={active === a.key}
                        onClick={() => setActive(a.key)}
                      >
                        <span>{a.name}</span>
                        {dirtyKeys.has(a.key) && (
                          <Tooltip label="Edited — differs from defaults" accent={PINK}>
                            <DirtyDot />
                          </Tooltip>
                        )}
                      </AtomItem>
                    ))}
                </div>
              );
            })}
          </MenuScroll>
        </Menu>
      ) : (
        <Tooltip label="Expand atom menu" accent={PINK}>
          <ExpandRail onClick={() => setMenuOpen(true)} aria-label="Expand atom menu">
            <ExpandGlyph>›</ExpandGlyph>
            <ExpandLabel>Atoms</ExpandLabel>
          </ExpandRail>
        </Tooltip>
      )}

      <Stage>
        <CanvasFrame
          style={{
            width: spec.canvas.width,
            height: spec.canvas.height,
            background: spec.canvas.grid
              ? `radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1.4px) 0 0 / 22px 22px, ${spec.canvas.bg}`
              : spec.canvas.bg,
          }}
        >
          <AtomName>{def.name}</AtomName>
          <Render spec={spec} box={box} />
          <CanvasDims>
            {spec.canvas.width} × {spec.canvas.height} · atom {box.w} × {box.h}
          </CanvasDims>
        </CanvasFrame>
      </Stage>

      <Editor>
        <EditorHead>
          <EditorTitle>Atomic Editor</EditorTitle>
          <EditorAtom>{def.name}</EditorAtom>
          <SaveChip $state={saveState}>
            {saveState === "saving" ? "saving…" : saveState === "error" ? "save failed" : "auto-saved"}
          </SaveChip>
          <Tooltip label="Undo (⌘/Ctrl+Z)" accent={PINK}>
            <HistoryBtn onClick={undo} disabled={!canUndo} aria-label="Undo">
              ↶
            </HistoryBtn>
          </Tooltip>
          <Tooltip label="Redo (⌘/Ctrl+⇧+Z)" accent={PINK}>
            <HistoryBtn onClick={redo} disabled={!canRedo} aria-label="Redo">
              ↷
            </HistoryBtn>
          </Tooltip>
          <Tooltip label="Back to this atom's defaults" accent={PINK}>
            <ResetAtomBtn onClick={resetAtom}>Reset</ResetAtomBtn>
          </Tooltip>
        </EditorHead>
        <EditorScroll>
          <Section>
            <SectionHead onClick={() => toggleSection("canvas")} aria-expanded={sectionOpen.canvas}>
              <SectionTitle>Canvas</SectionTitle>
              <AddmToggle open={sectionOpen.canvas} />
            </SectionHead>
            {sectionOpen.canvas && (
              <SectionBody>
                <SliderRow label="Width" value={spec.canvas.width} min={120} max={1600} defaultValue={d.canvas.width} onChange={(v) => setField("canvas", "width", v)} />
                <SliderRow label="Height" value={spec.canvas.height} min={80} max={1000} defaultValue={d.canvas.height} onChange={(v) => setField("canvas", "height", v)} />
                <ColorRow label="Background" value={spec.canvas.bg} defaultValue={d.canvas.bg} onChange={(v) => setField("canvas", "bg", v)} />
                <ToggleRow label="Dot grid" value={spec.canvas.grid} onChange={(v) => setField("canvas", "grid", v)} />
              </SectionBody>
            )}
          </Section>

          <Section>
            <SectionHead onClick={() => toggleSection("size")} aria-expanded={sectionOpen.size}>
              <SectionTitle>Size</SectionTitle>
              <AddmToggle open={sectionOpen.size} />
            </SectionHead>
            {sectionOpen.size && (
              <SectionBody>
                <SliderRow label="Width %" value={spec.size.widthPct} min={4} max={100} defaultValue={d.size.widthPct} onChange={(v) => setField("size", "widthPct", v)} />
                <SliderRow label="Height %" value={spec.size.heightPct} min={4} max={100} defaultValue={d.size.heightPct} onChange={(v) => setField("size", "heightPct", v)} />
                <SizeReadout>
                  atom box: {box.w} × {box.h} px
                </SizeReadout>
              </SectionBody>
            )}
          </Section>

          <Section>
            <SectionHead onClick={() => toggleSection("colors")} aria-expanded={sectionOpen.colors}>
              <SectionTitle>Colors</SectionTitle>
              <AddmToggle open={sectionOpen.colors} />
            </SectionHead>
            {sectionOpen.colors && (
              <SectionBody>
                <ColorRow label="Fill" value={spec.colors.fill} defaultValue={d.colors.fill} onChange={(v) => setField("colors", "fill", v)} />
                <SliderRow label="Fill alpha" value={spec.colors.fillAlpha} min={0} max={1} step={0.01} defaultValue={d.colors.fillAlpha} onChange={(v) => setField("colors", "fillAlpha", v)} />
                <ColorRow label="Border" value={spec.colors.border} defaultValue={d.colors.border} onChange={(v) => setField("colors", "border", v)} />
                <SliderRow label="Border alpha" value={spec.colors.borderAlpha} min={0} max={1} step={0.01} defaultValue={d.colors.borderAlpha} onChange={(v) => setField("colors", "borderAlpha", v)} />
                <ColorRow label="Text" value={spec.colors.text} defaultValue={d.colors.text} onChange={(v) => setField("colors", "text", v)} />
                <ColorRow label="Accent" value={spec.colors.accent} defaultValue={d.colors.accent} onChange={(v) => setField("colors", "accent", v)} />
              </SectionBody>
            )}
          </Section>

          <Section>
            <SectionHead onClick={() => toggleSection("effects")} aria-expanded={sectionOpen.effects}>
              <SectionTitle>Effects</SectionTitle>
              <AddmToggle open={sectionOpen.effects} />
            </SectionHead>
            {sectionOpen.effects && (
              <SectionBody>
                <SliderRow label="Radius" value={spec.effects.radius} min={0} max={200} defaultValue={d.effects.radius} onChange={(v) => setField("effects", "radius", v)} />
                <SliderRow label="Border width" value={spec.effects.borderWidth} min={0} max={12} step={0.5} defaultValue={d.effects.borderWidth} onChange={(v) => setField("effects", "borderWidth", v)} />
                <SliderRow label="Glow" value={spec.effects.glow} min={0} max={100} defaultValue={d.effects.glow} onChange={(v) => setField("effects", "glow", v)} />
                <SliderRow label="Shadow" value={spec.effects.shadow} min={0} max={100} defaultValue={d.effects.shadow} onChange={(v) => setField("effects", "shadow", v)} />
                <SliderRow label="Opacity" value={spec.effects.opacity} min={0.1} max={1} step={0.01} defaultValue={d.effects.opacity} onChange={(v) => setField("effects", "opacity", v)} />
              </SectionBody>
            )}
          </Section>

          {/* Icon (SVG) — populates only for atoms whose renderer draws one. */}
          {def.hasIcon && (
            <Section>
              <SectionHead onClick={() => toggleSection("icon")} aria-expanded={sectionOpen.icon}>
                <SectionTitle>Icon (SVG)</SectionTitle>
                <AddmToggle open={sectionOpen.icon} />
              </SectionHead>
              {sectionOpen.icon && (
                <SectionBody>
                  {def.key !== "icon" && (
                    <ToggleRow
                      label="Show icon"
                      value={spec.icon.enabled}
                      onChange={(v) => setField("icon", "enabled", v)}
                    />
                  )}
                  {(spec.icon.enabled || def.key === "icon") && (
                    <>
                      <Row>
                        <RowLabel>Glyph</RowLabel>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <SBDM
                            items={[
                              { key: "", label: "Built-in spark" },
                              ...SVG_MANIFEST.map((e) => ({
                                key: e.key,
                                label: e.name,
                                group: e.sourceLabel,
                              })),
                            ]}
                            value={spec.icon.source}
                            onSelect={(k) => setField("icon", "source", k)}
                            placeholder="Built-in spark"
                            searchPlaceholder={`Search ${SVG_MANIFEST.length} icons…`}
                            ariaLabel="Pick an icon"
                            minTriggerWidth={0}
                          />
                        </div>
                      </Row>
                      <IconHint>
                        {SVG_MANIFEST.length} icons · {SVG_SOURCE_GROUPS.length} sources · per-layer
                        editing lives in the SVG Lab tab
                      </IconHint>
                      <SliderRow label="Size %" value={spec.icon.sizePct} min={SPEC_LIMITS.icon.sizePct[0]} max={SPEC_LIMITS.icon.sizePct[1]} defaultValue={d.icon.sizePct} onChange={(v) => setField("icon", "sizePct", v)} />

                      <SubHead>Fill</SubHead>
                      <Row>
                        <RowLabel>Mode</RowLabel>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <DdmSelect
                            value={spec.icon.fillMode}
                            onChange={(v) => setField("icon", "fillMode", v)}
                            options={[
                              { key: "accent", label: "Follow accent" },
                              { key: "solid", label: "Custom color" },
                              { key: "none", label: "No fill" },
                            ]}
                            ariaLabel="Icon fill mode"
                            accent={PINK}
                            accentRgb={PINK_RGB}
                          />
                        </div>
                      </Row>
                      {spec.icon.fillMode === "solid" && (
                        <ColorRow label="Fill color" value={spec.icon.fill} defaultValue={d.icon.fill} onChange={(v) => setField("icon", "fill", v)} />
                      )}
                      {spec.icon.fillMode !== "none" && (
                        <SliderRow label="Fill alpha" value={spec.icon.fillAlpha} min={0} max={1} step={0.01} defaultValue={d.icon.fillAlpha} onChange={(v) => setField("icon", "fillAlpha", v)} />
                      )}

                      <SubHead>Stroke</SubHead>
                      <Row>
                        <RowLabel>Mode</RowLabel>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <DdmSelect
                            value={spec.icon.strokeMode}
                            onChange={(v) => setField("icon", "strokeMode", v)}
                            options={[
                              { key: "accent", label: "Follow accent" },
                              { key: "solid", label: "Custom color" },
                              { key: "none", label: "No stroke" },
                            ]}
                            ariaLabel="Icon stroke mode"
                            accent={PINK}
                            accentRgb={PINK_RGB}
                          />
                        </div>
                      </Row>
                      {spec.icon.strokeMode === "solid" && (
                        <ColorRow label="Stroke color" value={spec.icon.stroke} defaultValue={d.icon.stroke} onChange={(v) => setField("icon", "stroke", v)} />
                      )}
                      {spec.icon.strokeMode !== "none" && (
                        <>
                          <SliderRow label="Width" value={spec.icon.strokeWidth} min={SPEC_LIMITS.icon.strokeWidth[0]} max={SPEC_LIMITS.icon.strokeWidth[1]} step={0.1} defaultValue={d.icon.strokeWidth} onChange={(v) => setField("icon", "strokeWidth", v)} />
                          <SliderRow label="Stroke alpha" value={spec.icon.strokeAlpha} min={0} max={1} step={0.01} defaultValue={d.icon.strokeAlpha} onChange={(v) => setField("icon", "strokeAlpha", v)} />
                          <Row>
                            <RowLabel>Line cap</RowLabel>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <DdmSelect
                                value={spec.icon.linecap}
                                onChange={(v) => setField("icon", "linecap", v)}
                                options={[
                                  { key: "round", label: "Round" },
                                  { key: "butt", label: "Butt" },
                                  { key: "square", label: "Square" },
                                ]}
                                ariaLabel="Stroke linecap"
                                accent={PINK}
                                accentRgb={PINK_RGB}
                              />
                            </div>
                          </Row>
                          <Row>
                            <RowLabel>Line join</RowLabel>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <DdmSelect
                                value={spec.icon.linejoin}
                                onChange={(v) => setField("icon", "linejoin", v)}
                                options={[
                                  { key: "round", label: "Round" },
                                  { key: "miter", label: "Miter" },
                                  { key: "bevel", label: "Bevel" },
                                ]}
                                ariaLabel="Stroke linejoin"
                                accent={PINK}
                                accentRgb={PINK_RGB}
                              />
                            </div>
                          </Row>
                          <SliderRow label="Dash" value={spec.icon.dash} min={SPEC_LIMITS.icon.dash[0]} max={SPEC_LIMITS.icon.dash[1]} step={0.5} defaultValue={d.icon.dash} onChange={(v) => setField("icon", "dash", v)} />
                          {spec.icon.dash > 0 && (
                            <>
                              <SliderRow label="Dash gap" value={spec.icon.dashGap} min={SPEC_LIMITS.icon.dashGap[0]} max={SPEC_LIMITS.icon.dashGap[1]} step={0.5} defaultValue={d.icon.dashGap} onChange={(v) => setField("icon", "dashGap", v)} />
                              <SliderRow label="Dash offset" value={spec.icon.dashOffset} min={SPEC_LIMITS.icon.dashOffset[0]} max={SPEC_LIMITS.icon.dashOffset[1]} step={0.5} defaultValue={d.icon.dashOffset} onChange={(v) => setField("icon", "dashOffset", v)} />
                            </>
                          )}
                        </>
                      )}

                      <SubHead>Transform</SubHead>
                      <SliderRow label="Rotate" value={spec.icon.rotate} min={SPEC_LIMITS.icon.rotate[0]} max={SPEC_LIMITS.icon.rotate[1]} defaultValue={d.icon.rotate} onChange={(v) => setField("icon", "rotate", v)} />
                      <SliderRow label="Scale" value={spec.icon.scale} min={SPEC_LIMITS.icon.scale[0]} max={SPEC_LIMITS.icon.scale[1]} step={0.01} defaultValue={d.icon.scale} onChange={(v) => setField("icon", "scale", v)} />
                      <SliderRow label="Offset X" value={spec.icon.offsetX} min={SPEC_LIMITS.icon.offset[0]} max={SPEC_LIMITS.icon.offset[1]} defaultValue={d.icon.offsetX} onChange={(v) => setField("icon", "offsetX", v)} />
                      <SliderRow label="Offset Y" value={spec.icon.offsetY} min={SPEC_LIMITS.icon.offset[0]} max={SPEC_LIMITS.icon.offset[1]} defaultValue={d.icon.offsetY} onChange={(v) => setField("icon", "offsetY", v)} />
                      <ToggleRow label="Flip X" value={spec.icon.flipX} onChange={(v) => setField("icon", "flipX", v)} />
                      <ToggleRow label="Flip Y" value={spec.icon.flipY} onChange={(v) => setField("icon", "flipY", v)} />

                      <SubHead>Icon effects</SubHead>
                      <SliderRow label="Glow" value={spec.icon.glow} min={SPEC_LIMITS.icon.glow[0]} max={SPEC_LIMITS.icon.glow[1]} defaultValue={d.icon.glow} onChange={(v) => setField("icon", "glow", v)} />
                      <SliderRow label="Blur" value={spec.icon.blur} min={SPEC_LIMITS.icon.blur[0]} max={SPEC_LIMITS.icon.blur[1]} step={0.1} defaultValue={d.icon.blur} onChange={(v) => setField("icon", "blur", v)} />
                      <SliderRow label="Opacity" value={spec.icon.opacity} min={0.1} max={1} step={0.01} defaultValue={d.icon.opacity} onChange={(v) => setField("icon", "opacity", v)} />
                    </>
                  )}
                </SectionBody>
              )}
            </Section>
          )}

          <Section>
            <SectionHead onClick={() => toggleSection("text")} aria-expanded={sectionOpen.text}>
              <SectionTitle>Text</SectionTitle>
              <AddmToggle open={sectionOpen.text} />
            </SectionHead>
            {sectionOpen.text && (
              <SectionBody>
                <ToggleRow label="Show text" value={spec.text.enabled} onChange={(v) => setField("text", "enabled", v)} />
                {spec.text.enabled && (
                  <>
                    <Row>
                      <RowLabel>Content</RowLabel>
                      <TextInput
                        value={spec.text.content}
                        maxLength={80}
                        onChange={(e) => setField("text", "content", e.target.value)}
                        aria-label="Text content"
                      />
                    </Row>
                    <Row>
                      <RowLabel>Size mode</RowLabel>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <DdmSelect
                          value={spec.text.mode}
                          onChange={(v) => setField("text", "mode", v === "px" ? "px" : "ratio")}
                          options={[
                            { key: "ratio", label: "Ratio of atom height" },
                            { key: "px", label: "Fixed px" },
                          ]}
                          ariaLabel="Text size mode"
                          accent={PINK}
                          accentRgb={PINK_RGB}
                        />
                      </div>
                    </Row>
                    {spec.text.mode === "ratio" ? (
                      <SliderRow label="Ratio %" value={spec.text.ratio} min={2} max={90} defaultValue={d.text.ratio} onChange={(v) => setField("text", "ratio", v)} />
                    ) : (
                      <SliderRow label="Size px" value={spec.text.px} min={6} max={200} defaultValue={d.text.px} onChange={(v) => setField("text", "px", v)} />
                    )}
                    <SliderRow label="Weight" value={spec.text.weight} min={100} max={900} step={100} defaultValue={d.text.weight} onChange={(v) => setField("text", "weight", v)} />
                    <SliderRow label="Tracking" value={spec.text.tracking} min={0} max={0.3} step={0.01} defaultValue={d.text.tracking} onChange={(v) => setField("text", "tracking", v)} />
                    <ToggleRow label="Uppercase" value={spec.text.uppercase} onChange={(v) => setField("text", "uppercase", v)} />
                  </>
                )}
              </SectionBody>
            )}
          </Section>
        </EditorScroll>
      </Editor>
    </Wrap>
  );
}
