"use client";
/**
 * Component Composer — the "baby editor" in the Components column.
 *
 * Composition law (Gio 2026-08-02): atoms are solitary, a COMPONENT is a group
 * of atoms. This is where the grouping happens — pull atoms out of the Atom
 * Library, place them on a canvas, style each one with the same Atomic Editor,
 * and save the result as a reusable component.
 *
 * A component is DATA (see componentDoc.ts): nodes carry their own AtomSpec and
 * a %-of-canvas position, so nothing is generated code and nothing is pinned.
 *
 * Canon: ~/.claude/vocabulary/ComponentComposer.md
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import SBDM from "@tgv/module-component-library/components/ui/SBDM";
import { colors, rgb } from "../../../theme";
import { PanelSidebarItem } from "../../../styled";
import Tooltip from "../../ui/Tooltip";
import { ATOMS, ATOM_BY_KEY, ATOM_GROUPS } from "./atomRegistry";
import { type AtomSpec, type StateName, pruneStates, specWithState } from "./atomSpec";
import {
  type ComponentDoc,
  type ComponentNode,
  clampComponentDoc,
  emptyDoc,
  slugify,
} from "./componentDoc";
import {
  AtomicEditorPanel,
  Editor,
  Row,
  RowLabel,
  SliderRow,
  ColorRow,
  ToggleRow,
  TextInput,
  labScrollbar,
  type SaveState,
} from "./AtomicEditorPanel";

const PINK = colors.pink;
const PINK_RGB = rgb.pink;

// ── Layout ──────────────────────────────────────────────────────────────

const Wrap = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
`;

const Side = styled.aside`
  flex: 0 0 250px;
  width: 250px;
  /* Without min-width the control rows' intrinsic width wins over the basis and
     the column creeps wider, squeezing the canvas stage. */
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid rgba(${PINK_RGB}, 0.16);
  background: rgba(${PINK_RGB}, 0.025);

  /* The shared editor rows reserve 84px for their label; the composer column is
     narrower than the Atomic Editor, so tighten them here. */
  label,
  span {
    min-width: 0;
  }
`;

const SideHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(${PINK_RGB}, 0.14);
`;

const SideTitle = styled.span`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(${PINK_RGB}, 0.75);
  flex: 1;
`;

const SmallBtn = styled.button`
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
  &:hover:not(:disabled) {
    background: rgba(${PINK_RGB}, 0.18);
  }
  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
`;

const SideScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  ${labScrollbar}
`;

const GroupLabel = styled.div`
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(${PINK_RGB}, 0.55);
  padding: 8px 8px 4px;
`;

const NodeRow = styled(PanelSidebarItem).attrs({ $accent: "pink" })`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const NodeKind = styled.span`
  margin-left: auto;
  font-size: 9.5px;
  font-weight: 700;
  color: rgba(${PINK_RGB}, 0.45);
`;

const EmptyHint = styled.p`
  font-size: 11px;
  line-height: 1.5;
  color: rgba(${PINK_RGB}, 0.5);
  padding: 10px 8px;
`;

// ── Stage ───────────────────────────────────────────────────────────────

const Stage = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: auto;
  padding: 40px 34px;
  ${labScrollbar}
`;

const Canvas = styled.div`
  position: relative;
  flex: none;
  margin: auto;
  border: 1px dashed rgba(${PINK_RGB}, 0.35);
  border-radius: 6px;
  overflow: hidden;
`;

const NodeBox = styled.div<{ $selected: boolean }>`
  position: absolute;
  cursor: grab;
  outline: ${(p) => (p.$selected ? `1px dashed rgba(${PINK_RGB}, 0.9)` : "none")};
  outline-offset: 4px;
  &:active {
    cursor: grabbing;
  }
`;

const CanvasLabel = styled.span`
  position: absolute;
  left: 0;
  top: -22px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(${PINK_RGB}, 0.6);
`;

const CanvasDims = styled.span`
  position: absolute;
  right: 0;
  bottom: -22px;
  font-size: 10.5px;
  font-weight: 700;
  color: rgba(${PINK_RGB}, 0.55);
  font-variant-numeric: tabular-nums;
`;

const StageWrap = styled.div`
  position: relative;
  margin: auto;
  flex: none;
`;

const CanvasPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px 12px;
  min-width: 0;
  border-bottom: 1px solid rgba(${PINK_RGB}, 0.14);

  /* Narrower label gutter than the Atomic Editor's 84px — this column is 250px. */
  & > div > span:first-child {
    flex: 0 0 66px;
  }
`;

const PanelTitle = styled.span`
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(${PINK_RGB}, 0.7);
`;

