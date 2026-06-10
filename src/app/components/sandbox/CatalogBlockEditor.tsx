"use client";

// ────────────────────────────────────────────────────────────────────────────
// CatalogBlockEditor — Phase 3 (data lane) of office-sandbox-catalog-mirror.
//
// The DATA-mode editor for a mirrored page-editor catalog block. Shown inside
// the Sandbox (workshop surface, admin) when a `catalog:*` entry is selected in
// edit mode. Lets an admin edit the block's DEFAULT props (placeholder text /
// values), persist a DRAFT, then DEPLOY (double-verified) so the new default
// cascades to every tenant that renders the block from defaults.
//
//   load   → GET  /api/sandbox/block-default?id=&mode=draft (then published, then in-code)
//   save   → PUT  /api/sandbox/block-default {id, data}      (persist, no deploy)
//   deploy → PUT then POST                                    (publish = cascade; double-verified)
//   reset  → editor back to in-code defaultProps (DELETE removes the override entirely)
//
// Reuses the block's OWN shipped EditorPanel (entry.EditorPanel) for a real form;
// falls back to a JSON editor for blocks that ship none. Live preview = entry.Render
// with the working props, behind an error boundary.
// ────────────────────────────────────────────────────────────────────────────

import React from "react";
import styled from "styled-components";
import { findEntry } from "@/lib/domains/editor/component-library/registry";

const API = "/api/sandbox/block-default";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "confirm" }
  | { kind: "publishing" }
  | { kind: "published" }
  | { kind: "error"; msg: string };

// ── tiny error boundary so a bad preview can't crash the modal ──────────────
class PreviewBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { children: React.ReactNode }) {
    // reset the boundary when the previewed content changes
    if (prev.children !== this.props.children && this.state.error)
      this.setState({ error: null });
  }
  render() {
    if (this.state.error)
      return (
        <FailNote>⚠ Preview threw: {this.state.error.message}</FailNote>
      );
    return <>{this.props.children}</>;
  }
}

