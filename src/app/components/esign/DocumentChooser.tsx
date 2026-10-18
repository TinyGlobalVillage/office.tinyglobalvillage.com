"use client";

// DocumentChooser — what "Choose File" opens in the New Document wizard (Gio 2026-10-18:
// "when a user clicks Choose file, it should prompt them to select from their My Documents or
// upload from disk"). Two tabs:
//   My Documents — the repo's Agreement templates (1 / 2 / 3 signers, three pages, initials on
//                  every page) and every PDF an operator kept, from /api/esign/library.
//   From disk    — the shared UploadDropzone, with a tick to keep the file in My Documents.
// Picking hands the wizard a File; the wizard stages it exactly as a drop would, so nothing
// here uploads to Documenso — Send is still the only thing that sends.
// styled-components; shared lib controls (PillBar, IconButton, Checkbox, TextButton, Tooltip).

import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { useEffect, useState } from "react";
import styled from "styled-components";
import Checkbox from "@tgv/module-component-library/components/ui/Checkbox";
import IconButton from "@tgv/module-component-library/components/ui/IconButton";
import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import TextButton from "@tgv/module-component-library/components/ui/TextButton";
import ConfirmModal from "../frontdesk/ConfirmModal";
import UploadDropzone from "../UploadDropzone";
import { FileIcon, TrashIcon } from "../icons";

export type LibrarySource = "template" | "library";
export type LibraryEntry = {
  source: LibrarySource;
  name: string;
  title: string;
  size: number;
  addedAt: string;
  addedBy?: string;
  signers?: number;
  pages?: number;
};

type Tab = "mine" | "disk";

const XIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

type ChooserProps = {
  open: boolean;
  onClose: () => void;
  /** The chosen PDF, as a File the wizard stages like a drop. */
  onPick: (file: File) => void;
  /** A line for the wizard's message strip (e.g. "kept in My Documents", or why it was not). */
  onNotice?: (msg: string) => void;
};

export default function DocumentChooser(props: ChooserProps) {
  useEscapeToClose({ open: props.open, onClose: props.onClose });
  // The panel mounts fresh on every open, so each visit starts on My Documents with a clean list.
  return props.open ? <ChooserPanel {...props} /> : null;
}

