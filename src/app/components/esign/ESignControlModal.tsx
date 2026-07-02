"use client";

// ESignControlModal — TGV Office "E-Sign Documents" console (Utils → Documents group).
//
// Lifts the @tgv/module-legal/module-documenso e-sign engine (built for Studio waivers) onto
// Office so operators (Gio/Marthe) can send ANY document to ANY recipient — staff or external
// email — for signature, for any purpose. Transport = share the Documenso direct link
// (option A): Office emails the recipient the /d/{token} URL and tracks sent → signed in the
// Activity outbox. Backend: /api/esign/{documents,send,activity,pdf}.
//
// Self-contained (styled-components, per Office's no-Tailwind rule). Inline SVGs — no emoji.

import { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import DDM, { type DDMItem } from "@tgv/module-component-library/components/ui/DDM";

// ── types (mirror the API payloads) ────────────────────────────────────────────
type DocRow = {
  id: string;
  title: string;
  slug: string;
  version: number;
  sendable: boolean;
  shareUrl: string | null;
};
type StaffRow = { username: string; email: string; role: string };
type Recipient = { email: string; name: string | null };
type ActivityRow = {
  id: string;
  documentId: string;
  docTitle: string;
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

type Tab = "upload" | "documents" | "send" | "activity";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ESignControlModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("upload");
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [msg, setMsg] = useState<string>("");

  // send-tab state
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [customEmail, setCustomEmail] = useState("");
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState<"email" | "link">("email");
  const [sending, setSending] = useState(false);

  // library-tab upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null); // 0–100 while sending; null = server processing
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drop/select a PDF → upload immediately (title defaults to the filename).
  // XHR (not fetch) so we get a real upload-progress %; plus a hard timeout so it can't hang.
  const handleFile = (f: File | null) => {
    if (!f || uploading) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setMsg("Please choose a PDF file");
      return;
    }
    if (!configured) {
      setMsg("Documenso is not configured on this server — cannot upload.");
      return;
    }
    const title = f.name.replace(/\.pdf$/i, "").trim() || f.name;
    const fd = new FormData();
    fd.append("title", title);
    fd.append("file", f);

    const done = (message: string) => {
      setUploading(false);
      setUploadFile(null);
      setUploadPct(null);
      setMsg(message);
    };

    setUploadFile(f);
    setUploading(true);
    setUploadPct(0);
    setMsg("");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/esign/documents");
    xhr.timeout = 120_000; // 2 min ceiling — Documenso template creation is a few round-trips
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = () => setUploadPct(null); // file fully sent → server now building the template
    xhr.onload = () => {
      let d: { ok?: boolean; error?: string; document?: { title?: string } } | null = null;
      try { d = JSON.parse(xhr.responseText); } catch { /* non-JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && d?.ok) {
        done(`"${d.document?.title ?? title}" added — ready to send.`);
        loadDocuments();
      } else {
        done(d?.error ?? `Upload failed (HTTP ${xhr.status})`);
      }
    };
    xhr.onerror = () => done("Upload failed (network error)");
    xhr.ontimeout = () => done("Upload timed out after 2 min — please try again.");
    xhr.send(fd);
  };

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

  const addRecipient = (email: string, name: string | null) => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) { setMsg(`"${email}" is not a valid email`); return; }
    if (recipients.some((r) => r.email === e)) return;
    setRecipients((prev) => [...prev, { email: e, name }]);
    setMsg("");
  };
  const removeRecipient = (email: string) => setRecipients((prev) => prev.filter((r) => r.email !== email));

  const send = async () => {
    if (!selectedDocId) { setMsg("Pick a document first"); return; }
    if (recipients.length === 0) { setMsg("Add at least one recipient"); return; }
    setSending(true); setMsg("");
    try {
      const r = await fetch("/api/esign/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: selectedDocId, recipients, note, channel }),
      });
      const d = await r.json();
      if (!r.ok || !d?.ok) { setMsg(d?.error ?? "Send failed"); return; }
      const emailed = (d.results ?? []).filter((x: { emailed: boolean }) => x.emailed).length;
      const failed = (d.results ?? []).filter((x: { ok: boolean }) => !x.ok);
      setMsg(
        channel === "email"
          ? `Sent to ${recipients.length} recipient(s) — ${emailed} emailed${failed.length ? `, ${failed.length} failed` : ""}.`
          : `Link recorded for ${recipients.length} recipient(s). Copy it below.`,
      );
      setRecipients([]); setNote("");
      await loadActivity();
    } finally {
      setSending(false);
    }
  };

  const copyLink = async (url: string | null) => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setMsg("Signing link copied to clipboard."); }
    catch { setMsg(url); }
  };

  const deleteDoc = async (d: DocRow) => {
    if (!window.confirm(`Delete "${d.title}"?\n\nIt leaves the library and the Send picker. Any signed consent records are kept for audit.`)) return;
    try {
      const r = await fetch(`/api/esign/documents?id=${encodeURIComponent(d.id)}`, { method: "DELETE" });
      const j = await r.json();
      if (r.ok && j?.ok) {
        setMsg(`Deleted "${d.title}".`);
        if (selectedDocId === d.id) setSelectedDocId("");
        await loadDocuments();
      } else setMsg(j?.error ?? "Delete failed");
    } catch { setMsg("Delete failed (server error)"); }
  };

  const sendableDocs = documents.filter((d) => d.sendable);
  const selectedDoc = documents.find((d) => d.id === selectedDocId) ?? null;

  return (
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

        <Tabs>
          <TabBtn $active={tab === "upload"} onClick={() => setTab("upload")}>Upload</TabBtn>
          <TabBtn $active={tab === "send"} onClick={() => setTab("send")}>Send</TabBtn>
          <TabBtn $active={tab === "activity"} onClick={() => setTab("activity")}>Activity</TabBtn>
          <TabBtn $active={tab === "documents"} onClick={() => setTab("documents")}>Documents</TabBtn>
        </Tabs>

        {msg && <Msg onClick={() => setMsg("")}>{msg}</Msg>}

        <Body>
          {loading && <Dim>Loading…</Dim>}

          {!loading && tab === "send" && (
            <Section>
              <Label>Document</Label>
              <DDM
                label={selectedDoc ? selectedDoc.title : "Choose a document"}
                ariaLabel="Choose a document"
                align="left"
                items={sendableDocs.map((d): DDMItem => ({
                  key: d.id,
                  label: d.title,
                  onClick: () => setSelectedDocId(d.id),
                }))}
              />
              {sendableDocs.length === 0 && (
                <Dim>No sendable documents yet — add one from the Upload tab.</Dim>
              )}

              <Label>Recipients</Label>
              <Row>
                <DDM
                  label="Add staff"
                  ariaLabel="Add a staff recipient"
                  align="left"
                  items={staff.map((s): DDMItem => ({
                    key: s.username,
                    label: `${s.username} · ${s.email}`,
                    onClick: () => addRecipient(s.email, s.username),
                  }))}
                />
                <Input
                  placeholder="or type any email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { addRecipient(customEmail, null); setCustomEmail(""); } }}
                />
                <AddBtn type="button" onClick={() => { addRecipient(customEmail, null); setCustomEmail(""); }}>Add</AddBtn>
              </Row>
              {recipients.length > 0 && (
                <Chips>
                  {recipients.map((r) => (
                    <Chip key={r.email}>
                      {r.name ? `${r.name} · ` : ""}{r.email}
                      <ChipX type="button" onClick={() => removeRecipient(r.email)} aria-label="Remove"><XIcon size={12} /></ChipX>
                    </Chip>
                  ))}
                </Chips>
              )}

              <Label>Message (optional)</Label>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A short note included in the email…" />

              <Row>
                <ChannelToggle>
                  <ChBtn $active={channel === "email"} onClick={() => setChannel("email")}>Email the link</ChBtn>
                  <ChBtn $active={channel === "link"} onClick={() => setChannel("link")}>Just record (copy link)</ChBtn>
                </ChannelToggle>
                <PrimaryBtn type="button" disabled={sending || !configured} onClick={send}>
                  {sending ? "Sending…" : channel === "email" ? "Send for signature" : "Record & get link"}
                </PrimaryBtn>
              </Row>
            </Section>
          )}

          {!loading && tab === "upload" && (
            <Section>
              <Label>Add a document</Label>
              <DropZone
                $dragging={dragging}
                onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
                onDragOver={(e) => { e.preventDefault(); if (!uploading && !dragging) setDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0] ?? null); }}
              >
                <input ref={fileInputRef} type="file" accept="application/pdf" hidden onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
                <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4M8 8l4-4 4 4" />
                  <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                </svg>
                <DzText>
                  {uploading
                    ? uploadPct !== null
                      ? `Uploading ${uploadFile?.name ?? "PDF"} — ${uploadPct}%`
                      : `Processing ${uploadFile?.name ?? "PDF"}…`
                    : "Drag a PDF here, or click to browse"}
                </DzText>
                <DzSub>
                  {uploading
                    ? uploadPct !== null
                      ? "Sending file to the server"
                      : "Creating signing template in Documenso…"
                    : "PDF · up to 20 MB · uploads automatically (named from the file)"}
                </DzSub>
                {uploading && (
                  <Track>
                    <Fill $pct={uploadPct} />
                  </Track>
                )}
              </DropZone>
            </Section>
          )}

          {!loading && tab === "documents" && (
            <Section>
              <Label>Your documents</Label>
              {documents.length === 0 && <Dim>No documents yet. Add one from the Upload tab.</Dim>}
              <List>
                {documents.map((d) => (
                  <Item key={d.id}>
                    <div>
                      <ItemTitle>{d.title}</ItemTitle>
                      <ItemSub>{d.sendable ? "Ready to send" : "No signing template"}</ItemSub>
                    </div>
                    <ItemActions>
                      {d.shareUrl && <GhostBtn type="button" onClick={() => copyLink(d.shareUrl)}>Copy link</GhostBtn>}
                      <DelBtn type="button" onClick={() => deleteDoc(d)} aria-label="Delete document" title="Delete document"><XIcon size={13} /></DelBtn>
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
                      <StatusPill $s={a.status}>{a.status}</StatusPill>
                      {a.hasSignedPdf && a.signatureId && (
                        <IconLink href={`/api/esign/pdf/${a.signatureId}`} target="_blank" rel="noreferrer" title="Download signed PDF">
                          <DownloadIcon />
                        </IconLink>
                      )}
                    </ActRight>
                  </ActItem>
                ))}
              </List>
            </Section>
          )}
        </Body>
      </Panel>
    </Backdrop>
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
  /* DDM accent (Send-tab pickers) → cyan to match the modal */
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
const Tabs = styled.div`display: flex; gap: 6px; padding: 14px 22px 0;`;
const TabBtn = styled.button<{ $active: boolean }>`
  background: ${(p) => (p.$active ? "rgba(120,200,255,0.14)" : "transparent")};
  border: 1px solid ${(p) => (p.$active ? "rgba(120,200,255,0.4)" : "rgba(255,255,255,0.1)")};
  color: ${(p) => (p.$active ? "#bfe4ff" : "rgba(232,232,239,0.6)")};
  padding: 7px 16px; border-radius: 8px 8px 0 0; font-size: 13px; cursor: pointer;
`;
const Msg = styled.div`margin: 12px 22px 0; padding: 9px 12px; border-radius: 8px; font-size: 12.5px; background: rgba(120,200,255,0.1); border: 1px solid rgba(120,200,255,0.28); color: #cfe9ff; cursor: pointer;`;
const Body = styled.div`padding: 18px 22px 22px; overflow-y: auto;`;
const Section = styled.div`display: flex; flex-direction: column; gap: 8px;`;
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
const ChannelToggle = styled.div`display: inline-flex; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; overflow: hidden;`;
const ChBtn = styled.button<{ $active: boolean }>`
  background: ${(p) => (p.$active ? "rgba(120,200,255,0.16)" : "transparent")};
  color: ${(p) => (p.$active ? "#cfe9ff" : "rgba(232,232,239,0.6)")};
  border: none; padding: 8px 13px; font-size: 12.5px; cursor: pointer;
`;
const PrimaryBtn = styled.button`
  margin-left: auto; background: #3aa0ff; color: #001a2e; border: none; border-radius: 8px;
  padding: 9px 18px; font-size: 13px; font-weight: 650; cursor: pointer;
  &:hover { background: #58b0ff; } &:disabled { opacity: 0.45; cursor: default; }
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
