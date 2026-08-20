"use client";

// ────────────────────────────────────────────────────────────────────────────
// CatalogBlockEditor — Phase 3 (platform) + 4.3 (per-tenant) + edit-mode UX refactor.
//
// The DATA-mode editor for a mirrored page-editor catalog block (Sandbox workshop, admin),
// broken into independently collapsible ADDM (Accordion Dropdown) sections so each piece can be shown/hidden:
//   • Summary       — id · version · scope · status (read-only glance)
//   • Canon         — component-library ratification (P3): proposed|ratified + Ratify / Send back
//   • Scope & Deploy — scope SBDM (Platform default vs a tenant) + version + update badge +
//                      Save / Deploy / Reset / Remove
//   • Preview        — the live render from the working props
//   • Edit           — the block's own EditorPanel (data) ⇄ StyleToggles (look) ⇄ JSON, on a PillBar.
//                      An entry with NO hand-written panel gets AutoPanel instead: controls derived
//                      from its defaultProps (P5), so a brand-new entry arrives ratifiable without
//                      anyone hand-writing a panel first. JSON stays a face, not a fallback.
// Collapse state persists per-section in localStorage. Scope is a searchable SBDM.
//
//   load   → GET   ?id=[&tenantId=]&mode=draft → published → in-code
//   deploy → PUT then POST (double-verified): "cascade to all" (platform) / "save for <tenant>"
// A tenant overlay older than the block's current version surfaces an "update available" badge
// → the Phase 4.6 ComponentUpdateModal (blast-radius + reconcile).
//
// RATIFICATION (Gio 2026-08-02: "slider toggles for every property … before we ratify and push it
// up to the canon"). The Canon section is the second of the two gates — deploying the DEFAULTS
// (Scope & Deploy, `content_overrides`) says "these are the props"; ratifying (`catalog_entries`)
// says "this piece is sound". Ratify runs BOTH in order — deploy the tuned defaults, then flip the
// status — so a ratified entry can never point at props nobody shipped. An entry with no stored
// row takes its birth state from code (`entry.proposed`), which is what grandfathers the catalog.
// ────────────────────────────────────────────────────────────────────────────

import React from "react";
import styled from "styled-components";
import { findEntry } from "@/lib/domains/editor/component-library/registry";
import { versionFor } from "@/lib/domains/editor/component-library/versions";
import ADDM from "@tgv/module-component-library/components/ui/ADDM";
import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import SBDM, { type SBDMItem } from "@tgv/module-component-library/components/ui/SBDM";
import AutoPanel from "@/lib/domains/editor/component-library/AutoPanel";
import ComponentUpdateModal from "./ComponentUpdateModal";

const BLOCK_API = "/api/sandbox/block-default";
const TENANT_API = "/api/sandbox/tenant-overlay";
const CANON_API = "/api/sandbox/catalog-status";

type Scope = { kind: "platform" } | { kind: "tenant"; id: string; label: string };
type Member = { id: string; label: string };
type Face = "data" | "style" | "json";

/** One stored ruling from `catalog_entries`. Absent ⇒ the entry's birth state from code. */
type CanonRow = {
  catalogId: string;
  status: "proposed" | "ratified";
  proposedAt: string | null;
  ratifiedAt: string | null;
  sentBackAt: string | null;
  note: string | null;
};

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
type OpenState = { canon: boolean; scope: boolean; preview: boolean; edit: boolean };
const DEFAULT_OPEN: OpenState = { canon: true, scope: true, preview: true, edit: true };
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

