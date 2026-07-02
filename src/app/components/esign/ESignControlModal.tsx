"use client";

// ESignControlModal — TGV Office "E-Sign Documents" console (Utils → Documents group).
//
// Lifts the @tgv/module-legal/module-documenso e-sign engine (built for Studio waivers) onto
// Office so operators (Gio/Marthe) can send ANY document to ANYONE for signature.
//
// THREE views on a PillBar (2026-07-02 redesign — Upload+Send folded into one):
//   New Document — pick the mode (waiver = one shared /d/{token} link; multiple signatures =
//     Documenso document flow, each named signer gets their own emailed link + their own
//     SIGNATURE/DATE boxes), add recipients/signers, stage the PDF, then press SEND — nothing
//     dispatches until the button. Waiver recipients are optional (skip them to just get the link).
//   Activity — the outbox (sent → signed per recipient; X removes an entry, log-only).
//   Documents — the library w/ kind filter, per-signer status, copy-link, delete.
//
// Multisig boxes auto-stack on the last page IN THE ORDER SIGNERS ARE ADDED (top → bottom) —
// the UI says so, because a real doc's printed signature lines have a fixed order.
//
// Self-contained (styled-components, per Office's no-Tailwind rule). Inline SVGs — no emoji.

import { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import DDM, { type DDMItem } from "@tgv/module-component-library/components/ui/DDM";
import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import ConfirmModal from "../frontdesk/ConfirmModal";

// ── types (mirror the API payloads) ────────────────────────────────────────────
type DocKind = "waiver" | "multisig";
type DocSigner = {
  email: string;
  name: string | null;
  status: "pending" | "sent" | "signed" | "rejected";
  signedAt: string | null;
};
type DocRow = {
  id: string;
  title: string;
  slug: string;
  version: number;
  kind: DocKind;
  sendable: boolean;
  shareUrl: string | null;
  signers?: DocSigner[];
  signedCount?: number;
  signerCount?: number;
};
type StaffRow = { username: string; email: string; role: string };
type Recipient = { email: string; name: string | null };
type ActivityRow = {
  id: string;
  documentId: string;
  docTitle: string;
  docKind: DocKind;
  recipientEmail: string;
  recipientName: string | null;
  sentBy: string | null;
  channel: "email" | "link";
  note: string | null;
  sentAt: string;
  status: "pending" | "completed" | "signed" | "rejected";
  signedAt: string | null;
  signatureId: string | null;
  hasSignedPdf: boolean;
};

type Tab = "new" | "activity" | "documents";
type KindFilter = "all" | "waiver" | "multisig";

const TAB_SEGMENTS = [
  { key: "new", label: "New Document" },
  { key: "activity", label: "Activity" },
  { key: "documents", label: "Documents" },
];
const MODE_SEGMENTS = [
  { key: "waiver", label: "Waiver — one shared link" },
  { key: "multisig", label: "Multiple signatures" },
];
const CHANNEL_SEGMENTS = [
  { key: "email", label: "Email the link" },
  { key: "link", label: "Just record & copy" },
];
const KIND_SEGMENTS = [
  { key: "all", label: "All" },
  { key: "waiver", label: "Waivers" },
  { key: "multisig", label: "Multiple Signatures" },
];
const ACCENT = "58, 160, 255"; // modal cyan-blue (#3aa0ff)

// ── inline icons (currentColor) ─────────────────────────────────────────────────
const XIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const DownloadIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M7 11l5 5 5-5M4 21h16" />
  </svg>
);
const LinkIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </svg>
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ConfirmState = {
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
  run: () => Promise<void>;
};

