"use client";

// ModuleStorefrontPanel — Modules → Module Storefront.
//
// The operator desk for the STORE pages every tenant's storefront ships with:
// the order-confirmation page auto-seeded at a store's first product, and the
// product / cart pages members pick in the editor. All three are ordinary
// `shared_templates` rows in the 'storefront' category, so this desk is the
// Template Gallery's harness scoped to that category — list, edit in the real
// tgv.com editor (checkout → compose → Studio overlay "Save to template"),
// preview the live render.
//
// The control that makes it a DESK rather than a gallery is the per-card
// Deploy | Unpublish pillbar (Gio 2026-08-30: "a toggle button that toggles a
// pillbar on each template that says deploy or unpublish"). Deploy = status
// 'published': member-pickable in the editor's new-page picker AND the model
// that governs future seeds (siteBirth reads the published row before the code
// registry). Unpublish = status 'sandbox': hidden from members, and seeds fall
// back to the code-registry default — a store gaining its first product can
// never 404 its confirmation page because a template was pulled. Edits govern
// FUTURE seeds only; a page already stamped into a tenant's site is theirs.
//
// Edit/Preview are plain anchors, never window.open — a blocked popup reads as
// "the button does nothing" (Template Gallery's lesson, kept).

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";

import PillBar from "@tgv/module-component-library/components/ui/PillBar";

import { colors, rgb } from "../../theme";
import { EyeIcon } from "../icons";

type Template = {
  id: string;
  templateId: string;
  label: string;
  description: string;
  category: string;
  tags: string[];
  thumbnail: string | null;
  suggestedSlug: string;
  status: "sandbox" | "published" | "submitted";
  updatedAt: string;
};

const TGV_BASE =
  process.env.NEXT_PUBLIC_TGV_URL ?? "https://tinyglobalvillage.com";
const LANG = "en";

/** Thumbnails are stored as tgv.com-relative paths — Office is a different
 *  origin, so absolutise them (same helper as TemplateGalleryPanel). */