const HISTORY_MAX = 60;
const GRID_BG = (bg: string, grid: boolean) =>
  grid
    ? `radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1.4px) 0 0 / 22px 22px, ${bg}`
    : bg;

// ── View ────────────────────────────────────────────────────────────────

export default function ComponentComposer({
  docId,
  onSaved,
  onClose,
}: {
  /** Existing component to open, or null to start a new one. */
  docId?: string | null;
  onSaved?: (doc: ComponentDoc) => void;
  onClose?: () => void;
}) {
  const [doc, setDoc] = useState<ComponentDoc>(() => emptyDoc("", "New component"));
  const [selected, setSelected] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [past, setPast] = useState<ComponentDoc[]>([]);
  const [future, setFuture] = useState<ComponentDoc[]>([]);
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({
    canvas: false,
    size: true,
    colors: true,
    effects: true,
    states: true,
    text: true,
    icon: true,
  });
  // Same forced-state affordance as the Atom Library: the selected node
  // previews the state being edited, resolved through specWithState.
  const [forcedState, setForcedState] = useState<StateName | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeSeq = useRef(0);

  // Load an existing doc when one is named.
  useEffect(() => {
    if (!docId) return;
    let alive = true;
    fetch("/api/atom-lab/components")
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then((d: { docs?: ComponentDoc[] }) => {
        if (!alive) return;
        const found = d.docs?.find((x) => x.id === docId);
        if (found) {
          setDoc(clampComponentDoc(found, found.id));
          setSelected(null);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [docId]);

  /** Commit a doc change, pushing the outgoing one onto the undo stack. */
  const commit = useCallback((produce: (cur: ComponentDoc) => ComponentDoc) => {
    setDoc((cur) => {
      const next = produce(cur);
      if (JSON.stringify(next) === JSON.stringify(cur)) return cur;
      setPast((p) => [...p, cur].slice(-HISTORY_MAX));
      setFuture((f) => (f.length ? [] : f));
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setDoc((cur) => {
        setFuture((f) => [cur, ...f]);
        return prev;
      });
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0];
      setDoc((cur) => {
        setPast((p) => [...p, cur].slice(-HISTORY_MAX));
        return next;
      });
      return f.slice(1);
    });
  }, []);

  // Same binding canon as the Atom Library: cmd/ctrl+Z, cmd/ctrl+shift+Z (and
  // cmd/ctrl+Y), scoped to this surface's document, idle while typing.
  useEffect(() => {
    const d = rootRef.current?.ownerDocument ?? document;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k !== "z" && k !== "y") return;
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "TEXTAREA" || t?.isContentEditable) return;
      if (t?.tagName === "INPUT" && (t as HTMLInputElement).type === "text") return;
      e.preventDefault();
      e.stopPropagation();
      if (k === "y" || e.shiftKey) redo();
      else undo();
    };
    d.addEventListener("keydown", onKey, true);
    return () => d.removeEventListener("keydown", onKey, true);
  }, [undo, redo]);

  const addAtom = useCallback(
    (atomKey: string) => {
      const def = ATOM_BY_KEY[atomKey];
      if (!def) return;
      nodeSeq.current += 1;
      const node: ComponentNode = {
        id: `${slugify(atomKey, "atom")}-${nodeSeq.current}`,
        atomKey,
        // Starts from the atom's library defaults; the node owns its copy from here.
        spec: JSON.parse(JSON.stringify(def.defaults)) as AtomSpec,
        x: 12,
        y: 12,
        z: 0,
      };
      commit((cur) => ({
        ...cur,
        nodes: [...cur.nodes, { ...node, z: cur.nodes.length }],
      }));
      setSelected(node.id);
    },
    [commit],
  );

  const removeNode = useCallback(
    (id: string) => {
      commit((cur) => ({ ...cur, nodes: cur.nodes.filter((n) => n.id !== id) }));
      setSelected((s) => (s === id ? null : s));
    },
    [commit],
  );

  // Selecting a different node drops the forced state, same as the Atom
  // Library does when the atom changes.
  useEffect(() => setForcedState(null), [selected]);

  const setNodeField = useCallback(
    (section: keyof AtomSpec, field: string, value: unknown) => {
      if (!selected) return;
      commit((cur) => ({
        ...cur,
        nodes: cur.nodes.map((n) =>
          n.id === selected
            ? {
                ...n,
                spec: {
                  ...n.spec,
                  [section]: { ...(n.spec[section] as Record<string, unknown>), [field]: value },
                } as AtomSpec,
              }
            : n,
        ),
      }));
    },
    [commit, selected],
  );

  // Same shape and pruning as the Atom Library's setStateField — an override
  // equal to rest never lands in the doc.
  const setNodeStateField = useCallback(
    (state: StateName, section: "colors" | "effects", field: string, value: unknown) => {
      if (!selected) return;
      commit((cur) => ({
        ...cur,
        nodes: cur.nodes.map((n) =>
          n.id === selected
            ? {
                ...n,
                spec: pruneStates({
                  ...n.spec,
                  states: {
                    ...n.spec.states,
                    [state]: {
                      ...n.spec.states?.[state],
                      [section]: {
                        ...(n.spec.states?.[state]?.[section] as Record<string, unknown> | undefined),
                        [field]: value,
                      },
                    },
                  },
                } as AtomSpec),
              }
            : n,
        ),
      }));
    },
    [commit, selected],
  );

  const clearNodeState = useCallback(
    (state: StateName) => {
      if (!selected) return;
      commit((cur) => ({
        ...cur,
        nodes: cur.nodes.map((n) => {
          if (n.id !== selected || !n.spec.states?.[state]) return n;
          const states = { ...n.spec.states };
          delete states[state];
          const { states: _drop, ...rest } = n.spec;
          return { ...n, spec: Object.keys(states).length ? { ...rest, states } : (rest as AtomSpec) };
        }),
      }));
    },
    [commit, selected],
  );

  const resetNode = useCallback(() => {
    if (!selected) return;
    commit((cur) => ({
      ...cur,
      nodes: cur.nodes.map((n) =>
        n.id === selected
          ? { ...n, spec: JSON.parse(JSON.stringify(ATOM_BY_KEY[n.atomKey]?.defaults ?? n.spec)) }
          : n,
      ),
    }));
  }, [commit, selected]);

  // Drag a node around the canvas; positions stay as % so the whole component
  // scales as one piece.
  const onNodePointerDown = useCallback(
    (e: React.PointerEvent, node: ComponentNode) => {
      e.preventDefault();
      e.stopPropagation();
      setSelected(node.id);
      const frame = canvasRef.current?.getBoundingClientRect();
      if (!frame) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const originX = node.x;
      const originY = node.y;
      let moved = false;

      const onMove = (ev: PointerEvent) => {
        const dx = ((ev.clientX - startX) / frame.width) * 100;
        const dy = ((ev.clientY - startY) / frame.height) * 100;
        if (!moved && Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) return;
        moved = true;
        setDoc((cur) => ({
          ...cur,
          nodes: cur.nodes.map((n) =>
            n.id === node.id
              ? {
                  ...n,
                  x: Math.min(120, Math.max(-20, originX + dx)),
                  y: Math.min(120, Math.max(-20, originY + dy)),
                }
              : n,
          ),
        }));
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        // One history entry per drag, not per pointermove.
        if (moved) {
          setPast((p) => [...p, { ...doc }].slice(-HISTORY_MAX));
          setFuture([]);
        }
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [doc],
  );

  const save = useCallback(async () => {
    setSaveState("saving");
    try {
      const res = await fetch("/api/atom-lab/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { doc: ComponentDoc };
      setDoc(data.doc);
      setSaveState("saved");
      onSaved?.(data.doc);
      setTimeout(() => setSaveState("idle"), 1600);
    } catch {
      setSaveState("error");
    }
  }, [doc, onSaved]);

  const selectedNode = useMemo(
    () => doc.nodes.find((n) => n.id === selected) ?? null,
    [doc.nodes, selected],
  );
  const selectedDef = selectedNode ? ATOM_BY_KEY[selectedNode.atomKey] : null;

  const nodeBox = (n: ComponentNode) => ({
    w: Math.max(8, Math.round((doc.canvas.width * n.spec.size.widthPct) / 100)),
    h: Math.max(8, Math.round((doc.canvas.height * n.spec.size.heightPct) / 100)),
  });

  const atomOptions = useMemo(
    () =>
      ATOM_GROUPS.flatMap((g) =>
        ATOMS.filter((a) => a.group === g).map((a) => ({ key: a.key, label: a.name, group: g })),
      ),
    [],
  );

  const toggleSection = (k: string) => setSectionOpen((p) => ({ ...p, [k]: !p[k] }));

  return (
    <Wrap ref={rootRef}>
      <Side>
        <SideHead>
          <SideTitle>Composer</SideTitle>
          <Tooltip label="Save this component" accent={PINK}>
            <SmallBtn onClick={save} disabled={!doc.name.trim() || saveState === "saving"}>
              {saveState === "saving" ? "Saving…" : "Save"}
            </SmallBtn>
          </Tooltip>
          {onClose && (
            <Tooltip label="Back to the components list" accent={PINK}>
              <SmallBtn onClick={onClose}>Close</SmallBtn>
            </Tooltip>
          )}
        </SideHead>

        <CanvasPanel>
          <PanelTitle>Component</PanelTitle>
          <Row>
            <RowLabel>Name</RowLabel>
            <TextInput
              value={doc.name}
              maxLength={60}
              onChange={(e) => commit((cur) => ({ ...cur, name: e.target.value }))}
              aria-label="Component name"
            />
          </Row>
          <Row>
            <RowLabel>Add atom</RowLabel>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SBDM
                items={atomOptions}
                onSelect={addAtom}
                triggerLabel="Add an atom…"
                placeholder="Add an atom…"
                searchPlaceholder={`Search ${ATOMS.length} atoms…`}
                ariaLabel="Add an atom to this component"
                minTriggerWidth={0}
              />
            </div>
          </Row>
          <SliderRow label="Canvas W" value={doc.canvas.width} min={160} max={1600} defaultValue={640} onChange={(v) => commit((cur) => ({ ...cur, canvas: { ...cur.canvas, width: v } }))} />
          <SliderRow label="Canvas H" value={doc.canvas.height} min={120} max={1200} defaultValue={420} onChange={(v) => commit((cur) => ({ ...cur, canvas: { ...cur.canvas, height: v } }))} />
          <ColorRow label="Background" value={doc.canvas.bg} defaultValue="#0b0d13" onChange={(v) => commit((cur) => ({ ...cur, canvas: { ...cur.canvas, bg: v } }))} />
          <ToggleRow label="Dot grid" value={doc.canvas.grid} onChange={(v) => commit((cur) => ({ ...cur, canvas: { ...cur.canvas, grid: v } }))} />
        </CanvasPanel>

        <SideScroll>
          <GroupLabel>Atoms in this component · {doc.nodes.length}</GroupLabel>
          {doc.nodes.length === 0 && (
            <EmptyHint>
              Empty. Add atoms above — a component is a group of them. Drag each one on the canvas,
              and the Atomic Editor styles whichever is selected.
            </EmptyHint>
          )}
          {doc.nodes
            .slice()
            .sort((a, b) => b.z - a.z)
            .map((n) => (
              <NodeRow key={n.id} $active={selected === n.id} onClick={() => setSelected(n.id)}>
                <span>{ATOM_BY_KEY[n.atomKey]?.name ?? n.atomKey}</span>
                <NodeKind
                  role="button"
                  title="Remove from this component"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeNode(n.id);
                  }}
                >
                  ✕
                </NodeKind>
              </NodeRow>
            ))}
        </SideScroll>
      </Side>

      <Stage>
        <StageWrap>
          <CanvasLabel>{doc.name || "New component"}</CanvasLabel>
          <Canvas
            ref={canvasRef}
            style={{
              width: doc.canvas.width,
              height: doc.canvas.height,
              background: GRID_BG(doc.canvas.bg, doc.canvas.grid),
            }}
            onPointerDown={() => setSelected(null)}
          >
            {doc.nodes
              .slice()
              .sort((a, b) => a.z - b.z)
              .map((n) => {
                const def = ATOM_BY_KEY[n.atomKey];
                if (!def) return null;
                const Render = def.Render;
                // Only the SELECTED node previews the forced state — the rest
                // of the composition stays at rest, which is what a real
                // pointer would do.
                const shown =
                  forcedState && selected === n.id ? specWithState(n.spec, forcedState) : n.spec;
                return (
                  <NodeBox
                    key={n.id}
                    $selected={selected === n.id}
                    style={{ left: `${n.x}%`, top: `${n.y}%`, zIndex: n.z + 1 }}
                    onPointerDown={(e) => onNodePointerDown(e, n)}
                  >
                    <Render spec={shown} box={nodeBox(n)} />
                  </NodeBox>
                );
              })}
          </Canvas>
          <CanvasDims>
            {doc.canvas.width} × {doc.canvas.height} · {doc.nodes.length} atoms
          </CanvasDims>
        </StageWrap>
      </Stage>

      <Editor>
        {selectedNode && selectedDef ? (
          <AtomicEditorPanel
            def={selectedDef}
            spec={selectedNode.spec}
            setField={setNodeField}
            setStateField={setNodeStateField}
            clearState={clearNodeState}
            forcedState={forcedState}
            setForcedState={setForcedState}
            resetAtom={resetNode}
            undo={undo}
            redo={redo}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            saveState={saveState}
            label={selectedDef.name}
            sectionOpen={sectionOpen}
            toggleSection={toggleSection}
            box={nodeBox(selectedNode)}
          />
        ) : (
          <EmptyHint>
            Select an atom on the canvas to open the Atomic Editor on it. Each atom in a component
            keeps its own styling.
          </EmptyHint>
        )}
      </Editor>
    </Wrap>
  );
}