export default function CatalogBlockEditor({ catalogId }: { catalogId: string }) {
  const entry = React.useMemo(() => findEntry(catalogId), [catalogId]);
  const inCode = React.useMemo(
    () => (entry?.defaultProps as Record<string, unknown>) ?? {},
    [entry],
  );

  const [props, setProps] = React.useState<Record<string, unknown>>(inCode);
  const [json, setJson] = React.useState<string>("");
  const [jsonErr, setJsonErr] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<Status>({ kind: "loading" });

  // Load latest draft → published → in-code default on mount / id change.
  React.useEffect(() => {
    let alive = true;
    setStatus({ kind: "loading" });
    (async () => {
      try {
        const draft = await fetch(`${API}?id=${encodeURIComponent(catalogId)}&mode=draft`).then((r) => r.json());
        let data: Record<string, unknown> | null =
          draft?.exists && draft.data ? draft.data : null;
        if (!data) {
          const pub = await fetch(`${API}?id=${encodeURIComponent(catalogId)}&mode=published`).then((r) => r.json());
          data = pub?.exists && pub.data ? pub.data : null;
        }
        if (!alive) return;
        const initial = data ?? inCode;
        setProps(initial);
        setJson(JSON.stringify(initial, null, 2));
        setStatus({ kind: "idle" });
      } catch {
        if (!alive) return;
        setProps(inCode);
        setJson(JSON.stringify(inCode, null, 2));
        setStatus({ kind: "idle" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [catalogId, inCode]);

  const onPanelChange = React.useCallback((next: Record<string, unknown>) => {
    setProps(next);
    setJson(JSON.stringify(next, null, 2));
    setStatus((s) => (s.kind === "published" || s.kind === "saved" ? { kind: "idle" } : s));
  }, []);

  const onJsonChange = (text: string) => {
    setJson(text);
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setProps(parsed as Record<string, unknown>);
        setJsonErr(null);
      } else {
        setJsonErr("Props must be a JSON object.");
      }
    } catch (e) {
      setJsonErr((e as Error).message);
    }
  };

  async function saveDraft(): Promise<boolean> {
    if (jsonErr) {
      setStatus({ kind: "error", msg: "Fix the JSON before saving." });
      return false;
    }
    setStatus({ kind: "saving" });
    try {
      const r = await fetch(API, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: catalogId, data: props }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `HTTP ${r.status}`);
      setStatus({ kind: "saved" });
      return true;
    } catch (e) {
      setStatus({ kind: "error", msg: (e as Error).message });
      return false;
    }
  }

  async function publish() {
    setStatus({ kind: "publishing" });
    try {
      // Save the on-screen props as the draft, then publish exactly that.
      const put = await fetch(API, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: catalogId, data: props }),
      });
      if (!put.ok) throw new Error("draft save failed");
      const r = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: catalogId }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `HTTP ${r.status}`);
      setStatus({ kind: "published" });
    } catch (e) {
      setStatus({ kind: "error", msg: (e as Error).message });
    }
  }

  function resetToInCode() {
    setProps(inCode);
    setJson(JSON.stringify(inCode, null, 2));
    setJsonErr(null);
    setStatus({ kind: "idle" });
  }

  async function removeOverride() {
    setStatus({ kind: "publishing" });
    try {
      const r = await fetch(`${API}?id=${encodeURIComponent(catalogId)}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      resetToInCode();
      setStatus({ kind: "published" });
    } catch (e) {
      setStatus({ kind: "error", msg: (e as Error).message });
    }
  }

  if (!entry) return <FailNote>Unknown catalog block: {catalogId}</FailNote>;

  const Render = entry.Render as React.FC<{ props: Record<string, unknown> }>;
  const EditorPanel = entry.EditorPanel as
    | React.FC<{ props: Record<string, unknown>; onChange: (n: Record<string, unknown>) => void }>
    | undefined;

  return (
    <Wrap>
      <Toolbar>
        <Title>
          Editing default · <code>{catalogId}</code>
        </Title>
        <Spacer />
        <StatusPill $status={status.kind}>{statusLabel(status)}</StatusPill>
        <GhostBtn onClick={resetToInCode} title="Reset the editor to the in-code default (does not change the DB)">
          Reset
        </GhostBtn>
        <GhostBtn onClick={removeOverride} title="Delete the override row(s) — reverts the platform default to in-code">
          Remove override
        </GhostBtn>
        <SaveBtn onClick={saveDraft} disabled={status.kind === "saving"}>
          {status.kind === "saving" ? "Saving…" : "Save draft"}
        </SaveBtn>
        {status.kind === "confirm" ? (
          <>
            <ConfirmText>Cascade to all tenants?</ConfirmText>
            <DeployBtn $confirm onClick={publish}>
              Confirm deploy
            </DeployBtn>
            <GhostBtn onClick={() => setStatus({ kind: "idle" })}>Cancel</GhostBtn>
          </>
        ) : (
          <DeployBtn
            onClick={() => setStatus({ kind: "confirm" })}
            disabled={status.kind === "publishing" || !!jsonErr}
            title="Publish this default so it cascades to every tenant rendering the block from defaults"
          >
            {status.kind === "publishing" ? "Deploying…" : "Deploy: data"}
          </DeployBtn>
        )}
      </Toolbar>

      <Split>
        <PreviewCol>
          <ColLabel>Live preview (from working props)</ColLabel>
          <PreviewFrame>
            <PreviewBoundary>
              <Render props={props} />
            </PreviewBoundary>
          </PreviewFrame>
        </PreviewCol>

        <EditorCol>
          <ColLabel>{EditorPanel ? "Default content" : "Default content (JSON)"}</ColLabel>
          <EditorScroll>
            {EditorPanel ? (
              <EditorPanel props={props} onChange={onPanelChange} />
            ) : (
              <>
                <JsonArea
                  spellCheck={false}
                  value={json}
                  onChange={(e) => onJsonChange(e.target.value)}
                />
                {jsonErr && <FailNote>{jsonErr}</FailNote>}
              </>
            )}
          </EditorScroll>
        </EditorCol>
      </Split>
    </Wrap>
  );
}

function statusLabel(s: Status): string {
  switch (s.kind) {
    case "loading": return "loading…";
    case "saving": return "saving…";
    case "saved": return "draft saved";
    case "confirm": return "confirm deploy";
    case "publishing": return "deploying…";
    case "published": return "deployed ✓";
    case "error": return `error: ${s.msg}`;
    default: return "ready";
  }
}

// ── styles ──────────────────────────────────────────────────────────────────
const PINK = "#ff4ecb";
const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  gap: 10px;
`;
const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
`;
const Title = styled.div`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  code { color: ${PINK}; }
`;
const Spacer = styled.div`flex: 1;`;
const ConfirmText = styled.span`font-size: 12px; color: rgba(255,255,255,0.7);`;
const StatusPill = styled.span<{ $status: Status["kind"] }>`
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: ${(p) =>
    p.$status === "error"
      ? "#ff7a7a"
      : p.$status === "published" || p.$status === "saved"
      ? "#6ee7a8"
      : "rgba(255,255,255,0.55)"};
`;
const BtnBase = styled.button`
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 7px;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.85);
  &:disabled { opacity: 0.5; cursor: default; }
`;
const GhostBtn = styled(BtnBase)``;
const SaveBtn = styled(BtnBase)`
  border-color: rgba(110, 231, 168, 0.5);
`;
const DeployBtn = styled(BtnBase)<{ $confirm?: boolean }>`
  border-color: ${(p) => (p.$confirm ? "#ff7a7a" : PINK)};
  color: ${(p) => (p.$confirm ? "#ff7a7a" : PINK)};
  font-weight: 600;
`;
const Split = styled.div`
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
  @media (max-width: 900px) { flex-direction: column; }
`;
const PreviewCol = styled.div`
  flex: 1.4;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;
const EditorCol = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;
const ColLabel = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.4);
`;
const PreviewFrame = styled.div`
  flex: 1;
  min-height: 200px;
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: #0b0b0f;
`;
const EditorScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.02);
`;
const JsonArea = styled.textarea`
  width: 100%;
  min-height: 320px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
  background: transparent;
  border: none;
  outline: none;
  resize: vertical;
`;
const FailNote = styled.div`
  margin: 8px 0;
  padding: 10px 12px;
  font-size: 12px;
  color: #ff9a9a;
  border: 1px solid rgba(255, 122, 122, 0.4);
  border-radius: 8px;
  background: rgba(255, 122, 122, 0.06);
`;