function thumbnailUrl(thumbnail: string | null): string | null {
  if (!thumbnail) return null;
  if (/^https?:\/\//i.test(thumbnail)) return thumbnail;
  return `${TGV_BASE}${thumbnail.startsWith("/") ? "" : "/"}${thumbnail}`;
}

/** What each well-known template actually GOVERNS — the seed-role line under
 *  the card. Unknown ids (an operator-authored fourth store page) fall through
 *  to the row's own description alone. */
const SEED_ROLE: Record<string, string> = {
  "default-confirmation":
    "Auto-seeded as /confirmation the moment a store creates its first product.",
  "default-product":
    "The store catalog page members pick in the editor — sells from the site it lands on.",
  "default-cart":
    "The full-page cart & checkout members pick in the editor.",
};

export default function ModuleStorefrontPanel() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // ALL statuses — an unpublished template must stay visible here, or
      // Unpublish would make a card vanish with no way to deploy it back.
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

  const storePages = useMemo(
    () => (templates ?? []).filter((t) => t.category === "storefront"),
    [templates],
  );

  const setStatus = useCallback(
    async (t: Template, status: "published" | "sandbox") => {
      if (busyId) return;
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
    [busyId, load],
  );

  const editHref = (t: Template) =>
    `${TGV_BASE}/${LANG}/editor/template/${encodeURIComponent(t.templateId)}`;
  const previewHref = (t: Template) =>
    `${TGV_BASE}/${LANG}/preview/template/${encodeURIComponent(t.templateId)}`;

  return (
    <>
      {error && <ErrorBox role="alert">{error}</ErrorBox>}

      {templates === null && <Note>Loading store pages…</Note>}

      {templates !== null && storePages.length === 0 && (
        <Note>
          No storefront templates in the gallery yet. They arrive with the
          shared-templates seed (default-confirmation, default-product,
          default-cart) — or compose one in the Template Gallery with category
          &ldquo;storefront&rdquo; and it appears here.
        </Note>
      )}

      {storePages.length > 0 && (
        <Grid>
          {storePages.map((t) => {
            const thumb = thumbnailUrl(t.thumbnail);
            const isLive = t.status === "published";
            const busy = busyId === t.templateId;
            const role = SEED_ROLE[t.templateId];
            return (
              <Card key={t.templateId}>
                <CardTitleRow>
                  <CardTitle title={t.label}>{t.label}</CardTitle>
                  <StatusChip $live={isLive}>
                    {isLive ? "Deployed" : "Unpublished"}
                  </StatusChip>
                </CardTitleRow>

                {/* The card body opens the REAL tgv.com editor on this
                    template — clicking a template in a desk means editing it. */}
                <Thumb
                  href={editHref(t)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Edit ${t.label}`}
                  $busy={busy}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" loading="lazy" />
                  ) : (
                    <NoThumb>No preview</NoThumb>
                  )}
                </Thumb>

                <CardMeta>
                  {t.templateId} · seeds <code>/{t.suggestedSlug}</code>
                </CardMeta>
                <CardDesc title={t.description}>
                  {role ?? t.description}
                </CardDesc>

                <CardActions>
                  <ActionLink
                    href={editHref(t)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Edit in the editor →
                  </ActionLink>
                  <ActionLink
                    href={previewHref(t)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <EyeIcon size={12} /> Preview
                  </ActionLink>
                </CardActions>

                {/* The ruling control. PillBar has no disabled prop, so the
                    wrapper parks the pointer while a flip is in flight. */}
                <PillWrap $busy={busy} aria-busy={busy}>
                  <PillBar
                    fill
                    accent={rgb.violet}
                    ariaLabel={`Deployment for ${t.label}`}
                    active={isLive ? "published" : "sandbox"}
                    onChange={(k: string) => {
                      if (k === "published" && !isLive) void setStatus(t, "published");
                      if (k === "sandbox" && isLive) void setStatus(t, "sandbox");
                    }}
                    segments={[
                      { key: "published", label: "Deploy" },
                      { key: "sandbox", label: "Unpublish" },
                    ]}
                  />
                </PillWrap>
              </Card>
            );
          })}
        </Grid>
      )}

      {storePages.length > 0 && (
        <FootNote>
          Deployed = members can pick it in their editor, and it governs what
          future stores are seeded with. Unpublished = hidden from members;
          seeds fall back to the built-in default, so a new store never lands
          on a missing page. Edits reach future seeds only — pages already on
          a tenant&apos;s site are never retouched.
        </FootNote>
      )}
    </>
  );
}

/* ── Styled (Modules violet canon — Template Gallery tile idiom) ────────── */

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 0.75rem;
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

const CardTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
`;

const CardTitle = styled.div`
  flex: 1;
  font-size: 0.9rem;
  font-weight: 700;
  color: ${colors.violet};
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

const Thumb = styled.a<{ $busy: boolean }>`
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border-radius: 0.4rem;
  border: 1px solid var(--t-border);
  background: var(--t-inputBg);
  opacity: ${({ $busy }) => ($busy ? 0.45 : 1)};
  transition: opacity 0.15s, border-color 0.15s;

  &:hover {
    border-color: rgba(${rgb.violet}, 0.6);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
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

const CardMeta = styled.div`
  font-size: 0.65rem;
  color: var(--t-textFaint);
  letter-spacing: 0.03em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  code {
    color: rgba(${rgb.violet}, 0.9);
  }
`;

const CardDesc = styled.div`
  font-size: 0.72rem;
  line-height: 1.4;
  color: var(--t-textFaint);
`;

const CardActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.9rem;
`;

const ActionLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: ${colors.violet};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const PillWrap = styled.div<{ $busy: boolean }>`
  margin-top: 0.25rem;
  pointer-events: ${({ $busy }) => ($busy ? "none" : "auto")};
  opacity: ${({ $busy }) => ($busy ? 0.55 : 1)};
`;

const Note = styled.div`
  padding: 1rem;
  border-radius: 0.6rem;
  font-size: 0.85rem;
  color: var(--t-textMuted);
  background: var(--t-inputBg);
  border: 1px dashed var(--t-border);
`;

const FootNote = styled.div`
  margin-top: 1rem;
  font-size: 0.72rem;
  line-height: 1.5;
  color: var(--t-textFaint);
`;

const ErrorBox = styled.div`
  margin-bottom: 0.75rem;
  padding: 0.6rem 0.8rem;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  color: rgb(248, 113, 113);
  border: 1px solid rgba(248, 113, 113, 0.35);
  background: rgba(248, 113, 113, 0.07);
`;
