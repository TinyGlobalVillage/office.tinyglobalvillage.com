"use client";

// ────────────────────────────────────────────────────────────────────────────
// CatalogBlockEditor — Phase 3 (platform) + 4.3 (per-tenant) + edit-mode UX refactor.
//
// The DATA-mode editor for a mirrored page-editor catalog block (Sandbox workshop, admin),
// broken into independently collapsible ADL sections so each piece can be shown/hidden:
//   • Summary       — id · version · scope · status (read-only glance)
//   • Scope & Deploy — scope SBDM (Platform default vs a tenant) + version + update badge +
//                      Save / Deploy / Reset / Remove
//   • Preview        — the live render from the working props
//   • Edit           — the block's own EditorPanel (JSON fallback)
// Collapse state persists per-section in localStorage. Scope is a searchable SBDM.
//
//   load   → GET   ?id=[&tenantId=]&mode=draft → published → in-code
//   deploy → PUT then POST (double-verified): "cascade to all" (platform) / "save for <tenant>"
// A tenant overlay older than the block's current version surfaces an "update available" badge
// → the Phase 4.6 ComponentUpdateModal (blast-radius + reconcile).
// ────────────────────────────────────────────────────────────────────────────

import React from "react";
import styled from "styled-components";
import { findEntry } from "@/lib/domains/editor/component-library/registry";
import { versionFor } from "@/lib/domains/editor/component-library/versions";
import ADL from "@tgv/module-component-library/components/ui/ADL";
import SBDM, { type SBDMItem } from "@tgv/module-component-library/components/ui/SBDM";
import ComponentUpdateModal from "./ComponentUpdateModal";

const BLOCK_API = "/api/sandbox/block-default";
const TENANT_API = "/api/sandbox/tenant-overlay";

type Scope = { kind: "platform" } | { kind: "tenant"; id: string; label: string };
type Member = { id: string; label: string };

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "confirm" }
  | { kind: "publishing" }
  | { kind: "published" }
  | { kind: "error"; msg: string };

// ── per-section collapse state (persisted) ──────────────────────────────────
type OpenState = { summary: boolean; scope: boolean; preview: boolean; edit: boolean };
const DEFAULT_OPEN: OpenState = { summary: true, scope: true, preview: true, edit: true };
const OPEN_KEY = "sandbox.catalogEditor.open.v1";
function readOpen(): OpenState {
  if (typeof window === "undefined") return DEFAULT_OPEN;
  try {
    return { ...DEFAULT_OPEN, ...(JSON.parse(localStorage.getItem(OPEN_KEY) || "{}") as Partial<OpenState>) };
  } catch {
    return DEFAULT_OPEN;
  }
}

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
    if (prev.children !== this.props.children && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) return <FailNote>Preview threw: {this.state.error.message}</FailNote>;
    return <>{this.props.children}</>;
  }
}

