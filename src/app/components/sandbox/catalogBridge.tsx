"use client";

// ────────────────────────────────────────────────────────────────────────────
// Catalog bridge — Phase 1 of office-sandbox-catalog-mirror.
//
// Adapts the page-editor CATALOG (the ~80 blocks/sections the editor can insert)
// into SandboxEntry rows so EVERY catalog block is browsable + live-rendered in
// BOTH Office surfaces: the Sandbox (workshop) AND the Component Library.
//
// Phase 1 is VIEW-ONLY: each block renders from its defaultProps via entry.Render,
// wrapped in an error boundary so one throwing block can't crash the modal.
// Editing → persist → 3-way deploy is Phase 3.
//
// Import discipline (this is what the prior attempt got wrong):
//   • We import the catalog REGISTRY + METADATA only — never the editor `bridge/`
//     (its value import of createBlockForKind would drag in editor-shell code),
//     and never the bare `@tgv/module-component-library` root barrel as a STATIC
//     import (it re-exports unrelated R3F components). Deep subpaths only.
//   • Resolution relies on the tsconfig path aliases added to this app:
//       @/lib/domains/editor/*      → module-page-editor/editor/*
//       @/lib/components/*          → module-component-library/components/*
//       @tgv/module-component-library/* → module-component-library/*
// ────────────────────────────────────────────────────────────────────────────

import React from "react";
import { CATALOG } from "@/lib/domains/editor/component-library/registry";
import {
  ZONES,
  CATEGORIES as CATALOG_META,
} from "@/lib/domains/editor/component-library/metadata";
import type { ComponentEntry } from "@/lib/domains/editor/component-library/types";
import type { SandboxEntry } from "./registry";

const ZONE_LABEL: Record<string, string> = Object.fromEntries(
  ZONES.map((z) => [z.id, z.label]),
);
const CAT_META: Record<string, (typeof CATALOG_META)[number]> =
  Object.fromEntries(CATALOG_META.map((c) => [c.id, c]));

/** Sidebar group label for a catalog entry — zone-qualified so the page blocks
 *  cluster by zone and never collide with the hand-coded primitive categories
 *  (Buttons, Toggles, …). e.g. "Sections: Banners", "Header: Announcement Bar".
 *  The zone is derived from the CATEGORY's own meta (not the entry) so the label
 *  is always identical to the one CATALOG_CATEGORIES emits. */
function categoryLabelFor(entry: ComponentEntry): string {
  const meta = CAT_META[entry.category];
  const zoneId = meta?.zone ?? entry.zone;
  const zoneLabel = ZONE_LABEL[zoneId] ?? String(zoneId);
  const catLabel = meta?.label ?? String(entry.category);
  return `${zoneLabel}: ${catLabel}`;
}

// ── Error boundary so a throwing block degrades to a panel, not a crash ──────
class CatalogPreviewBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 20,
            maxWidth: 520,
            margin: "40px auto",
            border: "1px solid rgba(255,78,203,0.45)",
            borderRadius: 10,
            color: "rgba(255,255,255,0.78)",
            fontSize: 13,
            lineHeight: 1.5,
            background: "rgba(255,78,203,0.06)",
          }}
        >
          <strong style={{ color: "#ff4ecb" }}>
            ⚠ “{this.props.name}” failed to preview
          </strong>
          <span style={{ opacity: 0.8 }}>
            This block threw while rendering from its defaults. It’s still listed;
            the live preview just isn’t available here.
          </span>
          <code
            style={{ fontSize: 11, opacity: 0.6, wordBreak: "break-word" }}
          >
            {this.state.error.message}
          </code>
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}

/** Read-only "code" snippet shown in the modal's code pane for a catalog block. */
function codeSnippetFor(entry: ComponentEntry): string {
  let defaults: string;
  try {
    defaults = JSON.stringify(entry.defaultProps ?? {}, null, 2);
  } catch {
    defaults = "/* defaultProps not JSON-serializable */";
  }
  return [
    `// Page-editor catalog block "${entry.id}" — rendered live from its defaultProps.`,
    `// README: ${entry.readmePath}`,
    ``,
    `<Render props={defaultProps} />`,
    ``,
    `const defaultProps = ${defaults};`,
  ].join("\n");
}

function adapt(entry: ComponentEntry): SandboxEntry {
  const Render = entry.Render as React.FC<{ props: Record<string, unknown> }>;
  const Demo: React.FC = () => (
    <CatalogPreviewBoundary name={entry.label}>
      <Render props={(entry.defaultProps ?? {}) as Record<string, unknown>} />
    </CatalogPreviewBoundary>
  );
  Demo.displayName = `CatalogDemo(${entry.id})`;
  return {
    key: `catalog:${entry.id}`,
    name: entry.deprecated ? `${entry.label} (deprecated)` : entry.label,
    category: categoryLabelFor(entry),
    summary: entry.description,
    usage:
      `Page-editor catalog block · id "${entry.id}"` +
      (entry.tags?.length ? ` · ${entry.tags.join(", ")}` : ""),
    code: codeSnippetFor(entry),
    Demo,
  };
}

/** Non-hidden catalog entries only (mirrors the editor modal's own filter). */
const VISIBLE: ComponentEntry[] = CATALOG.filter((e) => !e.hiddenFromModal);

/** Catalog blocks as SandboxEntry rows — spread into the Office REGISTRY. */
export const CATALOG_SANDBOX_ENTRIES: SandboxEntry[] = VISIBLE.map(adapt);

/** New sidebar category labels, zone-clustered, deduped. Built from the actual
 *  entries so it is always exactly the set of labels adapt() produces — the
 *  modal groups via `m[e.category]`, so every entry's category MUST appear here. */
export const CATALOG_CATEGORIES: string[] = (() => {
  const zoneOrder = ZONES.map((z) => z.id);
  const sorted = [...VISIBLE].sort((a, b) => {
    const za = zoneOrder.indexOf(CAT_META[a.category]?.zone ?? a.zone);
    const zb = zoneOrder.indexOf(CAT_META[b.category]?.zone ?? b.zone);
    return za - zb;
  });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of sorted) {
    const label = categoryLabelFor(e);
    if (!seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
})();