function ChooserPanel({ onClose, onPick, onNotice }: ChooserProps) {
  const [tab, setTab] = useState<Tab>("mine");
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // the row being fetched / uploaded
  const [keep, setKeep] = useState(true);
  const [removing, setRemoving] = useState<LibraryEntry | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/esign/library", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { entries?: LibraryEntry[]; error?: string };
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j.entries ?? [];
      })
      .then((list) => {
        if (alive) setEntries(list);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setEntries([]);
        setError(e instanceof Error ? e.message : "Could not load My Documents");
      });
    return () => {
      alive = false;
    };
  }, []);

  // My Documents → bytes → File → the wizard stages it.
  const pickEntry = async (e: LibraryEntry) => {
    if (busy) return;
    setBusy(e.name);
    setError("");
    try {
      const r = await fetch(`/api/esign/library/${e.source}/${encodeURIComponent(e.name)}`, { cache: "no-store" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      onPick(new File([blob], e.name, { type: "application/pdf" }));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that document");
    } finally {
      setBusy(null);
    }
  };

  // From disk → stage it now; keeping it in My Documents is a separate, best-effort write.
  const pickDisk = async (fl: FileList) => {
    const f = fl[0];
    if (!f || busy) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file");
      return;
    }
    setBusy(f.name);
    setError("");
    if (keep) {
      try {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("title", f.name.replace(/\.pdf$/i, ""));
        const r = await fetch("/api/esign/library", { method: "POST", body: fd });
        const j = (await r.json().catch(() => ({}))) as { error?: string; detail?: string };
        if (!r.ok) throw new Error(j.error ? `${j.error}${j.detail ? ` — ${j.detail}` : ""}` : `HTTP ${r.status}`);
        onNotice?.(`${f.name} kept in My Documents`);
      } catch (err) {
        onNotice?.(`Staged, but not kept in My Documents: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }
    setBusy(null);
    onPick(f);
    onClose();
  };

  const remove = async (e: LibraryEntry) => {
    try {
      const r = await fetch(`/api/esign/library/library/${encodeURIComponent(e.name)}`, { method: "DELETE" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      setEntries((cur) => (cur ?? []).filter((x) => !(x.source === "library" && x.name === e.name)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that document");
    }
  };

  const templates = (entries ?? []).filter((e) => e.source === "template");
  const mine = (entries ?? []).filter((e) => e.source === "library");

  const row = (e: LibraryEntry) => {
    const meta = [
      e.signers ? `${e.signers} signer${e.signers === 1 ? "" : "s"}` : null,
      e.pages ? `${e.pages} page${e.pages === 1 ? "" : "s"}` : null,
      fmtSize(e.size),
      e.source === "library" ? fmtDate(e.addedAt) : null,
    ].filter(Boolean).join(" · ");
    const isBusy = busy === e.name;
    return (
      <Row key={`${e.source}/${e.name}`} $busy={isBusy}>
        <RowIcon><FileIcon size={18} /></RowIcon>
        <RowText>
          <RowTitle>{e.title}</RowTitle>
          <RowMeta>{meta}</RowMeta>
        </RowText>
        <RowActions>
          {e.source === "library" && (
            <IconButton label="Remove from My Documents" tone="danger" disabled={!!busy} onClick={() => setRemoving(e)}>
              <TrashIcon size={15} />
            </IconButton>
          )}
          <TextButton disabled={!!busy} onClick={() => void pickEntry(e)}>{isBusy ? "Opening…" : "Use"}</TextButton>
        </RowActions>
      </Row>
    );
  };

  return (
    <>
      <Backdrop onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
        <Panel role="dialog" aria-modal="true" aria-label="Choose a document">
          <Header>
            <div>
              <Title>Choose a document</Title>
              <Sub>Pick one from My Documents, or upload a PDF from disk. Nothing is sent until you press Send.</Sub>
            </div>
            <IconButton label="Close" onClick={onClose}><XIcon /></IconButton>
          </Header>

          <Tabs>
            <PillBar
              segments={[
                { key: "mine", label: "My Documents", count: entries ? entries.length : undefined },
                { key: "disk", label: "From disk" },
              ]}
              active={tab}
              onChange={(k) => setTab(k as Tab)}
            />
          </Tabs>

          <Body>
            {error && <Err onClick={() => setError("")}>{error}</Err>}

            {tab === "mine" && (
              entries === null ? (
                <Empty>Loading My Documents…</Empty>
              ) : (
                <>
                  <Group>
                    <GroupLabel>Templates</GroupLabel>
                    {templates.length === 0 ? <Empty>No templates on this server.</Empty> : templates.map(row)}
                  </Group>
                  <Group>
                    <GroupLabel>Uploaded</GroupLabel>
                    {mine.length === 0 ? (
                      <Empty>
                        Nothing kept yet. Upload from disk with “Keep in My Documents” ticked and it lands here.
                      </Empty>
                    ) : (
                      mine.map(row)
                    )}
                  </Group>
                </>
              )
            )}

            {tab === "disk" && (
              <>
                <UploadDropzone
                  accept="application/pdf"
                  disabled={!!busy}
                  headline={busy ? `Reading ${busy}…` : "Drop your PDF here to upload"}
                  hint="Works with any .PDF file up to 20 MB."
                  recommendation="Staged until you press Send"
                  onFiles={(fl) => void pickDisk(fl)}
                />
                <KeepRow>
                  <Checkbox checked={keep} onChange={setKeep} disabled={!!busy}>Keep in My Documents</Checkbox>
                  <KeepHint>So it is on the list next time, for any signer.</KeepHint>
                </KeepRow>
              </>
            )}
          </Body>
        </Panel>
      </Backdrop>

      <ConfirmModal
        open={!!removing}
        title="Remove from My Documents?"
        message={removing ? `“${removing.title}” leaves the list. Documents already sent are not affected.` : ""}
        confirmLabel="Remove"
        intent="danger"
        onConfirm={async () => { const e = removing; setRemoving(null); if (e) await remove(e); }}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}

// ── styled ──────────────────────────────────────────────────────────────────────
// One tier above the wizard (1000) so it reads as the wizard's own prompt, under the
// confirm (12000) and the prep room.
const Backdrop = styled.div`
  position: fixed; inset: 0; z-index: 1010;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
`;
const Panel = styled.div`
  width: min(600px, 100%); max-height: 86vh; display: flex; flex-direction: column;
  background: #0d0d12; border: 1px solid rgba(120,200,255,0.18); border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.6); color: #e8e8ef; overflow: hidden;
  --checkbox-label: rgba(232,232,239,0.85);
`;
const Header = styled.div`
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 18px 20px 14px; border-bottom: 1px solid rgba(255,255,255,0.07);
`;
const Title = styled.h2`margin: 0; font-size: 17px; font-weight: 650;`;
const Sub = styled.p`margin: 4px 0 0; font-size: 12.5px; line-height: 1.45; color: rgba(232,232,239,0.55);`;
const Tabs = styled.div`padding: 12px 20px 0;`;
const Body = styled.div`
  flex: 1 1 auto; min-height: 0; overflow: auto; padding: 14px 20px 20px;
  display: flex; flex-direction: column; gap: 14px;
`;
const Group = styled.div`display: flex; flex-direction: column; gap: 6px;`;
const GroupLabel = styled.div`
  font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  color: rgba(232,232,239,0.5); margin-bottom: 2px;
`;
const Row = styled.div<{ $busy: boolean }>`
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
  background: ${(p) => (p.$busy ? "rgba(120,200,255,0.08)" : "rgba(255,255,255,0.03)")};
  transition: background 0.15s ease;
  &:hover { background: rgba(255,255,255,0.05); }
`;
const RowIcon = styled.div`flex: 0 0 auto; color: rgba(120,200,255,0.9); display: flex;`;
const RowText = styled.div`flex: 1 1 auto; min-width: 0;`;
const RowTitle = styled.div`font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
const RowMeta = styled.div`margin-top: 2px; font-size: 11.5px; color: rgba(232,232,239,0.5);`;
const RowActions = styled.div`flex: 0 0 auto; display: flex; align-items: center; gap: 4px;`;
const Empty = styled.div`
  font-size: 12.5px; line-height: 1.5; color: rgba(232,232,239,0.5); padding: 8px 2px;
`;
const Err = styled.div`
  padding: 8px 12px; border-radius: 8px; font-size: 12.5px; cursor: pointer;
  background: rgba(255,110,110,0.12); border: 1px solid rgba(255,110,110,0.35); color: #ffb3b3;
`;
const KeepRow = styled.div`display: flex; align-items: center; gap: 12px; flex-wrap: wrap;`;
const KeepHint = styled.span`font-size: 11.5px; color: rgba(232,232,239,0.5);`;
