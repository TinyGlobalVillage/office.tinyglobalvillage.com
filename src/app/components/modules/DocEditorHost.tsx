"use client";
// Modules → Doc Editor: the SAME workspace TGV's Editor → Doc Editor mounts (@tgv/module-docs),
// against Office's own mount of the route factory (/api/user/docs). One interface, one library —
// the gear, proofing and the staff fleet-engine switch included (Gio 2026-10-22).
//
// The open document (?doc=&kind=) and folder (?folder=) ride the URL beside ?view=docs, written
// with history.replaceState like the rest of ModulesClient — no useSearchParams, no Suspense.
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { DocEditorWorkspace } from "@tgv/module-docs/dashboard/workspace";
import type { DocKind } from "@tgv/module-docs/types";
import { SheetEditor } from "@tgv/module-sheets/sheets";

/**
 * Fills the rest of the Modules page (a flex column at least a viewport tall) so the workspace's
 * `height: 100%` means something — a spreadsheet's canvas is measured against its box before the
 * engine mounts, and inside a content-sized wrapper it came out 0px tall (UAT 2026-10-23).
 */
const Frame = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;

  > * {
    flex: 1 1 auto;
  }
`;

type State = { doc: string | null; kind: DocKind | null; folder: string | null };

const read = (): State => {
  const p = new URLSearchParams(window.location.search);
  const k = p.get("kind");
  return { doc: p.get("doc"), kind: k === "sheet" ? "sheet" : k === "page" ? "page" : null, folder: p.get("folder") };
};

const write = (patch: Record<string, string | null>) => {
  try {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(patch)) {
      if (v) url.searchParams.set(k, v);
      else url.searchParams.delete(k);
    }
    window.history.replaceState({}, "", url);
  } catch {
    /* best-effort, like the view param */
  }
};

export default function DocEditorHost() {
  const [state, setState] = useState<State>({ doc: null, kind: null, folder: null });
  useEffect(() => setState(read()), []);

  const onDocumentIdChange = useCallback((id: string | null, kind?: DocKind) => {
    setState((s) => ({ ...s, doc: id, kind: id ? kind ?? null : null }));
    write({ doc: id, kind: id ? kind ?? null : null });
  }, []);

  const onFolderIdChange = useCallback((id: string | null) => {
    setState((s) => ({ ...s, folder: id }));
    write({ folder: id });
  }, []);

  // No dashboardHref: the Modules view draws its own "← Modules" above the workspace.
  return (
    <Frame>
      <DocEditorWorkspace
        documentId={state.doc}
        documentKind={state.kind}
        onDocumentIdChange={onDocumentIdChange}
        folderId={state.folder}
        onFolderIdChange={onFolderIdChange}
        // Spreadsheets too (Gio 2026-10-23: "both") — the same injected Univer surface TGV mounts.
        renderSheet={(p) => <SheetEditor key={p.documentId} {...p} />}
      />
    </Frame>
  );
}
