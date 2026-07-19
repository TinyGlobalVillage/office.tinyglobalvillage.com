"use client";

// TemplateGalleryPanel — Modules → Template Gallery.
//
// The operator surface for `shared_templates`, the cross-tenant page-template
// registry every member's editor picker and the onboarding wizard read from.
// Until now the only way to promote or edit one of these rows was the Page
// Templates sidebar buried inside the Sandbox modal; this is that control
// promoted to a first-class module.
//
// Status IS the gallery's whole point: `published` = Live (offered to every
// member), `sandbox` = Drafts (invisible to members, still editable here).
// Moving a template to Drafts is how TGV stops marketing a vertical it isn't
// ready to support — see the therapist template and the HIPAA work.
//
// Edit opens the REAL page editor on tgv.com in a new tab: the template's
// model is checked out into a scratch draft, edited with the full editor, and
// checked back in from the Studio overlay's "Save to template". New tab, not
// an iframe — the tgv.com editor refuses cross-origin framing and its session
// cookie isn't sent third-party (same lesson as the Villagers Page Editor and
// Module-Dashboard tiles).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import TPG from "@tgv/module-component-library/components/ui/TPG";

import { colors, rgb } from "../../theme";
import { EditIcon, EyeIcon, MoreIcon, TrashIcon } from "../icons";
import ConfirmModal from "../frontdesk/ConfirmModal";

type TemplateStatus = "sandbox" | "published";

type Template = {
  id: string;
  templateId: string;
  label: string;
  description: string;
  category: string;
  tags: string[];
  thumbnail: string | null;
  suggestedSlug: string;
  status: TemplateStatus;
  updatedAt: string;
};

type Filter = "published" | "sandbox" | "all";

const TGV_BASE =
  process.env.NEXT_PUBLIC_TGV_URL ?? "https://tinyglobalvillage.com";
const LANG = "en";

/** Thumbnails are stored as tgv.com-relative paths (/templates/thumbs/x.png).
 *  Office is a different origin, so absolutise them. */
