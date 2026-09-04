"use client";

/**
 * WizardsPanelHost — Office's mount of the shared WizardsPanel.
 *
 * The panel and its board live in @tgv/module-wizards, which deliberately does
 * NOT import @tgv/module-page-editor (that package already depends on
 * module-connect siblings, so importing it back would close a cycle). The host
 * is where the two meet: this component passes `renderSlide` down, and it is the
 * only place LayerRenderer is named.
 *
 * Each artboard mounts LayerRenderer at the slide's LOGICAL width — the board's
 * own transform does the shrinking, so a slide is drawn once at its authored
 * geometry and composited, never re-laid-out per zoom step.
 *
 * The other host slot is `onOpenSlide` — double-clicking an artboard. Editing a
 * slide is a NEW TAB on tinyglobalvillage.com, not a canvas in this modal: the
 * page editor edits a `page_models` draft behind tgv.com's own passkey session,
 * which Office cannot present cross-origin. HQ's /[lang]/editor/wizard/[key]/[step]
 * checks the slide out into the operator's scratch draft and hands them the real
 * editor; the Studio overlay's "Save to slide" checks it back in. The Template
 * Gallery's Edit action learned all of this first — see TemplateGalleryPanel.
 */
import { useCallback } from "react";
import { WizardsPanel, type WizardStep } from "@tgv/module-wizards";
import LayerRenderer from "@tgv/module-page-editor/editor/renderer/LayerRenderer";
import type { LayersFrame } from "@tgv/module-component-library/types/editor/LayerNodeType";

/** Where the real editor lives. Same pair TemplateGalleryPanel uses. */
const TGV_BASE = process.env.NEXT_PUBLIC_TGV_URL ?? "https://tinyglobalvillage.com";
const LANG = "en";

export default function WizardsPanelHost() {
  // SYNCHRONOUS on purpose. A popup opened after an await has lost its
  // user-gesture context and the browser swallows it — which reads as
  // "double-click does nothing". Everything that needs the DB (resolving the
  // wizard, seeding from the catalog when there is no row yet, writing the
  // scratch draft) happens in the route on the other side, where it has the
  // session it needs anyway.
  //
  // The key arrives separately from the row because a catalog wizard nobody has
  // edited yet HAS no row — and that is the common case on a fresh board. HQ
  // falls back to the catalog seed, so the door opens either way.
  const onOpenSlide = useCallback((wizardKey: string, step: WizardStep) => {
    window.open(
      `${TGV_BASE}/${LANG}/editor/wizard/${encodeURIComponent(wizardKey)}/${encodeURIComponent(step.key)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, []);

  const renderSlide = useCallback(
    (step: WizardStep, ctx: { width: number; height: number; zoom: number }) => {
      const doc = step.doc;
      if (!doc || !doc.layers?.length) return null; // → the board's title card
      // A slide is one section band as tall as the artboard. `bp="desktop"` is
      // pinned rather than measured: the artboard is always 1426 logical px wide
      // whatever the screen is, so resolving real @media rules would give a
      // phone-sized reader a mobile slide inside a desktop-width frame.
      const frame: LayersFrame = doc.frame ?? { desktop: { h: ctx.height } };
      return (
        <div style={{ width: ctx.width, minHeight: ctx.height, pointerEvents: "none" }}>
          <LayerRenderer sectionId={`wizard_slide_${step.key}`} layers={doc.layers} frame={frame} bp="desktop" />
        </div>
      );
    },
    [],
  );

  return (
    <WizardsPanel apiBase="/api/wizards" renderSlide={renderSlide} onOpenSlide={onOpenSlide} />
  );
}
