"use client";
/**
 * Atomic Editor — the shared lever panel. Every visual property of ONE atom,
 * driven off its AtomSpec; the canvas re-renders on the same tick.
 *
 * Two hosts use the identical panel: the Atom Library (editing a library
 * atom's saved spec) and the Component Composer (editing one node's spec
 * inside a component). Extracting it is what keeps those two surfaces from
 * drifting — there is one place where a lever is defined.
 *
 * Canon: ~/.claude/vocabulary/AtomicEditor.md · AtomSpec.md
 */
import React from "react";
import styled, { css } from "styled-components";
import AddmToggle from "@tgv/module-component-library/components/ui/AddmToggle";
import DdmSelect from "@tgv/module-component-library/components/ui/DdmSelect";
import SBDM from "@tgv/module-component-library/components/ui/SBDM";
import { colors, rgb } from "../../../theme";
import Tooltip from "../../ui/Tooltip";
import {
  type AtomSpec,
  type StateName,
  type TextSlotSpec,
  DEFAULT_TEXT_SLOT,
  SPEC_LIMITS,
  STATE_NAMES,
  isSlotName,
} from "./atomSpec";
import { type AtomDef } from "./atomRegistry";
import PublishControls from "./PublishControls";
import { SVG_MANIFEST, SVG_SOURCE_GROUPS } from "../../svg-lab/manifest.generated";

const PINK = colors.pink;
const PINK_RGB = rgb.pink;

export const labScrollbar = css`
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

export type SaveState = "idle" | "saving" | "saved" | "error";

// ── Atomic Editor panel ─────────────────────────────────────────────────

export const Editor = styled.aside`
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

/* State pills — which state the levers edit, and the canvas previews. */
const StateRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding-bottom: 2px;
`;

const StatePill = styled.button<{ $on: boolean; $set: boolean }>`
  padding: 3px 9px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: 999px;
  cursor: pointer;
  border: 1px solid rgba(${PINK_RGB}, ${(p) => (p.$on ? 0.85 : p.$set ? 0.5 : 0.2)});
  background: rgba(${PINK_RGB}, ${(p) => (p.$on ? 0.16 : p.$set ? 0.07 : 0.03)});
  color: rgba(${PINK_RGB}, ${(p) => (p.$on ? 1 : p.$set ? 0.8 : 0.55)});
  &:hover {
    border-color: rgba(${PINK_RGB}, 0.7);
  }
`;

const ClearStateBtn = styled.button`
  align-self: flex-start;
  margin-top: 2px;
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 700;
  border-radius: 6px;
  border: 1px solid rgba(${PINK_RGB}, 0.3);
  background: transparent;
  color: rgba(${PINK_RGB}, 0.7);
  cursor: pointer;
  white-space: nowrap;
  &:hover:not(:disabled) {
    background: rgba(${PINK_RGB}, 0.08);
  }
  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
`;

/* Slot pills — same silhouette as the state pills: bright = selected here. */
const SlotRow = StateRow;
const SlotPill = StatePill;

// ── Control rows ────────────────────────────────────────────────────────

export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
`;

export const RowLabel = styled.span`
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

export const TextInput = styled.input`
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

export const HeaderDdmWrap = styled.div`
  min-width: 170px;
  max-width: 240px;
  & button[aria-haspopup="menu"] {
    padding: 6px 12px;
    font-size: 12.5px;
  }
`;

// ── Row components ──────────────────────────────────────────────────────

