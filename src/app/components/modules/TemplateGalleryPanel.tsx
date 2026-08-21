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
// NEW TEMPLATE (canon P4) is the other end of that same door. Until now a
// template could only be born as a SNAPSHOT of a page that already existed —
// the studio overlay's Save-to-template — so there was no way to start one from
// nothing. Marthe's loop runs the other way: create the row here (born Drafts,
// empty model), open it in the editor, compose it out of the ratified library,
// then Move to Live when it earns it. The create writes straight to
// shared_templates through Office's own Drizzle client, like every other action
// in this module; the compose step is the real page editor, one tab away.
//
// Edit opens the REAL page editor on tgv.com in a new tab: the template's
// model is checked out into a scratch draft, edited with the full editor, and
// checked back in from the Studio overlay's "Save to template". New tab, not
// an iframe — the tgv.com editor refuses cross-origin framing and its session
// cookie isn't sent third-party (same lesson as the Villagers Page Editor and
// Module-Dashboard tiles). Clicking the TILE does the same thing — opening a
// template in a gallery means editing it; the live render is "Preview" in the
// 3-dot menu. Both are plain anchors, never window.open: a programmatic popup
// gets blocked silently and reads as "Edit does nothing".
//
// That new tab lands on tgv.com's own passkey session, which is NOT the Office
// one. If the operator isn't signed in there as an admin, the tgv.com route
// says so on the page — it must never bounce to "/", which looks like Edit
// opened the live site.
//
// PROPOSED (component-library canon, P3) is the one lane that does NOT list
// templates. Gio 2026-08-02: a new atom group "goes in the follow-up for us to
// go over and ratify before we canonize it — that will take place in the page
// editor off template gallery in office". So the lane lives beside Live/Drafts,
// but its rows are catalog ENTRIES: opening one mounts CatalogBlockEditor with
// the entry's own EditorPanel + StyleToggles live over its real render, and the
// Canon section in there is where Ratify / Send back happen. Two gates, two
// meanings — a template is published, an atom group is ratified once, ever.
// An entry with no `catalog_entries` row takes its state from code
// (`entry.proposed`), which grandfathers everything that predates the gate.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import TPG from "@tgv/module-component-library/components/ui/TPG";

import { CATALOG } from "@/lib/domains/editor/component-library/registry";

import { colors, rgb } from "../../theme";
import { EditIcon, EyeIcon, MoreIcon, TrashIcon } from "../icons";
import ConfirmModal from "../frontdesk/ConfirmModal";
import ModalRoot from "../ModalRoot";

// Loaded on open, not on mount: the ruling surface drags in the whole catalog
// editor (preview render, update modal, per-entry panels) and most visits to the
// gallery never open a proposal.
const CatalogBlockEditor = dynamic(() => import("../sandbox/CatalogBlockEditor"), {
  ssr: false,
  loading: () => <Note>Loading the block…</Note>,
});

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
  /** 0105: member submissions ride the same table with status 'submitted'. */
  status: TemplateStatus | "submitted";
  updatedAt: string;
};

type Filter = "published" | "sandbox" | "submitted" | "proposed" | "all";

const FILTERS: readonly Filter[] = [
  "published",
  "sandbox",
  "submitted",
  "proposed",
  "all",
] as const;

/** `?status=sandbox` opens the gallery on that pill. The editor's "delete this
 *  template" lands here (Gio 2026-08-20: "it closes and redirects the user back
 *  to the template gallery drafts view"), and it makes every pill linkable.
 *  Read AFTER mount, never as the initial state: the server has no query-string
 *  view of this component and a different first paint is a hydration mismatch. */
function filterFromUrl(): Filter | null {
  const raw = new URLSearchParams(window.location.search).get("status");
  return (FILTERS as readonly string[]).includes(raw ?? "")
    ? (raw as Filter)
    : null;
}

/** A stored ruling from `catalog_entries` (P3). No row ⇒ birth state from code. */
type CanonRow = {
  catalogId: string;
  status: "proposed" | "ratified";
  proposedAt: string | null;
  sentBackAt: string | null;
  note: string | null;
};