function thumbnailUrl(thumbnail: string | null): string | null {
  if (!thumbnail) return null;
  if (/^https?:\/\//i.test(thumbnail)) return thumbnail;
  return `${TGV_BASE}${thumbnail.startsWith("/") ? "" : "/"}${thumbnail}`;
}

export default function TemplateGalleryPanel() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("published");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Always fetch ALL — the pillbar's counts have to be honest even while
      // you're looking at one slice, and the dataset is tens of rows.
      const r = await fetch("/api/editor/shared-templates?status=all", {
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setTemplates((j.templates as Template[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load templates");
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const all = templates ?? [];
    return {
      published: all.filter((t) => t.status === "published").length,
      sandbox: all.filter((t) => t.status === "sandbox").length,
      all: all.length,
    };
  }, [templates]);

  const filtered = useMemo(() => {
    const all = templates ?? [];
    if (filter === "all") return all;
    return all.filter((t) => t.status === filter);
  }, [templates, filter]);

  // Switching pills or shrinking the result set must never strand the viewer
  // on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [filter]);
  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    setPage((p) => Math.min(p, pageCount));
  }, [filtered.length, pageSize]);

  const visible = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  // ESC always closes the menu, even from inside a focused control.
  useEffect(() => {
    if (!openMenuId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    const onDown = () => setOpenMenuId(null);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [openMenuId]);

  const setStatus = useCallback(
    async (t: Template, status: TemplateStatus) => {
      setOpenMenuId(null);
      setBusyId(t.templateId);
      setError(null);
      try {
        const r = await fetch(
          `/api/editor/shared-templates/${encodeURIComponent(t.templateId)}/status`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status }),
          },
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Status change failed");
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const doDelete = useCallback(async () => {
    const t = confirmDelete;
    if (!t) return;
    setConfirmDelete(null);
    setBusyId(t.templateId);
    setError(null);
    try {
      const r = await fetch(
        `/api/editor/shared-templates/${encodeURIComponent(t.templateId)}`,
        { method: "DELETE" },
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }, [confirmDelete, load]);

  const openEditor = useCallback((t: Template) => {
    setOpenMenuId(null);
    window.open(
      `${TGV_BASE}/${LANG}/editor/template/${encodeURIComponent(t.templateId)}`,
      "_blank",
    );
  }, []);

  const openPreview = useCallback((t: Template) => {
    setOpenMenuId(null);
    window.open(
      `${TGV_BASE}/${LANG}/preview/template/${encodeURIComponent(t.templateId)}`,
      "_blank",
    );
  }, []);

  return (
    <>
      <BarRow>
        <PillBar
          accent={rgb.violet}
          ariaLabel="Template status"
          active={filter}
          onChange={(k: string) => setFilter(k as Filter)}
          segments={[
            { key: "published", label: "Live", count: counts.published },
            { key: "sandbox", label: "Drafts", count: counts.sandbox },
            { key: "all", label: "All", count: counts.all },
          ]}
        />
      </BarRow>

      {error && <ErrorBox role="alert">{error}</ErrorBox>}

      {templates === null && <Note>Loading templates…</Note>}

      {templates !== null && filtered.length === 0 && (
        <Note>
          {filter === "sandbox"
            ? "No drafted templates. Everything in the library is live to members."
            : filter === "published"
              ? "No live templates — members' editor pickers will show nothing from the DB."
              : "No templates yet."}
        </Note>
      )}

      {visible.length > 0 && (
        <Grid>
          {visible.map((t) => {
            const thumb = thumbnailUrl(t.thumbnail);
            const isLive = t.status === "published";
            return (
              <TileWrap key={t.templateId}>
                <TileTitleRow>
                  <TileTitle title={t.label}>{t.label}</TileTitle>
                  <StatusChip $live={isLive}>
                    {isLive ? "Live" : "Draft"}
                  </StatusChip>
                </TileTitleRow>

                <Thumb
                  type="button"
                  onClick={() => openPreview(t)}
                  title={`Preview ${t.label}`}
                  $busy={busyId === t.templateId}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" loading="lazy" />
                  ) : (
                    <NoThumb>No preview</NoThumb>
                  )}
                </Thumb>

                <TileMeta>
                  {t.category}
                  {t.tags.length > 0 ? ` · ${t.tags.join(", ")}` : ""}
                </TileMeta>
                <TileDesc title={t.description}>{t.description}</TileDesc>

                <MenuBtn
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={openMenuId === t.templateId}
                  aria-label={`Actions for ${t.label}`}
                  title="Actions"
                  disabled={busyId === t.templateId}
                  // Stop the document mousedown listener from closing the menu
                  // in the same gesture that opens it.
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() =>
                    setOpenMenuId((k) =>
                      k === t.templateId ? null : t.templateId,
                    )
                  }
                >
                  <MoreIcon size={14} />
                </MenuBtn>

                {openMenuId === t.templateId && (
                  <Menu
                    role="menu"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <MenuLabel>Move to</MenuLabel>
                    <MenuItem
                      role="menuitem"
                      type="button"
                      disabled={!isLive}
                      onClick={() => setStatus(t, "published")}
                    >
                      Live
                      {isLive && <Tick aria-hidden>✓</Tick>}
                    </MenuItem>
                    <MenuItem
                      role="menuitem"
                      type="button"
                      disabled={isLive}
                      onClick={() => setStatus(t, "sandbox")}
                    >
                      Drafted
                      {!isLive && <Tick aria-hidden>✓</Tick>}
                    </MenuItem>
                    <MenuSep />
                    <MenuItem
                      role="menuitem"
                      type="button"
                      onClick={() => openEditor(t)}
                    >
                      <EditIcon size={13} /> Edit
                    </MenuItem>
                    <MenuItem
                      role="menuitem"
                      type="button"
                      onClick={() => openPreview(t)}
                    >
                      <EyeIcon size={13} /> Preview
                    </MenuItem>
                    <MenuSep />
                    <MenuItem
                      role="menuitem"
                      type="button"
                      $danger
                      onClick={() => {
                        setOpenMenuId(null);
                        setConfirmDelete(t);
                      }}
                    >
                      <TrashIcon size={13} /> Delete
                    </MenuItem>
                  </Menu>
                )}
              </TileWrap>
            );
          })}
        </Grid>
      )}

      {filtered.length > pageSize && (
        <PagerRow>
          <TPG
            total={filtered.length}
            page={page}
            pageSize={pageSize}
            defaultPageSize={12}
            pageSizeOptions={[6, 12, 24, 48]}
            itemNoun="template"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </PagerRow>
      )}

      <ConfirmModal
        open={confirmDelete !== null}
        intent="danger"
        title="Delete template"
        message={`Delete "${confirmDelete?.label ?? ""}" from the gallery?`}
        detail={
          "It disappears from every member's editor picker and the onboarding wizard immediately. " +
          "The row is soft-deleted (kept for audit), but the gallery can't bring it back — " +
          "restoring means clearing deleted_at in the database. " +
          "To take it out of circulation reversibly, move it to Drafts instead."
        }
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}

/* ── Styled ─────────────────────────────────────────────────────── */

const BarRow = styled.div`
  display: flex;
  justify-content: flex-start;
  margin-bottom: 1rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.75rem;
`;

const TileWrap = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.85rem;
  background: rgba(${rgb.violet}, 0.04);
  border: 1px solid rgba(${rgb.violet}, 0.3);
  border-radius: 0.625rem;
  transition: all 0.15s;

  &:hover {
    border-color: rgba(${rgb.violet}, 0.55);
    box-shadow: 0 0 18px rgba(${rgb.violet}, 0.15);
  }
`;

const TileTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  /* Leave room for the 3-dot button pinned to the corner. */
  padding-right: 1.85rem;
`;

const TileTitle = styled.div`
  flex: 1;
  font-size: 0.9rem;
  font-weight: 700;
  color: ${colors.violet};
  letter-spacing: 0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StatusChip = styled.span<{ $live: boolean }>`
  flex: none;
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
  color: ${({ $live }) => ($live ? colors.cyan : "var(--t-textFaint)")};
  background: ${({ $live }) =>
    $live ? `rgba(${rgb.cyan}, 0.12)` : "var(--t-inputBg)"};
  border: 1px solid
    ${({ $live }) => ($live ? `rgba(${rgb.cyan}, 0.45)` : "var(--t-border)")};
`;

const Thumb = styled.button<{ $busy: boolean }>`
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  border-radius: 0.4rem;
  border: 1px solid var(--t-border);
  background: var(--t-inputBg);
  opacity: ${({ $busy }) => ($busy ? 0.45 : 1)};
  transition: opacity 0.15s, border-color 0.15s;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
  }

  &:hover {
    border-color: rgba(${rgb.violet}, 0.6);
  }
`;

const NoThumb = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 0.7rem;
  color: var(--t-textFaint);
`;

const TileMeta = styled.div`
  font-size: 0.65rem;
  color: var(--t-textFaint);
  letter-spacing: 0.03em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TileDesc = styled.div`
  font-size: 0.72rem;
  line-height: 1.4;
  color: var(--t-textFaint);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const MenuBtn = styled.button`
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  z-index: 2;
  width: 1.5rem;
  height: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  cursor: pointer;
  background: rgba(${rgb.violet}, 0.1);
  border: 1px solid rgba(${rgb.violet}, 0.35);
  color: ${colors.violet};
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: rgba(${rgb.violet}, 0.2);
    border-color: rgba(${rgb.violet}, 0.7);
    box-shadow: 0 0 8px rgba(${rgb.violet}, 0.25);
  }
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const Menu = styled.div`
  position: absolute;
  top: 2.25rem;
  right: 0.6rem;
  z-index: 5;
  min-width: 9.5rem;
  padding: 0.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  background: var(--t-surface, #12121a);
  border: 1px solid rgba(${rgb.violet}, 0.4);
  border-radius: 0.5rem;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
`;

const MenuLabel = styled.div`
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--t-textFaint);
  padding: 0.3rem 0.45rem 0.15rem;
`;

const MenuItem = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  text-align: left;
  padding: 0.4rem 0.45rem;
  border: none;
  border-radius: 0.35rem;
  cursor: pointer;
  background: transparent;
  font-size: 0.78rem;
  color: ${({ $danger }) => ($danger ? colors.pink : "var(--t-text)")};

  &:hover:not(:disabled) {
    background: ${({ $danger }) =>
      $danger ? `rgba(${rgb.pink}, 0.14)` : `rgba(${rgb.violet}, 0.14)`};
  }
  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
`;

const Tick = styled.span`
  margin-left: auto;
  color: ${colors.cyan};
  font-size: 0.7rem;
`;

const MenuSep = styled.div`
  height: 1px;
  margin: 0.2rem 0.1rem;
  background: var(--t-border);
`;

const PagerRow = styled.div`
  margin-top: 1rem;
  --tpg-accent: ${colors.violet};
  --tpg-accent-rgb: ${rgb.violet};
`;

const Note = styled.div`
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.82rem;
  color: var(--t-textFaint);
  border: 1px dashed var(--t-border);
  border-radius: 0.5rem;
`;

const ErrorBox = styled.div`
  margin-bottom: 0.85rem;
  padding: 0.6rem 0.8rem;
  font-size: 0.78rem;
  color: ${colors.pink};
  background: rgba(${rgb.pink}, 0.08);
  border: 1px solid rgba(${rgb.pink}, 0.45);
  border-radius: 0.45rem;
`;