export function SliderRow({
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

export function ColorRow({
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

export function ToggleRow({
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

/**
 * The levers for ONE state's sparse patch. Values fall back to rest, and every
 * Reset square's "default" IS the rest value — the host prunes an override
 * equal to rest, so ↺ genuinely clears the override rather than pinning a
 * copy. Colors and effects only, matching what `AtomStatePatch` can say (and
 * what a shipped atom's state block can honestly render).
 */
function StateLevers({
  spec,
  state,
  setStateField,
  clearState,
}: {
  spec: AtomSpec;
  state: StateName;
  setStateField: (state: StateName, section: "colors" | "effects", field: string, value: unknown) => void;
  clearState: (state: StateName) => void;
}) {
  const sp = spec.states?.[state];
  const colors = { ...spec.colors, ...sp?.colors };
  const effects = { ...spec.effects, ...sp?.effects };
  const set = (section: "colors" | "effects", field: string) => (v: unknown) =>
    setStateField(state, section, field, v);
  return (
    <>
      <ColorRow label="Fill" value={colors.fill} defaultValue={spec.colors.fill} onChange={set("colors", "fill")} />
      <SliderRow label="Fill alpha" value={colors.fillAlpha} min={0} max={1} step={0.01} defaultValue={spec.colors.fillAlpha} onChange={set("colors", "fillAlpha")} />
      <ColorRow label="Border" value={colors.border} defaultValue={spec.colors.border} onChange={set("colors", "border")} />
      <SliderRow label="Border alpha" value={colors.borderAlpha} min={0} max={1} step={0.01} defaultValue={spec.colors.borderAlpha} onChange={set("colors", "borderAlpha")} />
      <ColorRow label="Text" value={colors.text} defaultValue={spec.colors.text} onChange={set("colors", "text")} />
      <SliderRow label="Radius" value={effects.radius} min={0} max={200} defaultValue={spec.effects.radius} onChange={set("effects", "radius")} />
      <SliderRow label="Border width" value={effects.borderWidth} min={0} max={12} step={0.5} defaultValue={spec.effects.borderWidth} onChange={set("effects", "borderWidth")} />
      <SliderRow label="Glow" value={effects.glow} min={0} max={100} defaultValue={spec.effects.glow} onChange={set("effects", "glow")} />
      <SliderRow label="Shadow" value={effects.shadow} min={0} max={100} defaultValue={spec.effects.shadow} onChange={set("effects", "shadow")} />
      <SliderRow label="Opacity" value={effects.opacity} min={0.1} max={1} step={0.01} defaultValue={spec.effects.opacity} onChange={set("effects", "opacity")} />
      {sp && <ClearStateBtn onClick={() => clearState(state)}>Clear {state} overrides</ClearStateBtn>}
    </>
  );
}

/**
 * The levers for ONE named slot — the Text section's controls again, plus the
 * slot's own paint. Reset squares fall back to the atom's registry default
 * for that slot when the def declares one, or to the slot defaults.
 */
function SlotLevers({
  spec,
  name,
  defSlot,
  setSlotField,
  removeSlot,
}: {
  spec: AtomSpec;
  name: string;
  defSlot: TextSlotSpec;
  setSlotField: (name: string, field: keyof TextSlotSpec, value: unknown) => void;
  removeSlot: (name: string) => void;
}) {
  const slot = spec.textSlots?.[name];
  if (!slot) return null;
  const set = (field: keyof TextSlotSpec) => (v: unknown) => setSlotField(name, field, v);
  return (
    <>
      <ToggleRow label="Show text" value={slot.enabled} onChange={set("enabled")} />
      <Row>
        <RowLabel>Content</RowLabel>
        <TextInput
          value={slot.content}
          maxLength={80}
          onChange={(e) => setSlotField(name, "content", e.target.value)}
          aria-label={`${name} slot content`}
        />
      </Row>
      <Row>
        <RowLabel>Size mode</RowLabel>
        <div style={{ flex: 1, minWidth: 0 }}>
          <DdmSelect
            value={slot.mode}
            onChange={(v) => setSlotField(name, "mode", v === "px" ? "px" : "ratio")}
            options={[
              { key: "ratio", label: "Ratio of atom height" },
              { key: "px", label: "Fixed px" },
            ]}
            ariaLabel={`${name} slot size mode`}
            accent={PINK}
            accentRgb={PINK_RGB}
          />
        </div>
      </Row>
      {slot.mode === "ratio" ? (
        <SliderRow label="Ratio %" value={slot.ratio} min={2} max={90} defaultValue={defSlot.ratio} onChange={set("ratio")} />
      ) : (
        <SliderRow label="Size px" value={slot.px} min={6} max={200} defaultValue={defSlot.px} onChange={set("px")} />
      )}
      <SliderRow label="Weight" value={slot.weight} min={100} max={900} step={100} defaultValue={defSlot.weight} onChange={set("weight")} />
      <SliderRow label="Tracking" value={slot.tracking} min={0} max={0.3} step={0.01} defaultValue={defSlot.tracking} onChange={set("tracking")} />
      <ToggleRow label="Uppercase" value={slot.uppercase} onChange={set("uppercase")} />
      <Row>
        <RowLabel>Color</RowLabel>
        <div style={{ flex: 1, minWidth: 0 }}>
          <DdmSelect
            value={slot.colorMode}
            onChange={(v) => setSlotField(name, "colorMode", v)}
            options={[
              { key: "text", label: "Follow text color" },
              { key: "accent", label: "Follow accent" },
              { key: "solid", label: "Custom color" },
            ]}
            ariaLabel={`${name} slot color mode`}
            accent={PINK}
            accentRgb={PINK_RGB}
          />
        </div>
      </Row>
      {slot.colorMode === "solid" && (
        <ColorRow label="Custom" value={slot.color} defaultValue={defSlot.color} onChange={set("color")} />
      )}
      {slot.colorMode !== "text" && (
        <SliderRow label="Alpha" value={slot.colorAlpha} min={0} max={1} step={0.01} defaultValue={defSlot.colorAlpha} onChange={set("colorAlpha")} />
      )}
      <ClearStateBtn onClick={() => removeSlot(name)}>Remove {name} slot</ClearStateBtn>
    </>
  );
}

// ── The panel ───────────────────────────────────────────────────────────

export function AtomicEditorPanel({
  def,
  spec,
  setField,
  setStateField,
  clearState,
  setSlotField,
  addSlot,
  removeSlot,
  forcedState,
  setForcedState,
  resetAtom,
  undo,
  redo,
  canUndo,
  canRedo,
  saveState,
  label,
  sectionOpen,
  toggleSection,
  box,
  publishKey,
}: {
  def: AtomDef;
  spec: AtomSpec;
  setField: (section: keyof AtomSpec, field: string, value: unknown) => void;
  /** One state's field. The host prunes overrides equal to rest, keeping drafts sparse. */
  setStateField: (state: StateName, section: "colors" | "effects", field: string, value: unknown) => void;
  clearState: (state: StateName) => void;
  /** One named slot's field. Slots are whole objects — no pruning, a slot exists or it doesn't. */
  setSlotField: (name: string, field: keyof TextSlotSpec, value: unknown) => void;
  addSlot: (name: string) => void;
  removeSlot: (name: string) => void;
  /**
   * The state the States section is editing — held by the host because the
   * canvas has to preview it: you cannot hover a preview while dragging a
   * hover slider, so the host renders `specWithState(spec, forcedState)`.
   */
  forcedState: StateName | null;
  setForcedState: (s: StateName | null) => void;
  resetAtom: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveState: SaveState;
  /** What the header names — the atom in the library, or the node in a component. */
  label: string;
  sectionOpen: Record<string, boolean>;
  toggleSection: (key: string) => void;
  /** Rendered pixel box of the atom, for the Size readout. */
  box: { w: number; h: number };
  /**
   * The atom's key, when this spec is one a site can actually be shipped. The
   * Atom Library passes it; the Component Composer does not — a node inside a
   * composed component is not a shipped atom, so there is nothing to publish.
   */
  publishKey?: string;
}) {
  const d = def.defaults;
  // Which named slot the Text section is editing, and the name being typed
  // into the add row. Panel-local on purpose: unlike a forced state, nothing
  // has to preview a slot selection — every slot renders all the time.
  const [slotSel, setSlotSel] = React.useState<string | null>(null);
  const [newSlot, setNewSlot] = React.useState("");
  React.useEffect(() => setSlotSel(null), [def.key]);
  const slots = spec.textSlots ?? {};
  const slotNames = Object.keys(slots);
  const openSlot = slotSel && slots[slotSel] ? slotSel : null;
  const newName = newSlot.trim();
  const canAddSlot = isSlotName(newName) && !(newName in slots) && slotNames.length < SPEC_LIMITS.slots;
  const submitSlot = () => {
    if (!canAddSlot) return;
    addSlot(newName);
    setSlotSel(newName);
    setNewSlot("");
  };
  return (
    <>
      <EditorHead>
        <EditorTitle>Atomic Editor</EditorTitle>
        <EditorAtom>{label}</EditorAtom>
        {/* Drafts, not releases — this atom looks like this in Office and nowhere else. */}
        <SaveChip $state={saveState}>
          {saveState === "saving" ? "saving…" : saveState === "error" ? "save failed" : "draft saved"}
        </SaveChip>
        {publishKey && <PublishControls atomKey={publishKey} spec={spec} />}
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
              {/* Off by default: an atom is a flat surface until someone says
                  otherwise, and the second stop's controls stay out of the way
                  until they mean something. */}
              <ToggleRow label="Gradient" value={spec.colors.gradient} onChange={(v) => setField("colors", "gradient", v)} />
              {spec.colors.gradient && (
                <>
                  <ColorRow label="Fill to" value={spec.colors.fillTo} defaultValue={d.colors.fillTo} onChange={(v) => setField("colors", "fillTo", v)} />
                  <SliderRow label="Fill to alpha" value={spec.colors.fillToAlpha} min={0} max={1} step={0.01} defaultValue={d.colors.fillToAlpha} onChange={(v) => setField("colors", "fillToAlpha", v)} />
                </>
              )}
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
              {spec.colors.gradient && (
                <SliderRow label="Gradient angle" value={spec.effects.gradientAngle} min={0} max={360} defaultValue={d.effects.gradientAngle} onChange={(v) => setField("effects", "gradientAngle", v)} />
              )}
            </SectionBody>
          )}
        </Section>

        <Section>
          <SectionHead onClick={() => toggleSection("states")} aria-expanded={sectionOpen.states}>
            <SectionTitle>States</SectionTitle>
            <AddmToggle open={sectionOpen.states} />
          </SectionHead>
          {sectionOpen.states && (
            <SectionBody>
              <StateRow>
                {STATE_NAMES.map((s) => (
                  <StatePill
                    key={s}
                    $on={forcedState === s}
                    $set={!!spec.states?.[s]}
                    onClick={() => setForcedState(forcedState === s ? null : s)}
                    aria-pressed={forcedState === s}
                  >
                    {s}
                  </StatePill>
                ))}
              </StateRow>
              {forcedState ? (
                <StateLevers spec={spec} state={forcedState} setStateField={setStateField} clearState={clearState} />
              ) : (
                <IconHint>
                  Pick a state — the canvas previews it while it is selected, and
                  the levers edit only that state, sparsely: an untouched lever
                  keeps following rest. A brighter pill already carries overrides.
                </IconHint>
              )}
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

              {/* Named slots — extra runs of type, each its own whole block.
                  Independent of "Show text": the main label and the slots are
                  separate runs with separate toggles. */}
              <SubHead>Named slots</SubHead>
              {slotNames.length > 0 && (
                <SlotRow>
                  {slotNames.map((n) => (
                    <SlotPill
                      key={n}
                      $on={openSlot === n}
                      $set
                      onClick={() => setSlotSel(openSlot === n ? null : n)}
                      aria-pressed={openSlot === n}
                    >
                      {n}
                    </SlotPill>
                  ))}
                </SlotRow>
              )}
              {openSlot ? (
                <SlotLevers
                  spec={spec}
                  name={openSlot}
                  defSlot={d.textSlots?.[openSlot] ?? DEFAULT_TEXT_SLOT}
                  setSlotField={setSlotField}
                  removeSlot={(n) => {
                    removeSlot(n);
                    setSlotSel(null);
                  }}
                />
              ) : (
                <IconHint>
                  Extra runs of type on one atom — a launcher&apos;s sub-line, an
                  offer card&apos;s price. Each slot carries its own scale, weight
                  and color{slotNames.length ? " — pick a pill to edit it" : ""}.
                </IconHint>
              )}
              {slotNames.length < SPEC_LIMITS.slots && (
                <Row>
                  <TextInput
                    value={newSlot}
                    placeholder="new slot name (e.g. sub, price)"
                    maxLength={24}
                    onChange={(e) => setNewSlot(e.target.value.toLowerCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitSlot();
                    }}
                    aria-label="New slot name"
                  />
                  <ClearStateBtn onClick={submitSlot} disabled={!canAddSlot}>
                    ＋ Add
                  </ClearStateBtn>
                </Row>
              )}
              {newName.length > 0 && !canAddSlot && (
                <IconHint>
                  lowercase letters and digits, starting with a letter — and not a
                  state name, a channel name, &quot;text&quot;, or a slot that already exists
                </IconHint>
              )}
            </SectionBody>
          )}
        </Section>
      </EditorScroll>

    </>
  );
}