export default function ESignControlModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("new");
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  // New Document state
  const [mode, setMode] = useState<DocKind>("waiver");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [customEmail, setCustomEmail] = useState("");
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState<"email" | "link">("email");
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null); // waiver link-channel result
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null); // 0–100 while sending; null = server processing
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // documents-tab kind filter (PillBar)
  const [docFilter, setDocFilter] = useState<KindFilter>("all");

  const loadDocuments = useCallback(async () => {
    try {
      const r = await fetch("/api/esign/documents");
      const d = await r.json();
      if (d?.ok) {
        setConfigured(Boolean(d.configured));
        setDocuments(d.documents ?? []);
        setStaff(d.staff ?? []);
      } else {
        setMsg(d?.error ?? "Failed to load documents");
      }
    } catch {
      setMsg("Failed to load documents (server error)");
    }
  }, []);
  const loadActivity = useCallback(async () => {
    try {
      const r = await fetch("/api/esign/activity");
      const d = await r.json();
      if (d?.ok) setActivity(d.sends ?? []);
      else setMsg(d?.error ?? "Failed to load activity");
    } catch {
      setMsg("Failed to load activity (server error)");
    }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([loadDocuments(), loadActivity()]);
      setLoading(false);
    })();
  }, [loadDocuments, loadActivity]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // A recorded link belongs to one upload; switching mode invalidates it.
  useEffect(() => { setRecordedUrl(null); }, [mode]);

  const addRecipient = (email: string, name: string | null) => {
    // comma-separated typing supported — split and add each
    const parts = email.split(",").map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return;
    const valid: Recipient[] = [];
    let bad: string | null = null;
    for (const p of parts) {
      const e = p.toLowerCase();
      if (!EMAIL_RE.test(e)) { bad = p; continue; }
      valid.push({ email: e, name: parts.length === 1 ? name : null });
    }
    setRecipients((prev) => {
      const next = [...prev];
      for (const v of valid) if (!next.some((r) => r.email === v.email)) next.push(v);
      return next;
    });
    setMsg(bad ? `"${bad}" is not a valid email` : "");
  };
  const removeRecipient = (email: string) => setRecipients((prev) => prev.filter((r) => r.email !== email));

  // Waiver post-upload dispatch: reuse the send route (records legal_sends + emails / returns url).
  const finishWaiverSend = async (documentId: string, title: string) => {
    try {
      const r = await fetch("/api/esign/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, recipients, note, channel }),
      });
      const d = await r.json();
      if (!r.ok || !d?.ok) {
        setMsg(d?.error ?? `"${title}" uploaded, but sending failed`);
        return;
      }
      if (channel === "link") {
        if (typeof d.url === "string") setRecordedUrl(d.url);
        setMsg(`"${title}" added + recorded for ${recipients.length} recipient(s) — use the copy icon.`);
      } else {
        const emailed = (d.results ?? []).filter((x: { emailed: boolean }) => x.emailed).length;
        const failed = (d.results ?? []).filter((x: { ok: boolean }) => !x.ok);
        setMsg(`"${title}" added + sent to ${recipients.length} recipient(s) — ${emailed} emailed${failed.length ? `, ${failed.length} failed` : ""}.`);
      }
      setRecipients([]);
      setNote("");
      await loadActivity();
    } catch {
      setMsg(`"${title}" uploaded, but sending failed (server error)`);
    }
  };

  // Drop/select a PDF → STAGE it only. Nothing uploads or emails until the Send button.
  const stageFile = (f: File | null) => {
    if (!f || uploading) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setMsg("Please choose a PDF file");
      return;
    }
    setUploadFile(f);
    setMsg("");
  };
  const clearStaged = () => { if (!uploading) setUploadFile(null); };

  // SEND — create the document and dispatch it per the mode, in one click.
  // XHR (not fetch) so we get a real upload-progress %; plus a hard timeout so it can't hang.
  const submit = () => {
    const f = uploadFile;
    if (!f || uploading) return;
    if (!configured) {
      setMsg("Documenso is not configured on this server — cannot send.");
      return;
    }
    if (mode === "multisig" && recipients.length === 0) {
      setMsg("Add the signers first — boxes stack in the order you add them (match the document, top to bottom).");
      return;
    }
    const title = f.name.replace(/\.pdf$/i, "").trim() || f.name;
    const fd = new FormData();
    fd.append("title", title);
    fd.append("file", f);
    if (mode === "multisig") {
      fd.append("kind", "multisig");
      fd.append("signers", JSON.stringify(recipients));
      if (note.trim()) fd.append("note", note.trim());
    }

    const done = (message: string) => {
      setUploading(false);
      setUploadFile(null);
      setUploadPct(null);
      setMsg(message);
    };

    setUploading(true);
    setUploadPct(0);
    setRecordedUrl(null);
    setMsg("");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/esign/documents");
    xhr.timeout = 120_000; // 2 min ceiling — Documenso creation is a few round-trips
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = () => setUploadPct(null); // file fully sent → server now talking to Documenso
    xhr.onload = () => {
      let d: { ok?: boolean; error?: string; document?: { id?: string; title?: string; kind?: string; signerCount?: number } } | null = null;
      try { d = JSON.parse(xhr.responseText); } catch { /* non-JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && d?.ok) {
        const docTitle = d.document?.title ?? title;
        if (d.document?.kind === "multisig") {
          done(`"${docTitle}" sent to ${d.document?.signerCount ?? recipients.length} signer(s) — each received their own signing link.`);
          setRecipients([]);
          setNote("");
          loadActivity();
        } else if (recipients.length > 0 && d.document?.id) {
          done(`"${docTitle}" added — dispatching…`);
          finishWaiverSend(d.document.id, docTitle);
        } else {
          done(`"${docTitle}" added — copy its link from the Documents view anytime.`);
        }
        loadDocuments();
      } else {
        done(d?.error ?? `Upload failed (HTTP ${xhr.status})`);
      }
    };
    xhr.onerror = () => done("Upload failed (network error)");
    xhr.ontimeout = () => done("Upload timed out after 2 min — please try again.");
    xhr.send(fd);
  };

  const copyLink = async (url: string | null) => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setMsg("Signing link copied to clipboard."); }
    catch { setMsg(url); }
  };

  const performDeleteDoc = async (d: DocRow) => {
    try {
      const r = await fetch(`/api/esign/documents?id=${encodeURIComponent(d.id)}`, { method: "DELETE" });
      const j = await r.json();
      if (r.ok && j?.ok) {
        setMsg(`Deleted "${d.title}".`);
        await loadDocuments();
      } else setMsg(j?.error ?? "Delete failed");
    } catch { setMsg("Delete failed (server error)"); }
  };
  const askDeleteDoc = (d: DocRow) =>
    setConfirm({
      title: "Delete document",
      message: `Delete “${d.title}”?`,
      detail: d.kind === "multisig"
        ? "It leaves the library. Signer links already emailed stop mattering once removed; signed consent records are kept for audit."
        : "It leaves the library and the recipient pickers. Any signed consent records are kept for audit.",
      confirmLabel: "Delete",
      run: () => performDeleteDoc(d),
    });

  const performRemoveActivity = async (a: ActivityRow) => {
    try {
      const r = await fetch(`/api/esign/activity?id=${encodeURIComponent(a.id)}`, { method: "DELETE" });
      const j = await r.json();
      if (r.ok && j?.ok) {
        setMsg("Activity entry removed.");
        await loadActivity();
      } else setMsg(j?.error ?? "Remove failed");
    } catch { setMsg("Remove failed (server error)"); }
  };
  const askRemoveActivity = (a: ActivityRow) =>
    setConfirm({
      title: "Remove activity entry",
      message: `Remove the “${a.docTitle}” → ${a.recipientEmail} entry?`,
      detail: "This clears the outbox row only — signatures and signer status records are kept.",
      confirmLabel: "Remove",
      run: () => performRemoveActivity(a),
    });

  const visibleDocs = documents.filter((d) => docFilter === "all" || d.kind === docFilter);

  return (
    <>
    <Backdrop onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Header>
          <div>
            <Title>E-Sign Documents</Title>
            <Sub>Send any document to any recipient for electronic signature.</Sub>
          </div>
          <CloseBtn type="button" onClick={onClose} aria-label="Close"><XIcon /></CloseBtn>
        </Header>

        {!configured && (
          <Warn>Documenso is not configured on this server (DOCUMENSO_URL + DOCUMENSO_API_KEY). Uploads and sends are disabled.</Warn>
        )}

        <TabsRow>
          <PillBar
            segments={TAB_SEGMENTS}
            active={tab}
            onChange={(k) => setTab(k as Tab)}
            accent={ACCENT}
            ariaLabel="E-Sign view"
          />
        </TabsRow>

        {msg && <Msg onClick={() => setMsg("")}>{msg}</Msg>}

        <Body>
          {loading && <Dim>Loading…</Dim>}

          {!loading && tab === "new" && (
            <Section>
              <PillBar
                segments={MODE_SEGMENTS}
                active={mode}
                onChange={(k) => setMode(k as DocKind)}
                accent={ACCENT}
                ariaLabel="Signature mode"
              />
              <Hint>
                {mode === "waiver"
                  ? "One reusable signing link — anyone who opens it signs their own copy. Recipients below are optional."
                  : "Named signers on ONE document — each gets their own emailed link and their own signature box. Add signers in the order their signature lines appear in the document (top to bottom); the boxes stack in that order."}
              </Hint>

              <Label>{mode === "multisig" ? "Signers (in document order)" : "Recipients (optional)"}</Label>
              <Row>
                <DDM
                  label="Add staff"
                  ariaLabel={mode === "multisig" ? "Add a staff signer" : "Add a staff recipient"}
                  align="left"
                  items={staff.map((s): DDMItem => ({
                    key: s.username,
                    label: `${s.username} · ${s.email}`,
                    onClick: () => addRecipient(s.email, s.username),
                  }))}
                />
                <Input
                  placeholder="or type emails (comma-separated)"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { addRecipient(customEmail, null); setCustomEmail(""); } }}
                />
                <AddBtn type="button" onClick={() => { addRecipient(customEmail, null); setCustomEmail(""); }}>Add</AddBtn>
              </Row>
              {recipients.length > 0 && (
                <Chips>
                  {recipients.map((r, i) => (
                    <Chip key={r.email}>
                      {mode === "multisig" ? `${i + 1}. ` : ""}{r.name ? `${r.name} · ` : ""}{r.email}
                      <ChipX type="button" onClick={() => removeRecipient(r.email)} aria-label="Remove"><XIcon size={12} /></ChipX>
                    </Chip>
                  ))}
                </Chips>
              )}

              <Label>Message (optional{mode === "multisig" ? " — included in each signer's email" : ""})</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A short note included in the email…" />

              {mode === "waiver" && recipients.length > 0 && (
                <Row>
                  <PillBar
                    segments={CHANNEL_SEGMENTS}
                    active={channel}
                    onChange={(k) => setChannel(k as "email" | "link")}
                    accent={ACCENT}
                    ariaLabel="Delivery"
                  />
                  <CopyIconBtn
                    type="button"
                    disabled={!recordedUrl}
                    title="Copy signing link"
                    aria-label="Copy signing link"
                    onClick={() => copyLink(recordedUrl)}
                  >
                    <LinkIcon size={15} />
                  </CopyIconBtn>
                </Row>
              )}

              <Label>Document</Label>
              <DropZone
                $dragging={dragging}
                onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
                onDragOver={(e) => { e.preventDefault(); if (!uploading && !dragging) setDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
                onDrop={(e) => { e.preventDefault(); setDragging(false); stageFile(e.dataTransfer.files?.[0] ?? null); }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={(e) => { stageFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
                />
                <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4M8 8l4-4 4 4" />
                  <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                </svg>
                <DzText>
                  {uploading
                    ? uploadPct !== null
                      ? `Uploading ${uploadFile?.name ?? "PDF"} — ${uploadPct}%`
                      : `Processing ${uploadFile?.name ?? "PDF"}…`
                    : uploadFile
                    ? uploadFile.name
                    : "Drag a PDF here, or click to browse"}
                </DzText>
                <DzSub>
                  {uploading
                    ? uploadPct !== null
                      ? "Sending file to the server"
                      : mode === "multisig"
                      ? "Creating the document and emailing each signer their own link…"
                      : "Creating signing template in Documenso…"
                    : uploadFile
                    ? "Staged — nothing happens until you press Send. Click to swap the file."
                    : "PDF · up to 20 MB · staged until you press Send"}
                </DzSub>
                {uploading && (
                  <Track>
                    <Fill $pct={uploadPct} />
                  </Track>
                )}
              </DropZone>

              <Row>
                {uploadFile && !uploading && (
                  <GhostBtn type="button" onClick={clearStaged}>Clear file</GhostBtn>
                )}
                <PrimaryBtn
                  type="button"
                  disabled={!uploadFile || uploading || !configured || (mode === "multisig" && recipients.length === 0)}
                  onClick={submit}
                >
                  {uploading
                    ? "Sending…"
                    : mode === "multisig"
                    ? recipients.length
                      ? `Send to ${recipients.length} signer${recipients.length === 1 ? "" : "s"}`
                      : "Send to signers"
                    : recipients.length > 0
                    ? channel === "email"
                      ? `Send to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`
                      : "Record & get link"
                    : "Add to library"}
                </PrimaryBtn>
              </Row>
            </Section>
          )}

          {!loading && tab === "documents" && (
            <Section>
              <PillBar
                segments={KIND_SEGMENTS}
                active={docFilter}
                onChange={(k) => setDocFilter(k as KindFilter)}
                accent={ACCENT}
                ariaLabel="Filter documents by kind"
              />
              {documents.length === 0 && <Dim>No documents yet. Add one from New Document.</Dim>}
              {documents.length > 0 && visibleDocs.length === 0 && (
                <Dim>No {docFilter === "waiver" ? "waivers" : "multi-signature documents"} yet.</Dim>
              )}
              <List>
                {visibleDocs.map((d) => (
                  <Item key={d.id}>
                    <ItemMain>
                      <ItemTitle>{d.title}</ItemTitle>
                      <ItemSub>
                        {d.kind === "multisig"
                          ? `Multi-signature · ${d.signedCount ?? 0} of ${d.signerCount ?? 0} signed`
                          : d.sendable ? "Ready to send" : "No signing template"}
                      </ItemSub>
                      {d.kind === "multisig" && (d.signers?.length ?? 0) > 0 && (
                        <SignerLine>
                          {d.signers!.map((s) => (
                            <SignerPill key={s.email} $s={s.status} title={s.email}>
                              {s.name || s.email} · {s.status === "sent" ? "pending" : s.status}
                            </SignerPill>
                          ))}
                        </SignerLine>
                      )}
                    </ItemMain>
                    <ItemActions>
                      {d.shareUrl && <GhostBtn type="button" onClick={() => copyLink(d.shareUrl)}>Copy link</GhostBtn>}
                      <DelBtn type="button" onClick={() => askDeleteDoc(d)} aria-label="Delete document" title="Delete document"><XIcon size={13} /></DelBtn>
                    </ItemActions>
                  </Item>
                ))}
              </List>
            </Section>
          )}

          {!loading && tab === "activity" && (
            <Section>
              {activity.length === 0 && <Dim>Nothing sent yet.</Dim>}
              <List>
                {activity.map((a) => (
                  <ActItem key={a.id}>
                    <ActMain>
                      <ItemTitle>{a.docTitle}</ItemTitle>
                      <ItemSub>
                        → {a.recipientName ? `${a.recipientName} · ` : ""}{a.recipientEmail}
                        {a.sentBy ? ` · by ${a.sentBy}` : ""} · {new Date(a.sentAt).toLocaleString()}
                      </ItemSub>
                    </ActMain>
                    <ActRight>
                      {a.docKind === "multisig" && <KindTag>multi-sig</KindTag>}
                      <StatusPill $s={a.status}>{a.status}</StatusPill>
                      {a.hasSignedPdf && a.signatureId && (
                        <IconLink href={`/api/esign/pdf/${a.signatureId}`} target="_blank" rel="noreferrer" title="Download signed PDF">
                          <DownloadIcon />
                        </IconLink>
                      )}
                      <DelBtn type="button" onClick={() => askRemoveActivity(a)} aria-label="Remove entry" title="Remove entry"><XIcon size={13} /></DelBtn>
                    </ActRight>
                  </ActItem>
                ))}
              </List>
            </Section>
          )}
        </Body>
      </Panel>
    </Backdrop>
    <ConfirmModal
      open={!!confirm}
      title={confirm?.title ?? ""}
      message={confirm?.message ?? ""}
      detail={confirm?.detail}
      confirmLabel={confirm?.confirmLabel ?? "Confirm"}
      intent="danger"
      onConfirm={async () => { const c = confirm; setConfirm(null); await c?.run(); }}
      onCancel={() => setConfirm(null)}
    />
    </>
  );
}

// ── styled ──────────────────────────────────────────────────────────────────────
const Backdrop = styled.div`
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.66); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
`;
const Panel = styled.div`
  width: min(760px, 100%); max-height: 90vh; display: flex; flex-direction: column;
  background: #0d0d12; border: 1px solid rgba(120,200,255,0.18); border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.6); color: #e8e8ef; overflow: hidden;
  /* DDM accent (recipient pickers) → cyan to match the modal */
  --ddm-accent: #3aa0ff;
  --ddm-accent-rgb: 58, 160, 255;
`;
const Header = styled.div`
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 20px 22px; border-bottom: 1px solid rgba(255,255,255,0.07);
`;
const Title = styled.h2`margin: 0; font-size: 18px; font-weight: 650;`;
const Sub = styled.p`margin: 4px 0 0; font-size: 12.5px; line-height: 1.45; color: rgba(232,232,239,0.55);`;
const CloseBtn = styled.button`
  flex: 0 0 auto; background: transparent; border: none; color: rgba(232,232,239,0.6);
  cursor: pointer; padding: 4px; border-radius: 6px;
  &:hover { color: #fff; background: rgba(255,255,255,0.06); }
`;
const Warn = styled.div`margin: 12px 22px 0; padding: 10px 12px; border-radius: 8px; font-size: 12.5px; background: rgba(255,180,60,0.1); border: 1px solid rgba(255,180,60,0.3); color: #ffcf87;`;
const TabsRow = styled.div`padding: 14px 22px 0;`;
const Msg = styled.div`margin: 12px 22px 0; padding: 9px 12px; border-radius: 8px; font-size: 12.5px; background: rgba(120,200,255,0.1); border: 1px solid rgba(120,200,255,0.28); color: #cfe9ff; cursor: pointer;`;
const Body = styled.div`padding: 18px 22px 22px; overflow-y: auto;`;
const Section = styled.div`display: flex; flex-direction: column; gap: 8px;`;
const Hint = styled.p`margin: 2px 0 0; font-size: 12px; line-height: 1.5; color: rgba(232,232,239,0.5); text-align: center;`;
const Label = styled.label`font-size: 12px; font-weight: 600; color: rgba(232,232,239,0.75); margin-top: 10px;`;
const Row = styled.div`display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 2px;`;
const baseField = `
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px; color: #e8e8ef; padding: 9px 11px; font-size: 13px; outline: none;
  &:focus { border-color: rgba(120,200,255,0.5); }
`;
const Input = styled.input`${baseField} flex: 1 1 180px;`;
const Textarea = styled.textarea`${baseField} resize: vertical; width: 100%;`;
const Chips = styled.div`display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;`;
const Chip = styled.span`display: inline-flex; align-items: center; gap: 6px; background: rgba(120,200,255,0.1); border: 1px solid rgba(120,200,255,0.28); border-radius: 999px; padding: 4px 10px; font-size: 12px;`;
const ChipX = styled.button`background: transparent; border: none; color: inherit; cursor: pointer; display: inline-flex; padding: 0; opacity: 0.7; &:hover { opacity: 1; }`;
const AddBtn = styled.button`${baseField} cursor: pointer; flex: 0 0 auto; &:hover { border-color: rgba(120,200,255,0.5); }`;
const PrimaryBtn = styled.button`
  margin-left: auto; background: #3aa0ff; color: #001a2e; border: none; border-radius: 8px;
  padding: 9px 18px; font-size: 13px; font-weight: 650; cursor: pointer;
  &:hover:not(:disabled) { background: #58b0ff; } &:disabled { opacity: 0.45; cursor: default; }
`;
const CopyIconBtn = styled.button`
  display: inline-flex; align-items: center; justify-content: center; padding: 8px;
  border-radius: 8px; border: 1px solid rgba(120,200,255,0.3); background: rgba(120,200,255,0.1);
  color: #cfe9ff; cursor: pointer;
  &:hover:not(:disabled) { background: rgba(120,200,255,0.2); border-color: rgba(120,200,255,0.55); }
  &:disabled { opacity: 0.35; cursor: default; }
`;
const GhostBtn = styled.button`${baseField} cursor: pointer; flex: 0 0 auto; font-size: 12px; padding: 6px 12px; &:hover { border-color: rgba(120,200,255,0.5); }`;
const DropZone = styled.div<{ $dragging: boolean }>`
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  padding: 26px 18px; margin-top: 2px; cursor: pointer; text-align: center;
  border: 1.5px dashed ${(p) => (p.$dragging ? "rgba(120,200,255,0.8)" : "rgba(255,255,255,0.18)")};
  border-radius: 11px;
  background: ${(p) => (p.$dragging ? "rgba(120,200,255,0.1)" : "rgba(255,255,255,0.02)")};
  color: ${(p) => (p.$dragging ? "#bfe4ff" : "rgba(232,232,239,0.6)")};
  transition: border-color 0.15s, background 0.15s, color 0.15s;
  &:hover { border-color: rgba(120,200,255,0.5); color: #cfe9ff; }
`;
const DzText = styled.div`font-size: 13.5px; font-weight: 600; color: #e8e8ef; word-break: break-all;`;
const DzSub = styled.div`font-size: 11.5px; color: rgba(232,232,239,0.45);`;
const slide = keyframes`0% { left: -45%; } 100% { left: 100%; }`;
const Track = styled.div`position: relative; height: 5px; width: 70%; margin-top: 8px; border-radius: 999px; background: rgba(255,255,255,0.09); overflow: hidden;`;
const Fill = styled.div<{ $pct: number | null }>`
  position: absolute; top: 0; bottom: 0; border-radius: 999px; background: #3aa0ff;
  ${(p) => (p.$pct !== null
    ? css`left: 0; width: ${p.$pct}%; transition: width 0.2s ease;`
    : css`width: 45%; animation: ${slide} 1.1s ease-in-out infinite;`)}
`;
const List = styled.div`display: flex; flex-direction: column; gap: 6px; margin-top: 4px;`;
const Item = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.08); border-radius: 9px; background: rgba(255,255,255,0.02);`;
const ItemActions = styled.div`display: flex; align-items: center; gap: 8px; flex: 0 0 auto;`;
const DelBtn = styled.button`
  background: transparent; border: 1px solid rgba(255,255,255,0.1); color: rgba(232,232,239,0.45);
  cursor: pointer; padding: 6px; border-radius: 7px; line-height: 0;
  &:hover { color: #ff9a9a; border-color: rgba(255,90,90,0.4); background: rgba(255,90,90,0.1); }
`;
const ItemTitle = styled.div`font-size: 13.5px; font-weight: 600;`;
const ItemSub = styled.div`font-size: 11.5px; color: rgba(232,232,239,0.5); margin-top: 2px;`;
const ActItem = styled(Item)``;
const ActMain = styled.div`min-width: 0;`;
const ActRight = styled.div`display: flex; align-items: center; gap: 10px; flex: 0 0 auto;`;
const IconLink = styled.a`color: #7fd0ff; display: inline-flex; padding: 4px; border-radius: 6px; &:hover { background: rgba(120,200,255,0.12); }`;
const Dim = styled.div`font-size: 12.5px; color: rgba(232,232,239,0.45); padding: 4px 0;`;
const StatusPill = styled.span<{ $s: string }>`
  font-size: 11px; font-weight: 650; padding: 3px 10px; border-radius: 999px; text-transform: capitalize;
  ${(p) =>
    p.$s === "completed" || p.$s === "signed"
      ? "background: rgba(80,220,140,0.14); color: #7ff0b0; border: 1px solid rgba(80,220,140,0.35);"
      : p.$s === "rejected"
      ? "background: rgba(255,90,90,0.14); color: #ff9a9a; border: 1px solid rgba(255,90,90,0.35);"
      : "background: rgba(255,200,80,0.12); color: #ffd587; border: 1px solid rgba(255,200,80,0.3);"}
`;
const ItemMain = styled.div`min-width: 0; display: flex; flex-direction: column; gap: 2px;`;
const SignerLine = styled.div`display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;`;
const SignerPill = styled(StatusPill)`font-size: 10px; padding: 2px 8px; text-transform: none;`;
const KindTag = styled.span`
  font-size: 10px; font-weight: 650; padding: 2px 8px; border-radius: 999px; letter-spacing: 0.02em;
  background: rgba(120,140,255,0.12); color: #b9c4ff; border: 1px solid rgba(120,140,255,0.32);
`;
