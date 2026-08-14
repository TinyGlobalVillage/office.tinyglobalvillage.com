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
// Multisig boxes default to auto-stacking on the last page IN THE ORDER SIGNERS ARE ADDED —
// but once a PDF is staged, the SignaturePlacer preview renders every page and the operator
// DRAGS each signer's Sign + Date boxes exactly onto the document's printed signature lines.
// The header gear (multisig only) opens Email settings as a DIALOG LAYERED OVER the console
// (z 1100 above the console's 1000), and it opens itself whenever a document is staged, so
// every send is a deliberate choice of what the recipient reads. Office WRITES AND SENDS the
// signing invitation itself — Documenso is told to email nobody — so every line of it is a
// field here: subject, heading, message, button label, footer, reply-to, with a live preview
// of the card as the signer meets it. The FROM identity is the house mailbox
// (SUPPORT_FROM_EMAIL, "Tiny Global Village"); per-send sender control is Reply-To, and the
// dialog's footer QMBM says so.
//
// Self-contained (styled-components, per Office's no-Tailwind rule). Inline SVGs — no emoji.

import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import DDM, { type DDMItem } from "@tgv/module-component-library/components/ui/DDM";
import InfoBubble from "@tgv/module-component-library/components/ui/InfoBubble";
import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import ConfirmModal from "../frontdesk/ConfirmModal";
import SettingsIcon from "../icons/SettingsIcon";
import UploadDropzone from "../UploadDropzone";
import SignaturePlacer, { type SignerPlacement } from "./SignaturePlacer";

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