/** One row of the Proposed lane — a catalog entry, not a template. */
type Proposal = {
  id: string;
  label: string;
  description: string;
  category: string;
  note: string | null;
  since: string | null;
};

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
  const [canonRows, setCanonRows] = useState<CanonRow[] | null>(null);
  const [openProposal, setOpenProposal] = useState<Proposal | null>(null);
  const [newOpen, setNewOpen] = useState(false);

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

  // The stored rulings. A failure here is not fatal: the lane still shows the
  // code-flagged proposals, which is the honest floor.
  const loadCanon = useCallback(async () => {
    try {
      const r = await fetch("/api/sandbox/catalog-status", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      setCanonRows((j?.rows as CanonRow[]) ?? []);
    } catch {
      setCanonRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadCanon();
  }, [load, loadCanon]);

  // Deep link (?status=): once, on mount.
  useEffect(() => {
    const f = filterFromUrl();
    if (f) setFilter(f);
  }, []);

  // The lane = every catalog entry whose CURRENT state is "proposed": born
  // proposed in code and not yet ratified, or ruled back out by a stored row.
  const proposals = useMemo<Proposal[]>(() => {
    const byId = new Map((canonRows ?? []).map((r) => [r.catalogId, r]));
    return CATALOG.filter((e) => {
      const row = byId.get(e.id);
      return row ? row.status === "proposed" : e.proposed === true;
    })
      .map((e) => {
        const row = byId.get(e.id);
        return {
          id: e.id,
          label: e.label,
          description: e.description,
          category: `${e.zone.toLowerCase()} · ${e.category}`,
          note: row?.note ?? null,
          since: row?.sentBackAt ?? row?.proposedAt ?? null,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [canonRows]);

  // The categories that already exist, offered as a datalist rather than a
  // fixed enum: the column is free text and the Sandbox's Templates column
  // creates new groups by name, so a closed list here would immediately lie.
  const categories = useMemo(
    () =>
      Array.from(new Set((templates ?? []).map((t) => t.category).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [templates],
  );

  const counts = useMemo(() => {
    const all = templates ?? [];
    return {
      published: all.filter((t) => t.status === "published").length,
      sandbox: all.filter((t) => t.status === "sandbox").length,
      submitted: all.filter((t) => t.status === "submitted").length,
      all: all.length,
    };
  }, [templates]);

  // 0105 — member-submission review: proxies to TGV's internal route (status
  // flip + optional token reward + member alert in one implementation).
  const [tokenAmounts, setTokenAmounts] = useState<Record<string, string>>({});
  const review = useCallback(
    async (t: Template, decision: "accept" | "decline") => {
      setBusyId(t.templateId);
      setError(null);
      try {
        const tokens = Number(tokenAmounts[t.templateId] ?? "") || 0;
        const r = await fetch(
          `/api/editor/shared-templates/${encodeURIComponent(t.templateId)}/review`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              decision,
              ...(tokens > 0 ? { rewardTokens: tokens } : {}),
            }),
          },
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Review failed");
      } finally {
        setBusyId(null);
      }
    },
    [load, tokenAmounts],
  );

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
  //
  // The outside-click close asks WHERE the press landed instead of relying on
  // the menu's own onMouseDown to stop it (Gio 2026-08-20: "i just tried to
  // delete the template draft ... and it didn't work"). That guard could never
  // have worked here: the App Router hydrates React onto `document` itself, so
  // React's listener and this one sit on the SAME node, and stopPropagation()
  // does nothing to a sibling listener on the node it is already at. Every
  // press inside the menu therefore closed it on MOUSEDOWN, the item unmounted
  // before mouseup, and the browser never fired a click at all — so no menu
  // item ever ran its handler. Verified in prod with a capture-phase log:
  // mousedown on the Delete button, mouseup on the tile behind it, no click.
  useEffect(() => {
    if (!openMenuId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    const onDown = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      // Inside the open menu, or on the button that owns it → leave it alone.
      if (el?.closest("[data-tile-menu]")) return;
      setOpenMenuId(null);
    };
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

  // Real hrefs, not window.open: a programmatic popup is silently swallowed by
  // the browser's popup blocker often enough that Edit just "does nothing", and
  // there is no error to show for it. An anchor with target=_blank always
  // opens, and it gets middle-click / cmd-click / "open in new tab" for free.
  const editHref = useCallback(
    (t: Template) =>
      `${TGV_BASE}/${LANG}/editor/template/${encodeURIComponent(t.templateId)}`,
    [],
  );
  const previewHref = useCallback(
    (t: Template) =>
      `${TGV_BASE}/${LANG}/preview/template/${encodeURIComponent(t.templateId)}`,
    [],
  );

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
            { key: "submitted", label: "Submitted", count: counts.submitted },
            { key: "proposed", label: "Proposed", count: proposals.length },
            { key: "all", label: "All", count: counts.all },
          ]}
        />
        {/* Not offered on the Proposed lane: that lane's rows are catalog
            entries, and "New template" there would read as "new atom group",
            which is a thing only the code adds. */}
        {filter !== "proposed" && (
          <NewBtn type="button" onClick={() => setNewOpen(true)}>
            + New template
          </NewBtn>
        )}
      </BarRow>

      {error && <ErrorBox role="alert">{error}</ErrorBox>}

      {/* Proposed — catalog entries awaiting ratification. A different object
          than a template, so it gets its own list rather than borrowing the
          thumbnail grid: these have no thumbnail, and their action is a ruling. */}
      {filter === "proposed" && (
        <>
          {canonRows === null ? (
            <Note>Loading proposals…</Note>
          ) : proposals.length === 0 ? (
            <Note>
              Nothing awaiting ratification — every block in the library is canon. New atom
              groups land here automatically when Claude adds one.
            </Note>
          ) : (
            <ProposalList>
              {proposals.map((p) => (
                <ProposalRow key={p.id} type="button" onClick={() => setOpenProposal(p)}>
                  <ProposalMain>
                    <ProposalTitle>{p.label}</ProposalTitle>
                    <ProposalMeta>
                      {p.category}
                      {p.since ? ` · ${new Date(p.since).toLocaleDateString()}` : ""}
                    </ProposalMeta>
                    <ProposalDesc>{p.description}</ProposalDesc>
                    {p.note && <ProposalNote>Sent back with: {p.note}</ProposalNote>}
                  </ProposalMain>
                  <ProposalChip>Review →</ProposalChip>
                </ProposalRow>
              ))}
            </ProposalList>
          )}
        </>
      )}

      {filter !== "proposed" && templates === null && <Note>Loading templates…</Note>}

      {filter !== "proposed" && templates !== null && filtered.length === 0 && (
        <Note>
          {filter === "sandbox"
            ? "No drafted templates. Everything in the library is live to members."
            : filter === "published"
              ? "No live templates — members' editor pickers will show nothing from the DB."
              : filter === "submitted"
                ? "No member submissions awaiting review."
                : "No templates yet."}
        </Note>
      )}

      {filter !== "proposed" && visible.length > 0 && (
        <Grid>
          {visible.map((t) => {
            const thumb = thumbnailUrl(t.thumbnail);
            const isLive = t.status === "published";
            const isSubmitted = t.status === "submitted";
            return (
              <TileWrap key={t.templateId}>
                <TileTitleRow>
                  <TileTitle title={t.label}>{t.label}</TileTitle>
                  <StatusChip $live={isLive}>
                    {isLive ? "Live" : isSubmitted ? "Submitted" : "Draft"}
                  </StatusChip>
                </TileTitleRow>

                {/* The tile itself opens the EDITOR with this template loaded —
                    that's what an operator means by clicking a template in a
                    gallery. Preview (the live render) stays in the 3-dot menu. */}
                <Thumb
                  href={editHref(t)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Edit ${t.label}`}
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
                  data-tile-menu=""
                  onClick={() =>
                    setOpenMenuId((k) =>
                      k === t.templateId ? null : t.templateId,
                    )
                  }
                >
                  <MoreIcon size={14} />
                </MenuBtn>

                {/* 0105: submitted tiles carry inline review controls — the
                    decision (+ optional token reward) proxies to TGV so the
                    flip/grant/alert logic lives once. */}
                {isSubmitted && (
                  <ReviewRow onMouseDown={(e) => e.stopPropagation()}>
                    <ReviewTokens
                      type="number"
                      min={0}
                      placeholder="tokens"
                      title="Optional token reward for the submitter"
                      value={tokenAmounts[t.templateId] ?? ""}
                      onChange={(e) =>
                        setTokenAmounts((m) => ({
                          ...m,
                          [t.templateId]: e.target.value,
                        }))
                      }
                    />
                    <ReviewBtn
                      type="button"
                      disabled={busyId === t.templateId}
                      onClick={() => void review(t, "accept")}
                    >
                      Accept
                    </ReviewBtn>
                    <ReviewBtn
                      type="button"
                      $danger
                      disabled={busyId === t.templateId}
                      onClick={() => void review(t, "decline")}
                    >
                      Decline
                    </ReviewBtn>
                  </ReviewRow>
                )}

                {openMenuId === t.templateId && (
                  <Menu role="menu" data-tile-menu="">
                    <MenuLabel>Move to</MenuLabel>
                    {/* Disable the destination you are ALREADY on — the pair was
                        inverted, which left every template stuck in its status. */}
                    <MenuItem
                      role="menuitem"
                      type="button"
                      disabled={isLive}
                      onClick={() => setStatus(t, "published")}
                    >
                      Live
                      {isLive && <Tick aria-hidden>✓</Tick>}
                    </MenuItem>
                    <MenuItem
                      role="menuitem"
                      type="button"
                      disabled={!isLive}
                      onClick={() => setStatus(t, "sandbox")}
                    >
                      Drafted
                      {!isLive && <Tick aria-hidden>✓</Tick>}
                    </MenuItem>
                    <MenuSep />
                    <MenuItemLink
                      role="menuitem"
                      href={editHref(t)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setOpenMenuId(null)}
                    >
                      <EditIcon size={13} /> Edit
                    </MenuItemLink>
                    <MenuItemLink
                      role="menuitem"
                      href={previewHref(t)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setOpenMenuId(null)}
                    >
                      <EyeIcon size={13} /> Preview
                    </MenuItemLink>
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

      {filter !== "proposed" && filtered.length > pageSize && (
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

      {/* The ruling surface: the entry's own panels, live over its real render.
          Closing re-reads the rulings so the lane empties as things are ratified. */}
      {openProposal && (
        <ModalRoot
          onClose={() => {
            setOpenProposal(null);
            void loadCanon();
          }}
        >
          <ProposalShell onMouseDown={(e) => e.stopPropagation()}>
            <ProposalHead>
              <div>
                <ProposalHeadTitle>{openProposal.label}</ProposalHeadTitle>
                <ProposalHeadId>{openProposal.id}</ProposalHeadId>
              </div>
              <CloseBtn
                type="button"
                aria-label="Close"
                onClick={() => {
                  setOpenProposal(null);
                  void loadCanon();
                }}
              >
                ✕
              </CloseBtn>
            </ProposalHead>
            <ProposalBody>
              <CatalogBlockEditor catalogId={openProposal.id} />
            </ProposalBody>
          </ProposalShell>
        </ModalRoot>
      )}

      {newOpen && (
        <NewTemplateModal
          categories={categories}
          editHref={(templateId) =>
            `${TGV_BASE}/${LANG}/editor/template/${encodeURIComponent(templateId)}`
          }
          onClose={() => setNewOpen(false)}
          onCreated={() => {
            // The new row is a draft, so show the lane it landed in — otherwise
            // "created" is followed by a gallery that looks unchanged.
            setFilter("sandbox");
            setPage(1);
            void load();
          }}
        />
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

/** New template — name it, then go compose it.
 *
 *  Deliberately two steps and not one: the row has to exist before the editor
 *  has anything to check out, and the hand-off is a real anchor rather than a
 *  programmatic window.open, for the same reason Edit is (see above — a blocked
 *  popup reads as "the button does nothing", and there is no error to show).
 *  So the modal's success state IS the hand-off: a link the operator clicks. */
function NewTemplateModal({
  categories,
  editHref,
  onClose,
  onCreated,
}: {
  categories: string[];
  editHref: (templateId: string) => string;
  onClose: () => void;
  onCreated: (t: Template) => void;
}) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [made, setMade] = useState<Template | null>(null);

  // The page slug follows the name until someone edits it, then it stops
  // moving: a field that keeps overwriting what you typed is worse than one
  // that never filled itself in.
  const suggestedSlug = slugTouched ? slug : slugify(label);

  const submit = async () => {
    if (!label.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/editor/shared-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          category: category.trim(),
          description: description.trim(),
          tags,
          suggestedSlug,
          suggestedTitle: label.trim(),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      const t = j.template as Template;
      setMade(t);
      onCreated(t);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalRoot onClose={onClose}>
      <FormShell onMouseDown={(e) => e.stopPropagation()}>
        <ProposalHead>
          <div>
            <ProposalHeadTitle>{made ? "Template created" : "New template"}</ProposalHeadTitle>
            <ProposalHeadId>{made ? made.templateId : "starts empty, in Drafts"}</ProposalHeadId>
          </div>
          <CloseBtn type="button" aria-label="Close" onClick={onClose}>
            ✕
          </CloseBtn>
        </ProposalHead>

        <FormBody>
          {made ? (
            <>
              <Note>
                <strong>{made.label}</strong> is in Drafts with an empty canvas. Open it in the
                page editor to compose it from the library, then use the Studio overlay&rsquo;s
                Save to template on the way out. Move it to Live from this gallery when it&rsquo;s
                ready for members.
              </Note>
              <FormRow>
                <PrimaryLink
                  href={editHref(made.templateId)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in the editor →
                </PrimaryLink>
                <GhostBtn type="button" onClick={onClose}>
                  Done
                </GhostBtn>
              </FormRow>
            </>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="tpl-label">Name</FieldLabel>
                <TextInput
                  id="tpl-label"
                  value={label}
                  autoFocus
                  placeholder="Therapist landing"
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submit();
                  }}
                />
                <FieldHint>
                  The id is made from this — {suggestedSlug ? <code>{slugify(label)}</code> : "a-name-like-this"} —
                  and a number is added if it is taken.
                </FieldHint>
              </Field>

              <Field>
                <FieldLabel htmlFor="tpl-category">Category</FieldLabel>
                <TextInput
                  id="tpl-category"
                  list="tpl-categories"
                  value={category}
                  placeholder="misc"
                  onChange={(e) => setCategory(e.target.value)}
                />
                <datalist id="tpl-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>

              <Field>
                <FieldLabel htmlFor="tpl-desc">Description</FieldLabel>
                <TextArea
                  id="tpl-desc"
                  rows={2}
                  value={description}
                  placeholder="What kind of site is this for?"
                  onChange={(e) => setDescription(e.target.value)}
                />
                <FieldHint>Members read this in the picker and the onboarding wizard.</FieldHint>
              </Field>

              <Field>
                <FieldLabel htmlFor="tpl-tags">Tags</FieldLabel>
                <TextInput
                  id="tpl-tags"
                  value={tags}
                  placeholder="wellness, booking"
                  onChange={(e) => setTags(e.target.value)}
                />
                <FieldHint>Comma-separated. The wizard&rsquo;s curated gallery filters on these.</FieldHint>
              </Field>

              <Field>
                <FieldLabel htmlFor="tpl-slug">Suggested page slug</FieldLabel>
                <TextInput
                  id="tpl-slug"
                  value={suggestedSlug}
                  placeholder="home"
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                />
                <FieldHint>What the member&rsquo;s page is called when they use this template.</FieldHint>
              </Field>

              {err && <ErrorBox role="alert">{err}</ErrorBox>}

              <FormRow>
                <PrimaryBtn type="button" disabled={!label.trim() || busy} onClick={() => void submit()}>
                  {busy ? "Creating…" : "Create draft"}
                </PrimaryBtn>
                <GhostBtn type="button" onClick={onClose}>
                  Cancel
                </GhostBtn>
              </FormRow>
            </>
          )}
        </FormBody>
      </FormShell>
    </ModalRoot>
  );
}

/** Mirrors the server's slugifyTemplateId so the hint shows the id it will
 *  actually get. The server is still the one that decides — this only previews. */
function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48)
      .replace(/-+$/g, "") || ""
  );
}

/* ── Styled ─────────────────────────────────────────────────────── */

const BarRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
`;
const NewBtn = styled.button`
  flex: 0 0 auto;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  color: ${colors.violet};
  background: rgba(${rgb.violet}, 0.12);
  border: 1px solid rgba(${rgb.violet}, 0.5);
  &:hover { background: rgba(${rgb.violet}, 0.2); }
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

/* 0105 — inline review controls on submitted tiles. */
const ReviewRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
`;

const ReviewTokens = styled.input`
  width: 4.2rem;
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);
  border-radius: 0.35rem;
  color: inherit;
  font-size: 0.7rem;
  padding: 0.25rem 0.4rem;
`;

const ReviewBtn = styled.button<{ $danger?: boolean }>`
  flex: 1;
  background: transparent;
  border: 1px solid
    ${({ $danger }) => ($danger ? "rgba(255,120,120,.5)" : `rgba(${rgb.cyan}, 0.45)`)};
  color: ${({ $danger }) => ($danger ? "rgb(255,160,160)" : colors.cyan)};
  border-radius: 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.25rem 0.4rem;
  cursor: pointer;
  &:hover { background: rgba(255, 255, 255, 0.05); }
  &:disabled { opacity: 0.5; cursor: default; }
`;

const Thumb = styled.a<{ $busy: boolean }>`
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

/** Same skin as MenuItem, but a real link — see the editHref comment. */
const MenuItemLink = styled(MenuItem).attrs({ as: "a" })`
  text-decoration: none;
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

/* ── Proposed lane (component-library canon, P3) ─────────────────── */
const ProposalList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;
const ProposalRow = styled.button`
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  text-align: left;
  padding: 12px 14px;
  border-radius: 10px;
  cursor: pointer;
  color: inherit;
  background: rgba(255, 184, 107, 0.05);
  border: 1px solid rgba(255, 184, 107, 0.32);
  transition: background 0.15s ease, border-color 0.15s ease;
  &:hover {
    background: rgba(255, 184, 107, 0.1);
    border-color: rgba(255, 184, 107, 0.6);
  }
`;
const ProposalMain = styled.div`
  flex: 1 1 auto;
  min-width: 0;
`;
const ProposalTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: var(--t-text);
`;
const ProposalMeta = styled.div`
  margin-top: 2px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--t-textFaint);
`;
const ProposalDesc = styled.div`
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--t-textFaint);
`;
const ProposalNote = styled.div`
  margin-top: 8px;
  padding-left: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #ffb86b;
  border-left: 2px solid #ffb86b;
`;
const ProposalChip = styled.span`
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  color: #ffb86b;
  background: rgba(255, 184, 107, 0.12);
  border: 1px solid rgba(255, 184, 107, 0.5);
`;
const ProposalShell = styled.div`
  display: flex;
  flex-direction: column;
  width: min(980px, 94vw);
  max-height: 88vh;
  border-radius: 14px;
  overflow: hidden;
  background: var(--t-surface, #12121a);
  border: 1px solid var(--t-border);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
`;
const ProposalHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--t-border);
`;
const ProposalHeadTitle = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: var(--t-text);
`;
const ProposalHeadId = styled.div`
  margin-top: 2px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--t-textFaint);
`;
const CloseBtn = styled.button`
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--t-textFaint);
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);
  &:hover { color: var(--t-text); }
`;
const ProposalBody = styled.div`
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  padding: 14px 16px;
  overflow: hidden;
`;

const FormShell = styled.div`
  display: flex;
  flex-direction: column;
  width: min(520px, 94vw);
  max-height: 88vh;
  border-radius: 14px;
  overflow: hidden;
  background: var(--t-surface, #12121a);
  border: 1px solid var(--t-border);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
`;
const FormBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px 16px;
  overflow-y: auto;
`;
const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
const FieldLabel = styled.label`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--t-textFaint);
`;
const FieldHint = styled.div`
  font-size: 11px;
  line-height: 1.5;
  color: var(--t-textFaint);
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--t-text);
  }
`;
const TextInput = styled.input`
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--t-text);
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);
  &:focus-visible { outline: 1px solid rgba(${rgb.violet}, 0.7); outline-offset: 1px; }
`;
const TextArea = styled.textarea`
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  color: var(--t-text);
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);
  &:focus-visible { outline: 1px solid rgba(${rgb.violet}, 0.7); outline-offset: 1px; }
`;
const FormRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
`;
const PrimaryBtn = styled.button`
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  color: ${colors.violet};
  background: rgba(${rgb.violet}, 0.14);
  border: 1px solid rgba(${rgb.violet}, 0.55);
  &:hover:not(:disabled) { background: rgba(${rgb.violet}, 0.22); }
  &:disabled { opacity: 0.45; cursor: default; }
`;
const PrimaryLink = styled(PrimaryBtn).attrs({ as: "a" })`
  text-decoration: none;
`;
const GhostBtn = styled.button`
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  color: var(--t-textFaint);
  background: transparent;
  border: 1px solid var(--t-border);
  &:hover { color: var(--t-text); }
`;
