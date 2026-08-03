"use client";
/**
 * Templates drawer — the Templates view's file column, same harness as the
 * Components column: ADDM accordion groups, a collapse rail, and a header DDM
 * carrying the selection when collapsed.
 *
 * Groups are the template's CATEGORY, nothing else (Gio 2026-08-02). Status —
 * drafts, submissions, publish — deliberately does NOT live here; it belongs to
 * the template editor's switcher DDM. New categories are created right in this
 * drawer as empty groups, and templates are dragged into them (which PATCHes
 * the template's category, the real source of truth).
 *
 * "Dashboard" is its own group at the top: the global villager dashboard,
 * edited in the TGV page editor in a new tab, exactly like Modules launches it.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import AddmToggle from "@tgv/module-component-library/components/ui/AddmToggle";
import DdmSelect from "@tgv/module-component-library/components/ui/DdmSelect";
import { colors, rgb } from "../../theme";
import { PanelSidebarItem } from "../../styled";
import Tooltip from "../ui/Tooltip";

const PINK = colors.pink;
const PINK_RGB = rgb.pink;

export type TemplateRow = {
  templateId: string;
  label: string;
  category: string;
  status: string;
};

const UNCATEGORIZED = "Uncategorized";

/** The global villager dashboard, edited in the TGV page editor (new tab). */
export function openModuleDashboardEditor() {
  const fallbackBase = process.env.NEXT_PUBLIC_TGV_URL ?? "https://tinyglobalvillage.com";
  let cfg = { lang: "en", base: fallbackBase };
  try {
    const raw = localStorage.getItem("tgv-module-dashboard-cfg");
    if (raw) {
      const c = JSON.parse(raw);
      cfg = {
        lang: typeof c.lang === "string" && c.lang ? c.lang : cfg.lang,
        base: typeof c.base === "string" && c.base ? c.base : cfg.base,
      };
    }
  } catch {
    /* malformed cfg — fall back */
  }
  window.open(
    `${cfg.base}/${encodeURIComponent(cfg.lang)}/editor/module-dashboard?popout=1`,
    "_blank",
  );
}