export default function CatalogBlockEditor({ catalogId }: { catalogId: string }) {
  const entry = React.useMemo(() => findEntry(catalogId), [catalogId]);
  const inCode = React.useMemo(
    () => (entry?.defaultProps as Record<string, unknown>) ?? {},
    [entry],
  );
  const currentVersion = React.useMemo(() => (entry ? versionFor(entry) : 1), [entry]);

  const [scope, setScope] = React.useState<Scope>({ kind: "platform" });
  const [members, setMembers] = React.useState<Member[]>([]);
  const [props, setProps] = React.useState<Record<string, unknown>>(inCode);
  const [json, setJson] = React.useState<string>("");
  const [jsonErr, setJsonErr] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<Status>({ kind: "loading" });
  const [loadedVersion, setLoadedVersion] = React.useState<number | null>(null);
  const [showUpdate, setShowUpdate] = React.useState(false);
  const [open, setOpen] = React.useState<OpenState>(DEFAULT_OPEN);

  React.useEffect(() => setOpen(readOpen()), []);
  const toggle = (k: keyof OpenState, v: boolean) =>
    setOpen((o) => {
      const next = { ...o, [k]: v };
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });

  const tenantId = scope.kind === "tenant" ? scope.id : null;

  // Member list for the scope SBDM (best-effort; admin-gated endpoint).
  React.useEffect(() => {
    let alive = true;
    fetch("/api/admin/members")
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((j) => {
        if (!alive) return;
        setMembers(
          (j?.members ?? []).map((m: Record<string, unknown>) => ({
            id: String(m.id),
            label: String(m.clientName || m.domain || m.subdomain || m.id),
          })),
        );
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const scopeItems: SBDMItem[] = React.useMemo(
    () => [{ key: "", label: "Platform default (cascade)" }, ...members.map((m) => ({ key: m.id, label: m.label }))],
    [members],
  );

  const loadUrl = React.useCallback(
    (mode: "draft" | "published") => {
      const q = `id=${encodeURIComponent(catalogId)}&mode=${mode}`;
      return tenantId ? `${TENANT_API}?${q}&tenantId=${tenantId}` : `${BLOCK_API}?${q}`;
    },
    [catalogId, tenantId],
  );

  React.useEffect(() => {
    let alive = true;
    setStatus({ kind: "loading" });
    setLoadedVersion(null);
    (async () => {
      try {
        const draft = await fetch(loadUrl("draft")).then((r) => r.json());
        let data: Record<string, unknown> | null = draft?.exists && draft.data ? draft.data : null;
        let ver: number | null = draft?.exists ? draft.version ?? null : null;
        if (!data) {
          const pub = await fetch(loadUrl("published")).then((r) => r.json());
          data = pub?.exists && pub.data ? pub.data : null;
          ver = pub?.exists ? pub.version ?? null : ver;
        }
        if (!alive) return;
        const initial = data ?? inCode;
        setProps(initial);
        setJson(JSON.stringify(initial, null, 2));
        setLoadedVersion(tenantId ? ver : null);
        setStatus({ kind: "idle" });
      } catch {
        if (!alive) return;
        setProps(inCode);
        setJson(JSON.stringify(inCode, null, 2));
        setStatus({ kind: "idle" });
      }
    })();
    return () => { alive = false; };
  }, [catalogId, inCode, loadUrl, tenantId]);

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

  const putBody = () =>
    tenantId
      ? { catalogId, tenantId, lang: "en", version: currentVersion, data: props }
      : { id: catalogId, data: props };

  async function saveDraft(): Promise<boolean> {
    if (jsonErr) { setStatus({ kind: "error", msg: "Fix the JSON before saving." }); return false; }
    setStatus({ kind: "saving" });
    try {
      const r = await fetch(tenantId ? TENANT_API : BLOCK_API, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(putBody()),
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
      const api = tenantId ? TENANT_API : BLOCK_API;
      const put = await fetch(api, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(putBody()),
      });
      if (!put.ok) throw new Error("draft save failed");
      const postBody = tenantId ? { catalogId, tenantId, lang: "en" } : { id: catalogId };
      const r = await fetch(api, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(postBody),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `HTTP ${r.status}`);
      setLoadedVersion(tenantId ? currentVersion : null);
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
      const url = tenantId
        ? `${TENANT_API}?id=${encodeURIComponent(catalogId)}&tenantId=${tenantId}`
        : `${BLOCK_API}?id=${encodeURIComponent(catalogId)}`;
      const r = await fetch(url, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      resetToInCode();
      setLoadedVersion(null);
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

  const scopeLabel = scope.kind === "tenant" ? scope.label : "Platform default";
  const updateAvailable = scope.kind === "tenant" && loadedVersion != null && loadedVersion < currentVersion;

  return (
    <Wrap>
      {/* Summary — read-only glance */}
      <ADL label="Summary" accent="gold" open={open.summary} onOpenChange={(o) => toggle("summary", o)}>
        <SummaryGrid>
          <SummaryItem><K>Block</K><V><code>{catalogId}</code></V></SummaryItem>
          <SummaryItem><K>Label</K><V>{entry.label}</V></SummaryItem>
          <SummaryItem><K>Version</K><V>v{currentVersion}</V></SummaryItem>
          <SummaryItem><K>Scope</K><V>{scopeLabel}</V></SummaryItem>
          <SummaryItem><K>Status</K><V><StatusPill $status={status.kind}>{statusLabel(status)}</StatusPill></V></SummaryItem>
          {updateAvailable && (
            <SummaryItem><K>Update</K><V><UpdateBadge onClick={() => setShowUpdate(true)}>v{loadedVersion} → v{currentVersion}</UpdateBadge></V></SummaryItem>
          )}
        </SummaryGrid>
      </ADL>

      {/* Scope & Deploy */}
      <ADL label="Scope & Deploy" accent="pink" open={open.scope} onOpenChange={(o) => toggle("scope", o)}>
        <Row>
          <RowLabel>Editing:</RowLabel>
          <span style={{ ["--ddm-accent" as string]: "#ff4ecb", ["--ddm-accent-rgb" as string]: "255, 78, 203" }}>
            <SBDM
              items={scopeItems}
              value={scope.kind === "platform" ? "" : scope.id}
              onSelect={(key) => {
                if (!key) setScope({ kind: "platform" });
                else {
                  const m = members.find((x) => x.id === key);
                  setScope({ kind: "tenant", id: key, label: m?.label ?? key });
                }
              }}
              placeholder="Platform default (cascade)"
              searchPlaceholder="Search tenants…"
              ariaLabel="Edit scope"
              minTriggerWidth={210}
            />
          </span>
          <VersionTag>v{currentVersion}</VersionTag>
          {updateAvailable && (
            <UpdateBadge onClick={() => setShowUpdate(true)} title="Reconcile this tenant overlay onto the current version">
              Update v{loadedVersion} → v{currentVersion}
            </UpdateBadge>
          )}
        </Row>
        <Controls>
          <GhostBtn onClick={resetToInCode} title="Reset the editor to the in-code default (does not change the DB)">Reset</GhostBtn>
          <GhostBtn onClick={removeOverride} title={scope.kind === "tenant" ? "Delete this tenant's overlay" : "Delete the platform override → revert to in-code"}>Remove override</GhostBtn>
          <SaveBtn onClick={saveDraft} disabled={status.kind === "saving"}>{status.kind === "saving" ? "Saving…" : "Save draft"}</SaveBtn>
          {status.kind === "confirm" ? (
            <>
              <ConfirmText>{scope.kind === "tenant" ? `Save as ${scope.label}'s override?` : "Cascade to all tenants?"}</ConfirmText>
              <DeployBtn $confirm onClick={publish}>Confirm deploy</DeployBtn>
              <GhostBtn onClick={() => setStatus({ kind: "idle" })}>Cancel</GhostBtn>
            </>
          ) : (
            <DeployBtn
              onClick={() => setStatus({ kind: "confirm" })}
              disabled={status.kind === "publishing" || !!jsonErr}
              title={scope.kind === "tenant" ? "Publish this tenant's overlay" : "Publish this default so it cascades to every tenant rendering the block from defaults"}
            >
              {status.kind === "publishing" ? "Deploying…" : scope.kind === "tenant" ? "Deploy: overlay" : "Deploy: data"}
            </DeployBtn>
          )}
        </Controls>
      </ADL>

      {/* Preview */}
      <ADL label="Preview" accent="cyan" open={open.preview} onOpenChange={(o) => toggle("preview", o)}>
        <PreviewFrame>
          <PreviewBoundary>
            <Render props={props} />
          </PreviewBoundary>
        </PreviewFrame>
      </ADL>

      {/* Edit */}
      <ADL label={EditorPanel ? "Edit · default content" : "Edit · default content (JSON)"} accent="gold" open={open.edit} onOpenChange={(o) => toggle("edit", o)}>
        <EditorScroll>
          {EditorPanel ? (
            <EditorPanel props={props} onChange={onPanelChange} />
          ) : (
            <>
              <JsonArea spellCheck={false} value={json} onChange={(e) => onJsonChange(e.target.value)} />
              {jsonErr && <FailNote>{jsonErr}</FailNote>}
            </>
          )}
        </EditorScroll>
      </ADL>

      {showUpdate && scope.kind === "tenant" && loadedVersion != null && (
        <ComponentUpdateModal
          catalogId={catalogId}
          tenantId={scope.id}
          tenantLabel={scope.label}
          fromVersion={loadedVersion}
          toVersion={currentVersion}
          onClose={() => setShowUpdate(false)}
          onApplied={() => { setShowUpdate(false); setLoadedVersion(currentVersion); }}
        />
      )}
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
  gap: 8px;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
`;
const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 6px 16px;
`;
const SummaryItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  code { color: ${PINK}; }
`;
const K = styled.span`
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.06em;
  min-width: 56px;
`;
const V = styled.span`color: rgba(255, 255, 255, 0.85);`;
const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
`;
const RowLabel = styled.span`font-size: 12px; color: rgba(255,255,255,0.55);`;
const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;
const VersionTag = styled.span`
  font-size: 11px;
  font-family: ui-monospace, monospace;
  color: rgba(255, 255, 255, 0.5);
  padding: 2px 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
`;
const UpdateBadge = styled.button`
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  cursor: pointer;
  color: #ffb86b;
  background: rgba(255, 184, 107, 0.12);
  border: 1px solid #ffb86b;
`;
const ConfirmText = styled.span`font-size: 12px; color: rgba(255,255,255,0.7);`;
const StatusPill = styled.span<{ $status: Status["kind"] }>`
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: ${(p) =>
    p.$status === "error" ? "#ff7a7a" : p.$status === "published" || p.$status === "saved" ? "#6ee7a8" : "rgba(255,255,255,0.55)"};
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
const SaveBtn = styled(BtnBase)`border-color: rgba(110, 231, 168, 0.5);`;
const DeployBtn = styled(BtnBase)<{ $confirm?: boolean }>`
  border-color: ${(p) => (p.$confirm ? "#ff7a7a" : PINK)};
  color: ${(p) => (p.$confirm ? "#ff7a7a" : PINK)};
  font-weight: 600;
`;
const PreviewFrame = styled.div`
  min-height: 220px;
  max-height: 60vh;
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: #0b0b0f;
`;
const EditorScroll = styled.div`
  max-height: 60vh;
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.02);
`;
const JsonArea = styled.textarea`
  width: 100%;
  min-height: 280px;
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
