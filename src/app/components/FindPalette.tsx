"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styled from "styled-components";
import ModalRoot from "./ModalRoot";
import { ModalContainer, Input } from "../styled";
import { colors, rgb, type GlowColor } from "../theme";
import { useModalLifecycle } from "../lib/drawerKnobs";
import { pushTileUrl } from "../lib/tileUrl";
import {
  OFFICE_CHILDREN,
  OFFICE_TILES,
  TILE_GROUPS,
  dispatchTileAction,
  tileMatchScore,
  type OfficeTileAction,
  type OfficeTileGroup,
} from "./dashboardTiles";

/**
 * Find (Gio 2026-11-02): "cmd/ctrl + F to find what's on the office easily,
 * with full accessibility using my keyboard arrow keys and enter."
 *
 * One box over everything, on every Office page. It indexes the surfaces the
 * dashboard already knows — every tile in OFFICE_TILES and every child in
 * OFFICE_CHILDREN (drawer tabs, Utils modals, Villagers tiles, Library
 * shelves …) — scored by tileMatchScore so it ranks exactly like the
 * dashboard's own search box. It finds PLACES by name; it does not search the
 * text on the page, which is why the browser's find-again stays on cmd+G.
 *
 * Keys: cmd/ctrl+F opens (one metaKey||ctrlKey check, never while typing in a
 * field), ↑/↓ move, Home/End jump, Enter opens, Esc closes. Focus never leaves
 * the input — the active row is announced through aria-activedescendant.
 *
 * Opening: drawer and event tiles dispatch straight through dispatchTileAction
 * (their hosts live in the shell, so they work from any page). Page tiles are
 * the dashboard's modals: on /dashboard we push the ?tile= URL and let the
 * dashboard's popstate sync open it; anywhere else we navigate there.
 */

type FindEntry = {
  id: string;
  title: string;
  subtitle: string;
  glow: GlowColor;
  group: OfficeTileGroup | undefined;
  /** The tile this entry opens (itself, or its parent). */
  action: OfficeTileAction;
  /** Sub-surface inside the tile, for children. */
  detail?: string;
  /** Parent title, for the "in X" prefix and for grouping under it. */
  parentTitle?: string;
  parentKey: string;
};

function buildIndex(): FindEntry[] {
  const out: FindEntry[] = [];
  for (const t of OFFICE_TILES) {
    out.push({
      id: `tile:${t.key}`,
      title: t.title,
      subtitle: t.subtitle,
      glow: t.glow,
      group: t.group,
      action: t.action,
      parentKey: t.key,
    });
  }
  for (const c of OFFICE_CHILDREN) {
    const parent = OFFICE_TILES.find((t) => t.key === c.parent);
    if (!parent) continue;
    out.push({
      id: `child:${c.key}`,
      title: c.title,
      subtitle: c.subtitle,
      glow: parent.glow,
      group: parent.group,
      action: parent.action,
      detail: c.detail,
      parentTitle: parent.title,
      parentKey: parent.key,
    });
  }
  return out;
}

const groupRank = (g: OfficeTileGroup | undefined) => {
  const i = g ? TILE_GROUPS.indexOf(g) : -1;
  return i === -1 ? TILE_GROUPS.length : i;
};

/** Idle order: group → parent tile (alphabetical) → the tile, then its children. */
function idleOrder(a: FindEntry, b: FindEntry): number {
  const g = groupRank(a.group) - groupRank(b.group);
  if (g !== 0) return g;
  const pa = a.parentTitle ?? a.title;
  const pb = b.parentTitle ?? b.title;
  if (pa !== pb) return pa.localeCompare(pb);
  if (!a.parentTitle !== !b.parentTitle) return a.parentTitle ? 1 : -1;
  return a.title.localeCompare(b.title);
}

function isTypingTarget(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
}

export const FIND_OPEN_EVENT = "tgv-find-open";

