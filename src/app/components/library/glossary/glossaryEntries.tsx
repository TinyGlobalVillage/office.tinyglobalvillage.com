"use client";
/**
 * Glossary entries — Library → Glossary.
 *
 * These are EXPLAINERS, not building blocks: named concepts you're being
 * taught, illustrated with a mock demo. They used to sit in the Sandbox's
 * Components column because the project rule says a new vocabulary term gets a
 * SandboxEntry + Demo — but under the composition law (an atom is solitary, a
 * component is a group of atoms; ~/.claude/vocabulary/Atom.md) neither is
 * something you compose with, and a list of things you assemble is the wrong
 * place to explain a data model. Moved here 2026-08-02 on Gio's call.
 *
 * A new vocabulary term that describes a CONCEPT belongs here. A new term that
 * is a real atom or a real group of atoms belongs in the Sandbox.
 */
import React from "react";
import styled from "styled-components";
import { colors, rgb } from "../../../theme";

const PINK = colors.pink;
const PINK_RGB = rgb.pink;

export type GlossaryEntry = {
  key: string;
  /** Short form as it appears in conversation ("GLC"). */
  term: string;
  name: string;
  summary: string;
  usage: string;
  /** Where the real thing lives, so the entry points instead of duplicating. */
  canonical: string;
  Demo: React.FC;
};

// ── Demo chrome ─────────────────────────────────────────────────────────

const DemoWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
`;

const HighlightWrap = styled.div`
  position: relative;
  display: inline-flex;
  padding: 8px;
  border-radius: 12px;
  border: 1px dashed rgba(${PINK_RGB}, 0.55);
  box-shadow: 0 0 22px rgba(${PINK_RGB}, 0.28), inset 0 0 12px rgba(${PINK_RGB}, 0.08);
  background: rgba(${PINK_RGB}, 0.04);
`;

const HighlightLabel = styled.span`
  position: absolute;
  top: -9px;
  left: 10px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 1px 6px;
  background: rgba(6, 8, 12, 1);
  color: ${PINK};
  border: 1px solid rgba(${PINK_RGB}, 0.5);
  border-radius: 4px;

  [data-theme="light"] & {
    background: var(--t-surface);
  }
`;

function Highlight({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <HighlightWrap>
      {label && <HighlightLabel>{label}</HighlightLabel>}
      {children}
    </HighlightWrap>
  );
}

const Caption = styled.p`
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--t-textMuted, rgba(255, 255, 255, 0.6));
  max-width: 34rem;
  text-align: center;
  margin: 0;
`;

// ── Demo styles (lifted verbatim from the sandbox registry) ─────────────

const GlcStage = styled.div`
  position: relative;
  /* Every child is absolutely positioned, so the stage has no intrinsic width —
     it relied on the sandbox cell to stretch it. Sized here: the group ends at
     162px and the 130px tree sits 10px off the right edge. */
  width: 330px;
  height: 150px;
  border: 1px solid rgba(0, 228, 253, 0.25);
  border-radius: 10px;
  overflow: hidden;
  background-image: radial-gradient(circle, rgba(0, 228, 253, 0.18) 1px, transparent 1.4px);
  background-size: 14px 14px;
`;

const GlcGroup = styled.div`
  position: absolute;
  left: 12px;
  top: 12px;
  width: 150px;
  height: 118px;
  border: 1px solid rgba(0, 228, 253, 0.3);
  border-radius: 8px;
`;

const GlcText = styled.div`
  position: absolute;
  left: 14px;
  font-size: 10px;
  color: rgba(234, 247, 250, 0.9);
`;

const GlcSelected = styled.div`
  position: absolute;
  left: 14px;
  bottom: 12px;
  padding: 5px 14px;
  font-size: 10px;
  font-weight: 700;
  border-radius: 99px;
  color: #bff4ff;
  border: 1px dashed rgba(0, 228, 253, 0.9);
  background: rgba(0, 228, 253, 0.1);
`;

const GlcTree = styled.div`
  position: absolute;
  right: 10px;
  top: 10px;
  width: 130px;
  display: grid;
  gap: 3px;
  font-size: 9px;
  color: rgba(0, 228, 253, 0.85);

  span {
    padding: 2px 6px;
    border-radius: 5px;
    border: 1px solid rgba(0, 228, 253, 0.2);
  }
  span.sel {
    background: rgba(0, 228, 253, 0.12);
    border-color: rgba(0, 228, 253, 0.5);
  }
`;

const CsStage = styled.div`
  position: relative;
  width: 300px;
  height: 170px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.14);
  overflow: hidden;
`;

const CsCanvasHint = styled.span`
  position: absolute;
  top: 8px;
  left: 10px;
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.25);
`;

const CsSnapEdge = styled.div<{ $accent: string }>`
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 6px;
  background: color-mix(in srgb, ${(p) => p.$accent} 55%, transparent);
  box-shadow: 0 0 12px color-mix(in srgb, ${(p) => p.$accent} 60%, transparent);