// The invitation's defaults, mirrored from module-documenso/server/invite.ts so a blank
// field can show the operator exactly what will be sent in its place. The module is still
// the authority — these are placeholders, never submitted.
const INVITE_DEFAULTS = { heading: "Your signature is needed", buttonLabel: "Review & sign", footer: "Sent by Tiny Global Village" };
const inviteDefaultMessage = (title: string) =>
  `You've been asked to sign "${title}".\n\nOpening the link below shows you the document and your own signature box — you can sign from your phone, and nothing else is required of you.`;

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
  // "Include certificate page?" — Documenso appends a signing-certificate page to the
  // signed PDF; unchecked = our stored/downloadable copy keeps only the document's own
  // pages (a sealed original is kept server-side for audit).
  const [includeCert, setIncludeCert] = useState(true);
  // Multisig delivery: in-order chain (only the first signer is emailed; each signature
  // triggers the next signer's email), then the delivery list — who receives the finished
  // document. The list is the ONLY answer to "where does this land": it is always on screen,
  // it is never inferred, and copyToSigners just folds the roster into it.
  const [inOrder, setInOrder] = useState(true);
  const [copyToSigners, setCopyToSigners] = useState(false);
  const [ccList, setCcList] = useState<Recipient[]>([]);
  const [ccEmail, setCcEmail] = useState("");
  const deliveryTouched = useRef(false);
  // The operator's own addresses (Fastmail sending identities + roster email) and which one
  // is currently on the delivery list. Gio receives at four domains; the roster's single
  // address was answering a question he hadn't been asked.
  const [myAddresses, setMyAddresses] = useState<string[]>([]);
  const [myAddress, setMyAddress] = useState("");
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null); // waiver link-channel result
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null); // 0–100 while sending; null = server processing
  // Drag-placed field boxes per signer email (percent coords). Empty = auto-stack default.
  const [placements, setPlacements] = useState<Record<string, SignerPlacement>>({});
  // Gear panel (multisig): the signing invitation, line by line. Every visible part of the
  // email is here — Office sends it, not Documenso, so there is no wording left over from
  // somewhere else. Blank means "use the default shown as the placeholder". Reply-to
  // survives a send on purpose — it's operator identity, not per-document content.
  const [showEmailSettings, setShowEmailSettings] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [inviteHeading, setInviteHeading] = useState("");
  const [inviteButtonLabel, setInviteButtonLabel] = useState("");
  const [inviteFooter, setInviteFooter] = useState("");
  const [emailReplyTo, setEmailReplyTo] = useState("");

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
        // Seed the delivery list with the operator once, on first load. Once they have
        // touched it — including emptying it — their choice stands.
        if (d.me?.email) {
          const mine = String(d.me.email).toLowerCase();
          setMyAddresses(Array.isArray(d.me.addresses) && d.me.addresses.length ? d.me.addresses.map(String) : [mine]);
          if (!deliveryTouched.current) {
            setMyAddress(mine);
            setCcList([{ email: mine, name: d.me.username ?? null }]);
          }
        }
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

  useEscapeToClose({ open: true, onClose });
  // Email settings is a layer of its own, so it registers its own Escape entry — the
  // canonical stack pops the topmost one, which is exactly the behaviour we want:
  // the first Escape closes the settings, the next closes the console.
  const gearOpen = tab === "new" && mode === "multisig" && showEmailSettings;
  useEscapeToClose({ open: gearOpen, onClose: () => setShowEmailSettings(false) });
  // The title the server will use — the staged filename, minus .pdf. Placeholders and the
  // preview quote it so the defaults read as the real sentence, not a template.
  const previewTitle = uploadFile ? uploadFile.name.replace(/\.pdf$/i, "") : "(document title)";

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

  // Delivery list (multisig): who receives the signed document. A signer belongs here as
  // readily as anyone else — the operator is usually both, and the old copy-only list
  // silently dropped them, which is how a finished document reached nobody who asked for it.
  const addCc = (email: string, name: string | null) => {
    const parts = email.split(",").map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return;
    let bad: string | null = null;
    const valid: Recipient[] = [];
    for (const p of parts) {
      const e = p.toLowerCase();
      if (!EMAIL_RE.test(e)) { bad = p; continue; }
      valid.push({ email: e, name: parts.length === 1 ? name : null });
    }
    deliveryTouched.current = true;
    setCcList((prev) => {
      const next = [...prev];
      for (const v of valid) if (!next.some((r) => r.email === v.email)) next.push(v);
      return next;
    });
    setMsg(bad ? `"${bad}" is not a valid email` : "");
  };
  const removeCc = (email: string) => {
    deliveryTouched.current = true;
    setCcList((prev) => prev.filter((r) => r.email !== email));
    // Dropping the chip is how you say "not to me" — the picker follows it back to unset
    // rather than claiming an address that is no longer on the list.
    setMyAddress((cur) => (cur === email ? "" : cur));
  };
  /** Swap which of the operator's own addresses is on the list. Everyone else stays put. */
  const pickMyAddress = (email: string) => {
    const e = email.toLowerCase();
    deliveryTouched.current = true;
    setCcList((prev) => {
      const others = prev.filter((r) => r.email !== myAddress && r.email !== e);
      return [{ email: e, name: null }, ...others];
    });
    setMyAddress(e);
  };

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
    setPlacements({}); // a new document invalidates any box positions from the previous one
    setMsg("");
    // A new document is a new email. Open the settings so subject/message/reply-to are a
    // decision the operator makes every time rather than one they have to remember the
    // gear exists to make — Save (or Escape) puts them straight back on the document.
    if (mode === "multisig") setShowEmailSettings(true);
  };
  const clearStaged = () => { if (!uploading) { setUploadFile(null); setPlacements({}); } };

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
      setMsg("Add the signers first — then drag each signer's Sign and Date boxes into place on the staged document.");
      return;
    }
    const replyTo = emailReplyTo.trim().toLowerCase();
    if (mode === "multisig" && replyTo && !EMAIL_RE.test(replyTo)) {
      setMsg(`"${emailReplyTo.trim()}" is not a valid reply-to email — fix it in Email settings (gear icon).`);
      return;
    }
    const title = f.name.replace(/\.pdf$/i, "").trim() || f.name;
    const fd = new FormData();
    fd.append("title", title);
    fd.append("file", f);
    if (mode === "multisig") {
      fd.append("kind", "multisig");
      fd.append("signers", JSON.stringify(recipients));
      fd.append("sequential", String(inOrder));
      fd.append("finalCopyAll", String(copyToSigners));
      fd.append("deliveryEmails", JSON.stringify(ccList.map((c) => c.email)));
      if (note.trim()) fd.append("note", note.trim());
      if (emailSubject.trim()) fd.append("emailSubject", emailSubject.trim());
      if (inviteHeading.trim()) fd.append("inviteHeading", inviteHeading.trim());
      if (inviteButtonLabel.trim()) fd.append("inviteButtonLabel", inviteButtonLabel.trim());
      if (inviteFooter.trim()) fd.append("inviteFooter", inviteFooter.trim());
      if (replyTo) fd.append("emailReplyTo", replyTo);
      const placed = recipients
        .map((r, i) => {
          const p = placements[r.email];
          if (!p) return null;
          // An X'd-out date is sent as an explicit noDate, never as a missing rect —
          // the server DERIVES a date box when one is absent, so silence would put the
          // field back rather than remove it.
          return p.noDate
            ? { signerIndex: i, pageNumber: p.pageNumber, signature: p.signature, noDate: true }
            : { signerIndex: i, pageNumber: p.pageNumber, signature: p.signature, date: p.date, datePageNumber: p.datePageNumber };
        })
        .filter(Boolean);
      if (placed.length) fd.append("placements", JSON.stringify(placed));
    }
    fd.append("includeCertificate", String(includeCert));

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
      let d: { ok?: boolean; error?: string; document?: { id?: string; title?: string; kind?: string; signerCount?: number; sequential?: boolean; deliveryCount?: number } } | null = null;
      try { d = JSON.parse(xhr.responseText); } catch { /* non-JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && d?.ok) {
        const docTitle = d.document?.title ?? title;
        if (d.document?.kind === "multisig") {
          const n = d.document?.signerCount ?? recipients.length;
          const first = recipients[0]?.name || recipients[0]?.email || "the first signer";
          const delivery = d.document?.deliveryCount ?? ccList.length;
          const ending = delivery
            ? ` The signed document goes to ${delivery === 1 ? ccList[0]?.email ?? "1 address" : `${delivery} addresses`} once everyone has signed.`
            : " Nobody is set to receive the finished document.";
          done((d.document?.sequential
            ? `"${docTitle}" is on its way — ${first} signs first; each next signer is emailed automatically when the previous one finishes.`
            : `"${docTitle}" sent to ${n} signer(s) — each received their own signing link.`) + ending);
          setRecipients([]);
          setNote("");
          setPlacements({});
          setEmailSubject(""); // reply-to intentionally kept for the next send
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
          <HeaderActions>
            {tab === "new" && mode === "multisig" && (
              <GearBtn
                type="button"
                onClick={() => setShowEmailSettings((v) => !v)}
                aria-label="Email settings"
                title="Email settings — subject, message, reply-to"
                $active={showEmailSettings}
              >
                <SettingsIcon size={17} />
              </GearBtn>
            )}
            <CloseBtn type="button" onClick={onClose} aria-label="Close"><XIcon /></CloseBtn>
          </HeaderActions>
        </Header>

        {!configured && (
          <Warn>Documenso is not configured on this server (DOCUMENSO_URL + DOCUMENSO_API_KEY). Uploads and sends are disabled.</Warn>
        )}

        <TabsRow>
          <PillBar variant="flat"
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
              {/* The mode's explanation is a QMBM beside the bar, not a paragraph under
                  it — the same treatment the waiver delivery bar already gets, and what
                  keeps this modal readable now that it carries a document preview. */}
              <ModeRow>
                <PillBar variant="flat"
                  segments={MODE_SEGMENTS}
                  active={mode}
                  onChange={(k) => setMode(k as DocKind)}
                  accent={ACCENT}
                  ariaLabel="Signature mode"
                />
                <InfoBubble
                  title={mode === "waiver" ? "Waiver — one shared link" : "Multiple signatures"}
                  theme="cyan"
                  placement="popover"
                  body={mode === "waiver" ? (
                    <>
                      <p>One reusable signing link — anyone who opens it signs their own copy.</p>
                      <p>Recipients are optional: add them and Office emails each one the link (or
                      just records them and hands you the link to deliver yourself); add none and
                      you simply get a link to publish wherever you like.</p>
                    </>
                  ) : (
                    <>
                      <p>Named signers on ONE document — each gets their own emailed link and their
                      own signature box.</p>
                      <p>Add signers in signing order, stage the PDF, then drag each signer&apos;s
                      Sign and Date boxes exactly onto the document&apos;s printed lines in the
                      preview below. Either box resizes from its bottom-right corner.</p>
                      <p>The gear at the top right writes the invitation itself — subject,
                      heading, message, button, footer, reply-to — with a preview of exactly
                      what lands in their inbox. It opens on its own the moment you stage a
                      document.</p>
                    </>
                  )}
                />
              </ModeRow>

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

              {mode === "multisig" && (
                <>
                  <CheckRow>
                    <input
                      type="checkbox"
                      checked={inOrder}
                      onChange={(e) => setInOrder(e.target.checked)}
                    />
                    Sign in order — one at a time
                    <CheckHint>— only the first signer is emailed now; each signature automatically sends the next signer their link. Unchecked, everyone is emailed at once.</CheckHint>
                  </CheckRow>
                  <Label>Deliver the signed document to</Label>
                  <Row>
                    {myAddresses.length > 1 && (
                      <DDM
                        label={myAddress ? `Me · ${myAddress}` : "Me · pick an address"}
                        ariaLabel="Which of my addresses receives the signed document"
                        align="left"
                        items={myAddresses.map((a): DDMItem => ({
                          key: a,
                          label: a === myAddress ? `✓ ${a}` : a,
                          onClick: () => pickMyAddress(a),
                        }))}
                      />
                    )}
                    <DDM
                      label="Add staff"
                      ariaLabel="Add a staff delivery address"
                      align="left"
                      items={staff.map((s): DDMItem => ({
                        key: s.username,
                        label: `${s.username} · ${s.email}`,
                        onClick: () => addCc(s.email, s.username),
                      }))}
                    />
                    <Input
                      placeholder="or type emails (comma-separated)"
                      value={ccEmail}
                      onChange={(e) => setCcEmail(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { addCc(ccEmail, null); setCcEmail(""); } }}
                    />
                    <AddBtn type="button" onClick={() => { addCc(ccEmail, null); setCcEmail(""); }}>Add</AddBtn>
                  </Row>
                  {ccList.length > 0 ? (
                    <Chips>
                      {ccList.map((r) => (
                        <Chip key={r.email}>
                          {r.name ? `${r.name} · ` : ""}{r.email}
                          <ChipX type="button" onClick={() => removeCc(r.email)} aria-label="Remove"><XIcon size={12} /></ChipX>
                        </Chip>
                      ))}
                    </Chips>
                  ) : (
                    <EmptyDelivery>
                      No one receives the finished document — including you. Add an address above if
                      that isn&apos;t what you want.
                    </EmptyDelivery>
                  )}
                  <CheckRow>
                    <input
                      type="checkbox"
                      checked={copyToSigners}
                      onChange={(e) => setCopyToSigners(e.target.checked)}
                    />
                    Also send it to everyone who signed
                    <CheckHint>— adds each signer to the list above when the document completes.</CheckHint>
                  </CheckRow>
                </>
              )}

              {mode === "waiver" && (
                <>
                  <Label>Message (optional)</Label>
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A short note included in the email…" />
                </>
              )}

              <CheckRow>
                <input
                  type="checkbox"
                  checked={includeCert}
                  onChange={(e) => setIncludeCert(e.target.checked)}
                />
                Include certificate page?
                <CheckHint>— the audit page Documenso appends to the signed PDF. Unchecked keeps your stored copy clean; a sealed original is kept for audit.</CheckHint>
              </CheckRow>

              {mode === "waiver" && recipients.length > 0 && (
                <Row>
                  <PillBar variant="flat"
                    segments={CHANNEL_SEGMENTS}
                    active={channel}
                    onChange={(k) => setChannel(k as "email" | "link")}
                    accent={ACCENT}
                    ariaLabel="Delivery"
                  />
                  <InfoBubble
                    title="Delivery"
                    theme="cyan"
                    placement="popover"
                    body={
                      <>
                        <p><strong>Email the link</strong> — when you press Send, Office emails every
                        recipient the signing link from your own mailbox, and logs each send in Activity.</p>
                        <p><strong>Just record &amp; copy</strong> — nothing is emailed. The same recipients
                        are logged in Activity as expected signers, and the copy icon beside this bar
                        hands you the link to deliver yourself — text, WhatsApp, in person.</p>
                        <p>Both paths use the same signing page and track completed signatures the same
                        way. This chooser only appears for waivers, which share one link; Multiple-signature
                        documents always email each signer their own private link.</p>
                      </>
                    }
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
              <UploadDropzone
                accept="application/pdf"
                disabled={uploading}
                chooseLabel={uploadFile && !uploading ? "Choose Another File" : "Choose File"}
                headline={uploading
                  ? uploadPct !== null
                    ? `Uploading ${uploadFile?.name ?? "PDF"} — ${uploadPct}%`
                    : `Processing ${uploadFile?.name ?? "PDF"}…`
                  : uploadFile
                  ? uploadFile.name
                  : "Drop your PDF here to upload"}
                hint={uploading
                  ? uploadPct !== null
                    ? "Sending file to the server"
                    : mode === "multisig"
                    ? inOrder
                      ? "Creating the document and emailing the first signer their link…"
                      : "Creating the document and emailing each signer their own link…"
                    : "Creating signing template in Documenso…"
                  : uploadFile
                  ? "Staged — nothing happens until you press Send."
                  : "Works with any .PDF file up to 20 MB."}
                recommendation={!uploading && !uploadFile ? "Staged until you press Send" : undefined}
                onFiles={(fl) => stageFile(fl[0] ?? null)}
              >
                {uploading && (
                  <Track>
                    <Fill $pct={uploadPct} />
                  </Track>
                )}
              </UploadDropzone>

              {mode === "multisig" && uploadFile && recipients.length > 0 && !uploading && (
                <SignaturePlacer
                  file={uploadFile}
                  signers={recipients}
                  placements={placements}
                  onChange={setPlacements}
                />
              )}

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
              <PillBar variant="flat"
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

    {/* Email settings — a dialog LAYERED OVER the console, not a card wedged into its
        scroll. It sits above the modal's own backdrop, so opening it never moves the
        page the operator was working on, and Save simply closes it: the fields are the
        live send state, so there is nothing to commit. */}
    {gearOpen && (
      <GearBackdrop onClick={() => setShowEmailSettings(false)}>
        <GearDialog onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Email settings">
          <GearHead>
            <GearTitle><SettingsIcon size={14} /> Email settings</GearTitle>
            <CloseBtn type="button" onClick={() => setShowEmailSettings(false)} aria-label="Close"><XIcon size={16} /></CloseBtn>
          </GearHead>

          <Label>Subject</Label>
          <LineInput
            placeholder={`Please sign: ${previewTitle}`}
            value={emailSubject}
            maxLength={200}
            onChange={(e) => setEmailSubject(e.target.value)}
          />

          <Label>Heading — the one bold line at the top</Label>
          <LineInput
            placeholder={INVITE_DEFAULTS.heading}
            value={inviteHeading}
            maxLength={120}
            onChange={(e) => setInviteHeading(e.target.value)}
          />

          <Label>Message — the body each signer sees</Label>
          <Textarea
            rows={7}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={inviteDefaultMessage(previewTitle)}
          />
          <FieldHint>A blank line starts a new paragraph.</FieldHint>

          <TwoUp>
            <div>
              <Label>Button</Label>
              <LineInput
                placeholder={INVITE_DEFAULTS.buttonLabel}
                value={inviteButtonLabel}
                maxLength={40}
                onChange={(e) => setInviteButtonLabel(e.target.value)}
              />
            </div>
            <div>
              <Label>Footer</Label>
              <LineInput
                placeholder={INVITE_DEFAULTS.footer}
                value={inviteFooter}
                maxLength={200}
                onChange={(e) => setInviteFooter(e.target.value)}
              />
            </div>
          </TwoUp>

          <Label>Reply-to</Label>
          <HalfInput
            placeholder="support@tinyglobalvillage.com"
            value={emailReplyTo}
            onChange={(e) => setEmailReplyTo(e.target.value)}
          />
          <FieldHint>Left blank, replies go to support@tinyglobalvillage.com — a real, monitored
          mailbox. An invite nobody can reply to is a dead end for the signer and a spam signal
          to their mail provider.</FieldHint>

          {/* The email itself, at the size it arrives. Rendered from the same five fields the
              server sends, so what is curated here is what the signer opens — no Documenso
              wording survives anywhere in it. */}
          <Label>Preview</Label>
          <InvitePreview>
            <PreviewWordmark>Tiny Global Village</PreviewWordmark>
            <PreviewHeading>{inviteHeading.trim() || INVITE_DEFAULTS.heading}</PreviewHeading>
            {(note.trim() || inviteDefaultMessage(previewTitle))
              .split(/\n{2,}/)
              .map((p, i) => <PreviewPara key={i}>{p}</PreviewPara>)}
            <PreviewButton>{inviteButtonLabel.trim() || INVITE_DEFAULTS.buttonLabel}</PreviewButton>
            <PreviewLink>Or paste this into your browser:<br />https://esign.tinyglobalvillage.com/sign/…</PreviewLink>
            <PreviewFooter>{inviteFooter.trim() || INVITE_DEFAULTS.footer}</PreviewFooter>
          </InvitePreview>

          <GearFooter>
            <InfoBubble
              title="Who the email comes from"
              theme="cyan"
              placement="popover"
              body={
                <>
                  <p>Office writes and sends this email itself, from <strong>Tiny Global Village
                  &lt;no-reply@tinyglobalvillage.com&gt;</strong>. Documenso emails nobody about
                  a document sent from here — every line the signer reads is one of the five
                  fields above.</p>
                  <p>Reply-to is where their answer lands, and it is never empty: left blank it
                  is support@tinyglobalvillage.com. Set it to your own address when you want a
                  signer&apos;s reply to reach you directly.</p>
                </>
              }
            />
            <PrimaryBtn type="button" onClick={() => setShowEmailSettings(false)}>Save</PrimaryBtn>
          </GearFooter>
        </GearDialog>
      </GearBackdrop>
    )}

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
const HeaderActions = styled.div`display: flex; align-items: center; gap: 6px; flex: 0 0 auto;`;
const GearBtn = styled.button<{ $active: boolean }>`
  flex: 0 0 auto; background: ${(p) => (p.$active ? "rgba(120,200,255,0.14)" : "transparent")};
  border: 1px solid ${(p) => (p.$active ? "rgba(120,200,255,0.4)" : "transparent")};
  color: ${(p) => (p.$active ? "#7fd0ff" : "rgba(232,232,239,0.6)")};
  cursor: pointer; padding: 4px; border-radius: 6px; line-height: 0;
  &:hover { color: #7fd0ff; background: rgba(120,200,255,0.1); }
`;
// Email settings dialog — its own layer above the console's backdrop (1000), so it
// lands in front of the modal instead of pushing the form down inside it.
const GearBackdrop = styled.div`
  position: fixed; inset: 0; z-index: 1100;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
`;
const GearDialog = styled.div`
  width: min(520px, 100%); max-height: 86vh; overflow-y: auto;
  display: flex; flex-direction: column; gap: 4px; padding: 16px 18px 18px;
  background: #11141b; border: 1px solid rgba(120,200,255,0.3); border-radius: 13px;
  box-shadow: 0 24px 70px rgba(0,0,0,0.65); color: #e8e8ef;
`;
const GearHead = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 4px;
`;
const GearTitle = styled.div`
  display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 650; color: #cfe9ff;
`;
const GearFooter = styled.div`
  display: flex; align-items: center; gap: 10px; margin-top: 16px;
`;
const TwoUp = styled.div`
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  @media (max-width: 460px) { grid-template-columns: 1fr; }
`;
// The invitation as the signer meets it: a LIGHT card inside the dark console, because
// that is the contrast their inbox will show and a dark mock would flatter copy that
// reads differently on white.
const InvitePreview = styled.div`
  margin-top: 4px; padding: 18px 18px 16px; border-radius: 10px;
  background: #ffffff; border: 1px solid rgba(255,255,255,0.14);
`;
const PreviewWordmark = styled.p`
  margin: 0 0 12px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: #5b6472;
`;
const PreviewHeading = styled.p`
  margin: 0 0 10px; font-size: 16px; line-height: 1.3; font-weight: 700; color: #14161a;
`;
const PreviewPara = styled.p`
  margin: 0 0 10px; font-size: 12.5px; line-height: 1.6; color: #2c2f36; white-space: pre-wrap;
`;
const PreviewButton = styled.span`
  display: inline-block; margin-top: 2px; padding: 9px 18px; border-radius: 7px;
  background: #14161a; color: #ffffff; font-size: 12.5px; font-weight: 600;
`;
const PreviewLink = styled.p`
  margin: 10px 0 0; font-size: 10.5px; line-height: 1.5; color: #7b8494; word-break: break-all;
`;
const PreviewFooter = styled.p`
  margin: 14px 0 0; padding-top: 12px; border-top: 1px solid #eceef1;
  font-size: 10.5px; line-height: 1.5; color: #7b8494;
`;
const ModeRow = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`;
const Warn = styled.div`margin: 12px 22px 0; padding: 10px 12px; border-radius: 8px; font-size: 12.5px; background: rgba(255,180,60,0.1); border: 1px solid rgba(255,180,60,0.3); color: #ffcf87;`;
const TabsRow = styled.div`padding: 14px 22px 0;`;
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
// Input's `flex: 1 1 180px` is sized for a ROW. In the settings dialog's column the
// same basis is read on the vertical axis, which is what made Subject 180px tall —
// so the dialog's fields carry their own width and refuse to flex at all.
const LineInput = styled.input`${baseField} flex: 0 0 auto; width: 100%;`;
const HalfInput = styled(LineInput)`width: 50%;`;
const Textarea = styled.textarea`${baseField} resize: vertical; width: 100%;`;
const CheckRow = styled.label`
  display: flex; align-items: baseline; gap: 8px; margin-top: 8px;
  font-size: 12.5px; font-weight: 600; color: rgba(232,232,239,0.8); cursor: pointer;
  input { flex: 0 0 auto; transform: translateY(1px); }
`;
const CheckHint = styled.span`font-size: 11.5px; font-weight: 400; color: rgba(232,232,239,0.45);`;
const FieldHint = styled.p`margin: 6px 0 0; font-size: 11.5px; line-height: 1.5; color: rgba(232,232,239,0.45);`;
// An empty delivery list is allowed but rarely meant — say so where the chips would be,
// in warning amber rather than the muted grey the operator's eye already skips.
const EmptyDelivery = styled.p`
  margin: 6px 0 0; font-size: 11.5px; line-height: 1.5; color: rgba(255,196,120,0.85);
`;
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