export default function CatalogBlockEditor({
  catalogId,
  showPreview = true,
  showScope = true,
  showEdit = true,
}: {
  catalogId: string;
  /** Show/hide whole sections — driven by the modal's header Scope/Preview/Content buttons.
   *  (The ADDM toggles collapse a section's content while it is shown.) */
  showPreview?: boolean;
  showScope?: boolean;
  showEdit?: boolean;
}) {
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
  const [face, setFace] = React.useState<Face>("data");
  const [canon, setCanon] = React.useState<CanonRow | null>(null);
  const [canonBusy, setCanonBusy] = React.useState(false);
  const [sendBack, setSendBack] = React.useState<string | null>(null); // null = form closed

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

  // The stored ruling, if any. A miss is not an error — the code-derived birth
  // state below covers it, which is why this never blocks the editor.
  const loadCanon = React.useCallback(() => {
    fetch(`${CANON_API}?id=${encodeURIComponent(catalogId)}`)
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((j) => setCanon((j?.rows?.[0] as CanonRow) ?? null))
      .catch(() => setCanon(null));
  }, [catalogId]);

  React.useEffect(() => { loadCanon(); }, [loadCanon]);

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

  async function rule(action: "ratify" | "send-back", note?: string) {
    setCanonBusy(true);
    try {
      // Ratifying is a two-step on purpose: the tuned defaults must be LIVE before
      // the entry is called canon, or "ratified" would point at props nobody shipped.
      // Only platform scope may ratify — a tenant overlay is one site's opinion,
      // not the canon (the button is hidden off-platform; this is the backstop).
      if (action === "ratify" && scope.kind === "platform") await publish();
      const r = await fetch(CANON_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: catalogId, action, note }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `HTTP ${r.status}`);
      const j = await r.json();
      setCanon((j?.row as CanonRow) ?? null);
      setSendBack(null);
    } catch (e) {
      setStatus({ kind: "error", msg: (e as Error).message });
    } finally {
      setCanonBusy(false);
    }
  }

  if (!entry) return <FailNote>Unknown catalog block: {catalogId}</FailNote>;

  const Render = entry.Render as React.FC<{ props: Record<string, unknown> }>;
  const EditorPanel = entry.EditorPanel as
    | React.FC<{ props: Record<string, unknown>; onChange: (n: Record<string, unknown>) => void }>
    | undefined;
  const StyleToggles = entry.StyleToggles as
    | React.FC<{ props: Record<string, unknown>; onChange: (n: Record<string, unknown>) => void }>
    | undefined;
  // Every face edits the SAME props object, so the preview above stays live whichever is open.
  // Content is EditorPanel when the entry ships one and AutoPanel when it doesn't; JSON is always
  // offered, because a generated panel can honestly say "I can't edit this" (an empty object list,
  // a hidden key) and the admin tuning defaults before ratification still needs a way in.
  const hasProps = Object.keys(props ?? {}).length > 0;
  const faces: { key: Face; label: string }[] = [
    ...(EditorPanel || hasProps ? [{ key: "data" as Face, label: "Content" }] : []),
    ...(StyleToggles ? [{ key: "style" as Face, label: "Style" }] : []),
    { key: "json", label: "JSON" },
  ];
  const showStyle = face === "style" && !!StyleToggles;
  // A face that no longer exists (entry switched, props emptied) falls back to JSON rather than
  // rendering nothing at all.
  const showData = face === "data" && (!!EditorPanel || hasProps);

  // Code is the birth state; a stored row supersedes it (see ratification.ts).
  const canonStatus: "proposed" | "ratified" =
    canon?.status ?? (entry.proposed === true ? "proposed" : "ratified");
  const canonStored = !!canon;

  const updateAvailable = scope.kind === "tenant" && loadedVersion != null && loadedVersion < currentVersion;

  return (
    <Wrap>
      {/* No internal Summary section — the modal's Summary covers the glance; the block id,
          version, scope, status, and update badge all live in Scope & Deploy below. Each section
          here is a TOP-LEVEL toggleable sibling (mounted flat in the modal, never nested). */}

      {/* Canon — the ratification gate (P3). Always shown: whether a block is canon is
          not a per-view preference, and the chip is how you tell at a glance. */}
      <ADDM label="Canon" accent="neutral" open={open.canon} onOpenChange={(o) => toggle("canon", o)}>
        <Row>
          <CanonPill $ratified={canonStatus === "ratified"}>
            {canonStatus === "ratified" ? "Ratified ✓" : "Proposed — not canon yet"}
          </CanonPill>
          <CanonWhen>
            {canonStatus === "ratified"
              ? canon?.ratifiedAt
                ? `ratified ${fmtDate(canon.ratifiedAt)}`
                : canonStored
                  ? "ratified"
                  : "canon by age — predates the ratification gate"
              : canon?.sentBackAt
                ? `sent back ${fmtDate(canon.sentBackAt)}`
                : canon?.proposedAt
                  ? `proposed ${fmtDate(canon.proposedAt)}`
                  : "new entry, awaiting review"}
          </CanonWhen>
        </Row>
        {canon?.note && (
          <NoteBox>
            <NoteLabel>Sent back with:</NoteLabel> {canon.note}
          </NoteBox>
        )}
        {canonStatus === "proposed" ? (
          <>
            <CanonHint>
              Tune the defaults below, then ratify — ratifying deploys the current props first, so
              the canon and what ships are the same thing.
            </CanonHint>
            <Controls>
              <RatifyBtn
                onClick={() => rule("ratify")}
                disabled={canonBusy || !!jsonErr || scope.kind === "tenant"}
                title={
                  scope.kind === "tenant"
                    ? "Switch to Platform default to ratify — a tenant overlay is one site's opinion, not the canon"
                    : "Deploy these defaults and add this block to the canon"
                }
              >
                {canonBusy ? "Ratifying…" : "Ratify → canon"}
              </RatifyBtn>
              {sendBack === null ? (
                <GhostBtn onClick={() => setSendBack("")} disabled={canonBusy}>Send back…</GhostBtn>
              ) : (
                <>
                  <NoteInput
                    autoFocus
                    value={sendBack}
                    placeholder="What needs changing?"
                    onChange={(e) => setSendBack(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && sendBack.trim()) rule("send-back", sendBack.trim());
                      if (e.key === "Escape") setSendBack(null);
                    }}
                  />
                  <GhostBtn
                    onClick={() => rule("send-back", sendBack.trim())}
                    disabled={canonBusy || !sendBack.trim()}
                    title="Return it with a note — the note is the point, so it is required"
                  >
                    Send back
                  </GhostBtn>
                  <GhostBtn onClick={() => setSendBack(null)}>Cancel</GhostBtn>
                </>
              )}
            </Controls>
          </>
        ) : (
          <Controls>
            <GhostBtn
              onClick={() => setSendBack("")}
              disabled={canonBusy || sendBack !== null}
              title="Pull this entry back out of the canon for another pass"
            >
              Send back…
            </GhostBtn>
            {sendBack !== null && (
              <>
                <NoteInput
                  autoFocus
                  value={sendBack}
                  placeholder="Why is it coming back out?"
                  onChange={(e) => setSendBack(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && sendBack.trim()) rule("send-back", sendBack.trim());
                    if (e.key === "Escape") setSendBack(null);
                  }}
                />
                <GhostBtn onClick={() => rule("send-back", sendBack.trim())} disabled={canonBusy || !sendBack.trim()}>
                  Confirm
                </GhostBtn>
                <GhostBtn onClick={() => setSendBack(null)}>Cancel</GhostBtn>
              </>
            )}
          </Controls>
        )}
      </ADDM>

      {/* Scope & Deploy — shown/hidden by the modal's header Scope button. */}
      {showScope && (
      <ADDM label="Scope & Deploy" accent="pink" open={open.scope} onOpenChange={(o) => toggle("scope", o)}>
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
          <StatusPill $status={status.kind}>{statusLabel(status)}</StatusPill>
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
      </ADDM>
      )}

      {/* Preview — shown/hidden by the modal's header Preview button (showPreview);
          the ADDM toggle collapses it while shown. */}
      {showPreview && (
        <ADDM label="Preview" accent="cyan" open={open.preview} onOpenChange={(o) => toggle("preview", o)}>
          <PreviewFrame>
            <PreviewBoundary>
              <Render props={props} />
            </PreviewBoundary>
          </PreviewFrame>
        </ADDM>
      )}

      {/* Edit — shown/hidden by the modal's header Content button. */}
      {showEdit && (
      <ADDM
        label="Edit · defaults"
        accent="gold"
        open={open.edit}
        onOpenChange={(o) => toggle("edit", o)}
      >
        {/* Content ⇄ Style, the same two faces the page editor's SectionAccordion offers.
            Only shown when the entry actually ships a StyleToggles — a one-segment
            PillBar would be a control that decides nothing. */}
        {faces.length > 1 && (
          <FaceBar>
            <PillBar
              segments={faces.map((f) => ({ key: f.key, label: f.label }))}
              active={face}
              onChange={(k) => setFace(k as Face)}
              ariaLabel="Edit face"
            />
          </FaceBar>
        )}
        <EditorScroll>
          {showStyle && StyleToggles ? (
            <StyleToggles props={props} onChange={onPanelChange} />
          ) : showData ? (
            EditorPanel ? (
              <EditorPanel props={props} onChange={onPanelChange} />
            ) : (
              <AutoPanel props={props} onChange={onPanelChange} hints={entry.controls} title="Defaults" />
            )
          ) : (
            <>
              <JsonArea spellCheck={false} value={json} onChange={(e) => onJsonChange(e.target.value)} />
              {jsonErr && <FailNote>{jsonErr}</FailNote>}
            </>
          )}
        </EditorScroll>
      </ADDM>
      )}

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