export default function TemplateDrawer({
  templates,
  loading,
  error,
  activeId,
  onSelect,
  onCategoryChanged,
  headerSlot,
}: {
  templates: TemplateRow[];
  loading: boolean;
  error: string | null;
  activeId: string | null;
  onSelect: (templateId: string) => void;
  /** Fired after a drag re-files a template so the host can refetch. */
  onCategoryChanged: () => void;
  /** Where the collapsed drawer portals its picker DDM. */
  headerSlot?: HTMLElement | null;
}) {
  const [open, setOpen] = useState(true);
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const [extraCats, setExtraCats] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropCat, setDropCat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCats = useCallback(() => {
    fetch("/api/editor/template-categories")
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d: { categories?: string[] }) => setExtraCats(d.categories ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadCats();
  }, [loadCats]);

  // Category groups = every category a template actually carries, plus the
  // empty ones a staffer created here that nothing has been dragged into yet.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) set.add(t.category?.trim() || UNCATEGORIZED);
    for (const c of extraCats) set.add(c);
    return [...set].sort((a, b) =>
      a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : a.localeCompare(b),
    );
  }, [templates, extraCats]);

  const byCategory = useMemo(() => {
    const m: Record<string, TemplateRow[]> = {};
    for (const c of categories) m[c] = [];
    for (const t of templates) (m[t.category?.trim() || UNCATEGORIZED] ??= []).push(t);
    return m;
  }, [categories, templates]);

  const addCategory = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch("/api/editor/template-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const d = (await res.json()) as { categories: string[] };
        setExtraCats(d.categories);
        setGroupOpen((g) => ({ ...g, [name]: true }));
      }
    } finally {
      setBusy(false);
      setNewName("");
      setAdding(false);
    }
  }, [newName]);

  // Dropping a template on a group header re-files it: the DB column is the
  // real category, so this PATCHes the template rather than tracking it here.
  const assign = useCallback(
    async (templateId: string, category: string) => {
      setBusy(true);
      try {
        const res = await fetch(
          `/api/editor/shared-templates/${encodeURIComponent(templateId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category: category === UNCATEGORIZED ? "" : category }),
          },
        );
        if (res.ok) onCategoryChanged();
      } finally {
        setBusy(false);
        setDragId(null);
        setDropCat(null);
      }
    },
    [onCategoryChanged],
  );

  const ddmOptions = useMemo(
    () => [
      { key: "__dashboard", label: "Dashboard (villager)", group: "Dashboard" },
      ...templates.map((t) => ({
        key: t.templateId,
        label: t.label,
        group: t.category?.trim() || UNCATEGORIZED,
      })),
    ],
    [templates],
  );

  if (!open) {
    return (
      <>
        {headerSlot &&
          createPortal(
            <HeaderDdmWrap>
              <DdmSelect
                value={activeId ?? ""}
                onChange={(k) => (k === "__dashboard" ? openModuleDashboardEditor() : onSelect(k))}
                options={ddmOptions}
                ariaLabel="Pick a template"
                accent={PINK}
                accentRgb={PINK_RGB}
              />
            </HeaderDdmWrap>,
            headerSlot,
          )}
        <Tooltip label="Expand templates panel" accent={PINK}>
          <Rail onClick={() => setOpen(true)} aria-label="Expand templates panel">
            <RailGlyph>›</RailGlyph>
            <RailLabel>Templates</RailLabel>
          </Rail>
        </Tooltip>
      </>
    );
  }

  return (
    <Drawer>
      <Head>
        <HeadTitle>Templates</HeadTitle>
        <HeadCount>{loading ? "…" : templates.length}</HeadCount>
        <Tooltip label="Collapse to header menu" accent={PINK}>
          <CollapseBtn onClick={() => setOpen(false)} aria-label="Collapse templates panel">
            ‹
          </CollapseBtn>
        </Tooltip>
      </Head>

      <Scroll>
        {/* Dashboard — its own group, nothing else in it. */}
        <Group>
          <GroupHead
            onClick={() => setGroupOpen((g) => ({ ...g, __dash: !(g.__dash ?? true) }))}
            aria-expanded={groupOpen.__dash ?? true}
          >
            <GroupLabel>Dashboard</GroupLabel>
            <GroupCount>1</GroupCount>
            <AddmToggle open={groupOpen.__dash ?? true} />
          </GroupHead>
          {(groupOpen.__dash ?? true) && (
            <Items>
              <Tooltip label="Opens the TGV page editor in a new tab" accent={PINK}>
                <Item onClick={openModuleDashboardEditor}>
                  <ItemRow>
                    <ItemLabel>Villager Dashboard</ItemLabel>
                    <ItemSub>module-dashboard · opens in a new tab ↗</ItemSub>
                  </ItemRow>
                </Item>
              </Tooltip>
            </Items>
          )}
        </Group>

        {error && <Hint>Failed to load: {error}</Hint>}
        {!error && !loading && templates.length === 0 && <Hint>No templates yet.</Hint>}

        {categories.map((cat) => {
          const items = byCategory[cat] ?? [];
          const isOpen = groupOpen[cat] ?? true;
          return (
            <Group
              key={cat}
              $dropping={dropCat === cat}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setDropCat(cat);
              }}
              onDragLeave={() => setDropCat((c) => (c === cat ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) assign(dragId, cat);
              }}
            >
              <GroupHead
                onClick={() => setGroupOpen((g) => ({ ...g, [cat]: !isOpen }))}
                aria-expanded={isOpen}
              >
                <GroupLabel>{cat}</GroupLabel>
                <GroupCount>{items.length}</GroupCount>
                <AddmToggle open={isOpen} />
              </GroupHead>
              {isOpen && (
                <Items>
                  {items.length === 0 && <EmptyGroup>Drag a template here</EmptyGroup>}
                  {items.map((t) => (
                    <Item
                      key={t.templateId}
                      $active={activeId === t.templateId}
                      draggable
                      onDragStart={() => setDragId(t.templateId)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDropCat(null);
                      }}
                      onClick={() => onSelect(t.templateId)}
                    >
                      <ItemRow>
                        <ItemLabel>{t.label}</ItemLabel>
                        <ItemSub $active={activeId === t.templateId}>
                          {t.status === "sandbox" ? "draft" : t.status}
                        </ItemSub>
                      </ItemRow>
                    </Item>
                  ))}
                </Items>
              )}
            </Group>
          );
        })}

        {adding ? (
          <NewCatRow>
            <NewCatInput
              autoFocus
              value={newName}
              maxLength={60}
              placeholder="Category name…"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCategory();
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setAdding(false);
                  setNewName("");
                }
              }}
            />
            <NewCatBtn onClick={addCategory} disabled={busy || !newName.trim()}>
              Add
            </NewCatBtn>
          </NewCatRow>
        ) : (
          <AddCatBtn onClick={() => setAdding(true)}>+ New category</AddCatBtn>
        )}
      </Scroll>
    </Drawer>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const Drawer = styled.aside`
  flex: 0 0 250px;
  width: 250px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid rgba(${PINK_RGB}, 0.16);
  background: rgba(${PINK_RGB}, 0.025);

  [data-theme="light"] & {
    background: rgba(${PINK_RGB}, 0.04);
  }
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(${PINK_RGB}, 0.14);
`;

const HeadTitle = styled.span`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(${PINK_RGB}, 0.75);
`;

const HeadCount = styled.span`
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

const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;

  &::-webkit-scrollbar {
    width: 8px;
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

const Group = styled.div<{ $dropping?: boolean }>`
  margin-bottom: 0.6rem;
  border-radius: 8px;
  outline: ${(p) => (p.$dropping ? `1px dashed rgba(${PINK_RGB}, 0.8)` : "none")};
  outline-offset: 2px;
`;

const GroupHead = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
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

const Items = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const Item = styled(PanelSidebarItem).attrs({ $accent: "pink" })`
  text-align: left;
`;

const ItemRow = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const ItemLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ItemSub = styled.span<{ $active?: boolean }>`
  font-size: 10px;
  color: ${(p) => (p.$active ? `rgba(${PINK_RGB}, 0.85)` : `rgba(${PINK_RGB}, 0.5)`)};
`;

const EmptyGroup = styled.div`
  font-size: 10.5px;
  font-style: italic;
  color: rgba(${PINK_RGB}, 0.4);
  padding: 6px 10px;
`;

const Hint = styled.p`
  font-size: 11px;
  line-height: 1.5;
  color: rgba(${PINK_RGB}, 0.5);
  padding: 8px;
`;

const AddCatBtn = styled.button`
  margin-top: 4px;
  width: 100%;
  text-align: left;
  padding: 7px 10px;
  font-size: 11.5px;
  font-weight: 700;
  color: rgba(${PINK_RGB}, 0.8);
  background: transparent;
  border: 1px dashed rgba(${PINK_RGB}, 0.4);
  border-radius: 8px;
  cursor: pointer;
  &:hover {
    background: rgba(${PINK_RGB}, 0.08);
    color: ${PINK};
  }
`;

const NewCatRow = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 4px;
`;

const NewCatInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  font-size: 11.5px;
  color: inherit;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(${PINK_RGB}, 0.35);
  border-radius: 7px;
  outline: none;
  &:focus {
    border-color: rgba(${PINK_RGB}, 0.7);
  }
`;

const NewCatBtn = styled.button`
  flex: none;
  padding: 0 10px;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  color: ${PINK};
  background: rgba(${PINK_RGB}, 0.1);
  border: 1px solid rgba(${PINK_RGB}, 0.4);
  border-radius: 7px;
  cursor: pointer;
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const Rail = styled.button`
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

const RailGlyph = styled.span`
  font-size: 14px;
  font-weight: 800;
`;

const RailLabel = styled.span`
  writing-mode: vertical-rl;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(${PINK_RGB}, 0.65);
`;

const HeaderDdmWrap = styled.div`
  min-width: 180px;
  max-width: 260px;
  & button[aria-haspopup="menu"] {
    padding: 6px 12px;
    font-size: 12.5px;
  }
`;
