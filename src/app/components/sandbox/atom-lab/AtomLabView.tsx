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
import { colors, rgb } from "../../../theme";
import { PanelSidebarItem } from "../../../styled";
import Tooltip from "../../ui/Tooltip";
import { type AtomSpec, clampSpec } from "./atomSpec";
import { ATOMS, ATOM_BY_KEY, ATOM_GROUPS, type AtomDef } from "./atomRegistry";
import { AtomicEditorPanel, Editor, HeaderDdmWrap, type SaveState } from "./AtomicEditorPanel";

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
  const [saveState, setSaveState] = useState<SaveState>("idle");
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

  const Render = def.Render;

  // Every sandbox drawer sorts its groups AND their rows A-Z (Gio 2026-08-02).
  const sortedGroups = useMemo(
    () => [...ATOM_GROUPS].sort((a, b) => a.localeCompare(b)),
    [],
  );

  const ddmOptions = useMemo(
    () =>
      sortedGroups.flatMap((g) =>
        ATOMS.filter((a) => a.group === g)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((a) => ({ key: a.key, label: a.name, group: g as string })),
      ),
    [sortedGroups],
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
            {sortedGroups.map((g) => {
              const items = ATOMS.filter((a) => a.group === g).sort((a, b) =>
                a.name.localeCompare(b.name),
              );
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
        <AtomicEditorPanel
          def={def}
          spec={spec}
          setField={setField}
          resetAtom={resetAtom}
          undo={undo}
          redo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          saveState={saveState}
          label={def.name}
          sectionOpen={sectionOpen}
          toggleSection={toggleSection}
          box={box}
        />
      </Editor>
    </Wrap>
  );
}