export default function FindPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const index = useMemo(buildIndex, []);

  const results = useMemo(() => {
    const searching = query.trim().length > 0;
    const scored = index
      .map((e) => ({ e, score: tileMatchScore(e, query) }))
      .filter((r): r is { e: FindEntry; score: number } => r.score !== null);
    if (!searching) return scored.map((r) => r.e).sort(idleOrder);
    return scored
      .sort((a, b) => b.score - a.score || a.e.title.localeCompare(b.e.title))
      .map((r) => r.e);
  }, [index, query]);

  // A new result set resets the cursor to the best match.
  useEffect(() => { setActive(0); }, [query]);

  const close = useCallback(() => setOpen(false), []);

  const openEntry = useCallback((e: FindEntry) => {
    setOpen(false);
    if ("page" in e.action) {
      const page = e.action.page;
      if (pathname === "/dashboard") {
        pushTileUrl(page, e.detail);
        // The dashboard opens page tiles from the URL on popstate.
        window.dispatchEvent(new PopStateEvent("popstate"));
      } else {
        const params = new URLSearchParams({ tile: page });
        if (e.detail) params.set("view", e.detail);
        router.push(`/dashboard?${params.toString()}`);
      }
      return;
    }
    dispatchTileAction(e.action, e.detail);
  }, [pathname, router]);

  // cmd/ctrl+F opens (capture phase on the document, so a modal that swallows
  // keys underneath never sees it); a `tgv-find-open` event opens it too.
  useEffect(() => {
    const doc = anchorRef.current?.ownerDocument ?? document;
    const onKey = (ev: KeyboardEvent) => {
      if (!(ev.metaKey || ev.ctrlKey) || ev.altKey || ev.shiftKey) return;
      if (ev.key !== "f" && ev.key !== "F") return;
      if (isTypingTarget(ev.target) && ev.target !== inputRef.current) return;
      ev.preventDefault();
      ev.stopPropagation();
      setOpen(true);
      inputRef.current?.select();
    };
    const onOpen = () => setOpen(true);
    doc.addEventListener("keydown", onKey, true);
    doc.defaultView?.addEventListener(FIND_OPEN_EVENT, onOpen);
    return () => {
      doc.removeEventListener("keydown", onKey, true);
      doc.defaultView?.removeEventListener(FIND_OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Keep the active row on screen as the cursor moves.
  useEffect(() => {
    if (!open) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onInputKey = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    const n = results.length;
    switch (ev.key) {
      case "ArrowDown":
        ev.preventDefault();
        if (n) setActive((i) => (i + 1) % n);
        return;
      case "ArrowUp":
        ev.preventDefault();
        if (n) setActive((i) => (i - 1 + n) % n);
        return;
      case "Home":
        ev.preventDefault();
        setActive(0);
        return;
      case "End":
        ev.preventDefault();
        setActive(Math.max(0, n - 1));
        return;
      case "PageDown":
        ev.preventDefault();
        setActive((i) => Math.min(n - 1, i + 8));
        return;
      case "PageUp":
        ev.preventDefault();
        setActive((i) => Math.max(0, i - 8));
        return;
      case "Enter": {
        ev.preventDefault();
        const hit = results[active];
        if (hit) openEntry(hit);
        return;
      }
      default:
        return;
    }
  };

  return (
    <>
      <span ref={anchorRef} hidden aria-hidden="true" />
      {open && <Palette
        query={query}
        setQuery={setQuery}
        results={results}
        active={active}
        setActive={setActive}
        onInputKey={onInputKey}
        openEntry={openEntry}
        close={close}
        inputRef={inputRef}
        listRef={listRef}
      />}
    </>
  );
}

type PaletteProps = {
  query: string;
  setQuery: (q: string) => void;
  results: FindEntry[];
  active: number;
  setActive: (i: number) => void;
  onInputKey: (ev: React.KeyboardEvent<HTMLInputElement>) => void;
  openEntry: (e: FindEntry) => void;
  close: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  listRef: React.RefObject<HTMLDivElement | null>;
};

function Palette(p: PaletteProps) {
  // Counts as a modal: the drawer controller leaves Esc to us while we are up.
  useModalLifecycle();
  const activeId = p.results[p.active] ? `find-opt-${p.results[p.active].id}` : undefined;
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <ModalRoot onClose={p.close} style={{ zIndex: 12100, alignItems: "flex-start", paddingTop: "10vh" }}>
      <ModalContainer
        $accent="cyan"
        $maxWidth="38rem"
        data-tgv-modal=""
        role="dialog"
        aria-modal="true"
        aria-label="Find in Office"
        style={{ maxHeight: "70vh" }}
      >
        <Head>
          <Input
            ref={p.inputRef}
            $accent="cyan"
            value={p.query}
            onChange={(e) => p.setQuery(e.target.value)}
            onKeyDown={p.onInputKey}
            placeholder="Find anything in Office…"
            aria-label="Find in Office"
            role="combobox"
            aria-expanded="true"
            aria-controls="find-listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            autoComplete="off"
            spellCheck={false}
          />
          <Kbd aria-hidden="true">{isMac ? "⌘F" : "Ctrl F"}</Kbd>
        </Head>
        <List ref={p.listRef} id="find-listbox" role="listbox" aria-label="Office surfaces">
          {p.results.length === 0 && <Empty>Nothing named like that. Try a tile, a drawer tab, or a Utils tool.</Empty>}
          {p.results.map((e, i) => (
            <Row
              key={e.id}
              id={`find-opt-${e.id}`}
              data-index={i}
              role="option"
              aria-selected={i === p.active}
              $active={i === p.active}
              $glow={e.glow}
              onMouseMove={() => { if (i !== p.active) p.setActive(i); }}
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => p.openEntry(e)}
            >
              <Dot $glow={e.glow} aria-hidden="true" />
              <Text>
                <Title>
                  {e.parentTitle && <Crumb>{e.parentTitle} ›</Crumb>}
                  {e.title}
                </Title>
                <Sub>{e.subtitle}</Sub>
              </Text>
              {e.group && <Group>{e.group}</Group>}
            </Row>
          ))}
        </List>
        <Foot aria-hidden="true">
          <span><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
          <span><Kbd>↵</Kbd> open</span>
          <span><Kbd>esc</Kbd> close</span>
          <Count>{p.results.length} place{p.results.length === 1 ? "" : "s"}</Count>
        </Foot>
      </ModalContainer>
    </ModalRoot>
  );
}

/* ── styles — theme tokens only ─────────────────────────────────── */

const Head = styled.div`
  position: relative;
  padding: 0.875rem 0.875rem 0.5rem;
  flex-shrink: 0;
  & > input { padding-right: 4.5rem; font-size: 1rem; }
`;

const Kbd = styled.kbd`
  display: inline-block;
  padding: 0.1rem 0.4rem;
  border-radius: 0.3rem;
  border: 1px solid var(--t-border);
  background: var(--t-inputBg);
  color: var(--t-textFaint);
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.65rem;
  line-height: 1.2;
  ${Head} > & {
    position: absolute;
    right: 1.5rem;
    top: 50%;
    transform: translateY(-15%);
  }
`;

const List = styled.div`
  overflow-y: auto;
  padding: 0.25rem 0.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1px;
  scroll-padding: 0.5rem;
`;

const Row = styled.div<{ $active: boolean; $glow: GlowColor }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb[p.$glow]}, 0.35)` : "transparent")};
  background: ${(p) => (p.$active ? `rgba(${rgb[p.$glow]}, 0.12)` : "transparent")};
  transition: background 0.1s, border-color 0.1s;
`;

const Dot = styled.span<{ $glow: GlowColor }>`
  flex-shrink: 0;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: ${(p) => colors[p.$glow]};
  box-shadow: 0 0 8px rgba(${(p) => rgb[p.$glow]}, 0.6);
`;

const Text = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
`;

const Title = styled.div`
  font-size: 0.875rem;
  color: var(--t-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Crumb = styled.span`
  color: var(--t-textFaint);
  margin-right: 0.35rem;
`;

const Sub = styled.div`
  font-size: 0.7rem;
  color: var(--t-textMuted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Group = styled.span`
  flex-shrink: 0;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.6rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--t-textGhost);
`;

const Empty = styled.div`
  padding: 1.25rem 0.75rem;
  font-size: 0.8rem;
  color: var(--t-textMuted);
`;

const Foot = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.875rem;
  border-top: 1px solid var(--t-border);
  font-size: 0.65rem;
  color: var(--t-textFaint);
  & kbd { margin-right: 0.3rem; }
`;

const Count = styled.span`
  margin-left: auto;
  font-family: var(--font-geist-mono), monospace;
`;