/** Short, local, and never a raw ISO string in front of Gio and Marthe. */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
`;
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
const CanonPill = styled.span<{ $ratified: boolean }>`
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  color: ${(p) => (p.$ratified ? "#6ee7a8" : "#ffb86b")};
  background: ${(p) => (p.$ratified ? "rgba(110,231,168,0.12)" : "rgba(255,184,107,0.12)")};
  border: 1px solid ${(p) => (p.$ratified ? "rgba(110,231,168,0.5)" : "#ffb86b")};
`;
const CanonWhen = styled.span`font-size: 11px; color: rgba(255,255,255,0.45);`;
const CanonHint = styled.p`
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.55);
`;
const NoteBox = styled.div`
  margin: 0 0 10px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.8);
  border-left: 2px solid #ffb86b;
  border-radius: 0 6px 6px 0;
  background: rgba(255, 184, 107, 0.07);
`;
const NoteLabel = styled.strong`color: #ffb86b; font-weight: 700;`;
const NoteInput = styled.input`
  flex: 1 1 220px;
  min-width: 180px;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 7px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.18);
  outline: none;
  &:focus { border-color: #ffb86b; }
`;
const FaceBar = styled.div`
  display: flex;
  justify-content: flex-start;
  margin-bottom: 10px;
`;
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
const RatifyBtn = styled(BtnBase)`
  border-color: rgba(110, 231, 168, 0.6);
  color: #6ee7a8;
  font-weight: 600;
`;
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