`;

const CsPanel = styled.div<{ $accent: string }>`
  position: absolute;
  top: 12px;
  right: 14px;
  width: 158px;
  border-radius: 8px;
  background: color-mix(in srgb, ${(p) => p.$accent} 6%, #05060a 94%);
  border: 1px solid color-mix(in srgb, ${(p) => p.$accent} 40%, transparent);
  box-shadow: 0 0 16px color-mix(in srgb, ${(p) => p.$accent} 18%, transparent);
  overflow: hidden;
`;

const CsPanelHeader = styled.div<{ $accent: string }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${(p) => p.$accent};
  border-bottom: 1px solid color-mix(in srgb, ${(p) => p.$accent} 25%, transparent);
  cursor: grab;
`;

const CsFieldRow = styled.div<{ $accent: string }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  font-size: 10px;
  color: color-mix(in srgb, ${(p) => p.$accent} 70%, #ffffff 30%);
`;

const CsDdm = styled.span<{ $accent: string }>`
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 9px;
  background: color-mix(in srgb, ${(p) => p.$accent} 14%, transparent);
  border: 1px solid color-mix(in srgb, ${(p) => p.$accent} 45%, transparent);
  color: ${(p) => p.$accent};
`;

// ── Demos ───────────────────────────────────────────────────────────────

function GlcDemo() {
  return (
    <DemoWrap>
      <Highlight label="GLC">
        <GlcStage>
          <GlcGroup>
            <GlcText style={{ top: 10, fontWeight: 700 }}>Heading layer</GlcText>
            <GlcText style={{ top: 28, opacity: 0.7 }}>Body layer…</GlcText>
            <GlcSelected>Button layer ⇱</GlcSelected>
          </GlcGroup>
          <GlcTree>
            <span>▾ GROUP · Card</span>
            <span style={{ marginLeft: 10 }}>TEXT · Heading</span>
            <span style={{ marginLeft: 10 }}>TEXT · Body</span>
            <span className="sel" style={{ marginLeft: 10 }}>BUTTON · CTA ⇱ ✕</span>
          </GlcTree>
        </GlcStage>
      </Highlight>
      <Caption>
        A section is a tree of typed layers inside a fixed-height frame — nudging a child never
        grows the parent.
      </Caption>
    </DemoWrap>
  );
}

function CanvasSettingsDemo() {
  const accent = "#ff4ecb";
  return (
    <DemoWrap>
      <Highlight label="Canvas Settings">
        <CsStage>
          <CsCanvasHint>canvas</CsCanvasHint>
          <CsSnapEdge $accent={accent} />
          <CsPanel $accent={accent}>
            <CsPanelHeader $accent={accent}>
              <span>Canvas Settings</span>
              <span>&#x2304;</span>
            </CsPanelHeader>
            <CsFieldRow $accent={accent}>
              <span>Fill</span>
              <CsDdm $accent={accent}>accent &#x25BE;</CsDdm>
            </CsFieldRow>
            <CsFieldRow $accent={accent}>
              <span>Border</span>
              <CsDdm $accent={accent}>solid &#x25BE;</CsDdm>
            </CsFieldRow>
          </CsPanel>
        </CsStage>
      </Highlight>
      <Caption>
        Collapsible, draggable canvas-mode settings drawer — the dock edge highlights before snap,
        and tooltips always render away from the snapped edge.
      </Caption>
    </DemoWrap>
  );
}

// ── Entries ─────────────────────────────────────────────────────────────

export const GLOSSARY: GlossaryEntry[] = [
  {
    key: "GroupedLayerComponents",
    term: "GLC",
    name: "Grouped Layer-Components",
    summary:
      "The page editor's atomic engine: a section is a tree of typed layers (text/image/shape/button/media/embed/group) with per-breakpoint absolute boxes inside a FIXED-height frame — nudging a child never grows the parent. Every layer carries the Content | Style pill with the ten style ADDMs (color/font/character/paragraph/padding/margin/rotation/axis/size/effects incl. hover diffs, single on-click action, on-enter animation).",
    usage:
      "This is the page editor's data model, not a control you place. It is the same law the Sandbox follows — small pieces group into one thing — expressed in the editor: each LayerNode is an atom, the group is the component. Meet it in the page editor: Add section → any category → Grouped Elements tab → pick an (Atomic) entry.",
    canonical: "~/.claude/vocabulary/GroupedLayerComponents.md · @tgv/module-page-editor",
    Demo: GlcDemo,
  },
  {
    key: "CanvasSettings",
    term: "CS",
    name: "Canvas Settings",
    summary:
      "The canvas-mode style/toggle panel as a collapsible, draggable, side-dockable drawer: edge highlights before snap, DDM-themed dropdowns, and dock-aware tooltips that always render toward the canvas rather than off the snapped edge.",
    usage:
      "A behaviour pattern for editor chrome, not a component you drop into a page. The same drawer behaviour governs the Canvas Toolbar, Layers and the Arrange Bar — read it before building any new dockable editor panel so they all move the same way.",
    canonical: "~/.claude/vocabulary/CanvasSettings.md",
    Demo: CanvasSettingsDemo,
  },
];
