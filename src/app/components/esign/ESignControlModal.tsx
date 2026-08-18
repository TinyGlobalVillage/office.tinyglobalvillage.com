"use client";

// ESignControlModal — TGV Office "E-Sign Documents" console (Utils → Documents group).
//
// Lifts the @tgv/module-legal/module-documenso e-sign engine (built for Studio waivers) onto
// Office so operators (Gio/Marthe) can send ANY document to ANYONE for signature.
//
// THREE views on a PillBar (2026-07-02 redesign — Upload+Send folded into one):
//   New Document — a CLICK-THROUGH (2026-08-18): Back on the left, Next on the right, one
//     decision per step, and the last step is the preview of what is about to be sent.
//     Kind (waiver = one shared /d/{token} link; multiple signatures = Documenso document
//     flow, each named signer gets their own emailed link + their own fields) → People →
//     Document → Invitation → Signing page → Review & send. Nothing dispatches until the
//     Send button on the final step. Waiver recipients are optional (skip them to just get
//     the link), and a waiver's flow is four steps — it has no per-signer invitation.
//   Activity — the outbox (sent → signed per recipient; X removes an entry, log-only).
//   Documents — the library w/ kind filter, per-signer status, copy-link, delete.
//
// Multisig boxes default to auto-stacking on the last page IN THE ORDER SIGNERS ARE ADDED —
// but once a PDF is staged, the FieldPlacer preview renders every page: the operator TICKS
// what each person is asked for (sign · initials · full name · date) and DRAGS those boxes
// onto the document's printed lines, one initials box per page where a contract wants them.
//
// Office WRITES AND SENDS the signing invitation itself — Documenso is told to email nobody —
// so every line of it is a field here: subject, heading, message, button label, footer,
// reply-to. Those were behind a header gear that opened a dialog OVER the console; they are
// now the Invitation step, because a setting you have to know a gear exists to find is a
// setting most sends never make. The FROM identity is the house mailbox (SUPPORT_FROM_EMAIL,
// "Tiny Global Village"); per-send sender control is Reply-To, and the step's QMBM says so.
//
// BOTH previews repaint AS YOU TYPE. The email card is plain React, so it always did. The
// signing page is the REAL /sign/preview route in an iframe — it used to reload on a 350ms
// debounce per keystroke, so the screen being judged lagged the words just typed; now the
// frame is mounted once and driven by postMessage (HQ's LivePreview.client.tsx listens).
// Its box also carries an EXPLICIT height: as a column flex item whose only child is
// absolutely positioned it had no in-flow content, and Chrome collapsed `aspect-ratio` to
// the two border pixels — which is why this preview showed nothing at all.
//
// Self-contained (styled-components, per Office's no-Tailwind rule). Inline SVGs — no emoji.

import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import DDM, { type DDMItem } from "@tgv/module-component-library/components/ui/DDM";
import InfoBubble from "@tgv/module-component-library/components/ui/InfoBubble";
import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import ArrowRightIcon from "../icons/ArrowRightIcon";
import ConfirmModal from "../frontdesk/ConfirmModal";
import UploadDropzone from "../UploadDropzone";
import FieldPlacer, { type SignerPlacement } from "./FieldPlacer";

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

// ── the click-through ──────────────────────────────────────────────────────────
// One decision per step, in the order the send is assembled. A waiver shares one link and
// carries no per-signer invitation, so it skips the two curation steps entirely rather than
// showing an operator two screens that do not apply to what they picked.
type StepKey = "mode" | "people" | "document" | "invite" | "page" | "review";
const WAIVER_STEPS: StepKey[] = ["mode", "people", "document", "review"];
const MULTISIG_STEPS: StepKey[] = ["mode", "people", "document", "invite", "page", "review"];
const STEP_LABEL: Record<StepKey, string> = {
  mode: "Kind",
  people: "People",
  document: "Document",
  invite: "Invitation",
  page: "Signing page",
  review: "Review & send",
};

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
// The signing page's two identity lines, mirrored from the journey page's own copy file
// (tinyglobalvillage.com/src/app/[lang]/sign/[token]/journey-copy.ts). These are seeded
// INTO the fields rather than shown as placeholders: here a cleared field means "drop
// that line", and a placeholder cannot say the difference between empty and unset.
const JOURNEY_DEFAULTS = { eyebrow: "Tiny Global Village", title: "Your signature is needed" };
// Where the signer's page lives. Office frames the real route so what an operator judges
// is the page itself, not a copy of it drawn here that would drift on the first edit.
const SIGN_PAGE_ORIGIN = process.env.NEXT_PUBLIC_TGV_ORIGIN || "https://tinyglobalvillage.com";
const PREVIEW_SEGMENTS = [
  { key: "email", label: "Email" },
  { key: "page", label: "Signing page" },
];
// A laptop's screen, scaled to fit the dialog — the shape most signers open the link on.
const SIGN_FRAME_W = 1120;
const SIGN_FRAME_H = 760;
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
  const [stepKey, setStepKey] = useState<StepKey>("mode");
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
  // The signing invitation, line by line (the Invitation step). Every visible part of the
  // email is here — Office sends it, not Documenso, so there is no wording left over from
  // somewhere else. Blank means "use the default shown as the placeholder". Reply-to
  // survives a send on purpose — it's operator identity, not per-document content.
  const [emailSubject, setEmailSubject] = useState("");
  const [inviteHeading, setInviteHeading] = useState("");
  const [inviteButtonLabel, setInviteButtonLabel] = useState("");
  const [inviteFooter, setInviteFooter] = useState("");
  const [emailReplyTo, setEmailReplyTo] = useState("");
  // The signing page's header, seeded with the house wording so it can be edited or
  // emptied. Empty is a real answer here — that line simply isn't rendered — which is
  // why these two are always submitted, blank included, unlike the email fields above.
  const [signEyebrow, setSignEyebrow] = useState(JOURNEY_DEFAULTS.eyebrow);
  const [signPageTitle, setSignPageTitle] = useState(JOURNEY_DEFAULTS.title);
  const [previewFace, setPreviewFace] = useState<"email" | "page">("email");

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
  // The title the server will use — the staged filename, minus .pdf. Placeholders and the
  // preview quote it so the defaults read as the real sentence, not a template.
  const previewTitle = uploadFile ? uploadFile.name.replace(/\.pdf$/i, "") : "(document title)";

  // Which steps this send has, and where in them the operator is standing.
  const steps = mode === "multisig" ? MULTISIG_STEPS : WAIVER_STEPS;
  const stepIndex = Math.max(0, steps.indexOf(stepKey));

  // A recorded link belongs to one upload; switching mode invalidates it. So does the step
  // the operator is on, if the new mode hasn't got it — the two curation steps are multisig's
  // alone, and landing on one after picking "waiver" would offer fields that never ship.
  useEffect(() => {
    setRecordedUrl(null);
    const list = mode === "multisig" ? MULTISIG_STEPS : WAIVER_STEPS;
    setStepKey((k) => (list.includes(k) ? k : "document"));
  }, [mode]);

  // What stops Next. Returned as the sentence the operator reads, so the block and its
  // reason are the same fact rather than a disabled button they have to guess about.
  const blocked: string | null =
    stepKey === "people" && mode === "multisig" && recipients.length === 0
      ? "Add at least one signer before moving on — each one gets their own link and their own boxes."
      : stepKey === "document" && !uploadFile
      ? "Choose the PDF first. Nothing uploads until the Send button on the last step."
      : stepKey === "invite" && emailReplyTo.trim() && !EMAIL_RE.test(emailReplyTo.trim())
      ? `"${emailReplyTo.trim()}" is not a valid reply-to email.`
      : null;
  const goNext = () => {
    if (blocked) { setMsg(blocked); return; }
    setMsg("");
    setStepKey(steps[Math.min(steps.length - 1, stepIndex + 1)]);
  };
  const goBack = () => { setMsg(""); setStepKey(steps[Math.max(0, stepIndex - 1)]); };

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
    // Nothing else to open: the invitation is the next step of the flow, so subject /
    // message / reply-to are a decision every send walks through rather than one an
    // operator had to remember a gear existed to make.
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
      setMsg(`"${emailReplyTo.trim()}" is not a valid reply-to email — fix it on the Invitation step.`);
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
      // Always sent, blank included: the server reads PRESENCE, so an empty line arrives
      // as the operator's decision to drop it rather than as "use the default".
      fd.append("signEyebrow", signEyebrow.trim());
      fd.append("signTitle", signPageTitle.trim());
      if (replyTo) fd.append("emailReplyTo", replyTo);
      // The whole set, exactly as it was drawn: what each signer is asked for, how many of
      // each, whether they may leave it blank, what it is called, and which page every box
      // sits on. The server replaces that signer's default pair with this list, so a kind the
      // operator un-ticked is simply not in it.
      //
      // `order` is the row's position in that signer's field list — the sequence the operator
      // dragged it into, which is the sequence the signer is walked through. Stamped here
      // because the list's own array order IS the answer; nothing downstream has to guess.
      const placed = recipients
        .map((r, i) => {
          const p = placements[r.email];
          if (!p?.fields.length) return null;
          return {
            signerIndex: i,
            fields: p.fields.map((f, order) => ({
              kind: f.kind,
              pageNumber: f.pageNumber,
              order,
              ...(f.required === false ? { required: false } : {}),
              ...(f.label?.trim() ? { label: f.label.trim() } : {}),
              ...f.rect,
            })),
          };
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
        setStepKey("mode"); // the send is spent — the flow starts over, not on its own recap
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

  // The invitation as the signer meets it. Plain React over the same state the fields write,
  // so it has always repainted per keystroke — the Invitation step shows it under the fields
  // and Review shows it again beside the page it opens.
  const emailPreview = (
    <InvitePreview>
      <PreviewWordmark>Tiny Global Village</PreviewWordmark>
      <PreviewHeading>{inviteHeading.trim() || INVITE_DEFAULTS.heading}</PreviewHeading>
      {(note.trim() || inviteDefaultMessage(previewTitle))
        .split(/\n{2,}/)
        .map((para, i) => <PreviewPara key={i}>{para}</PreviewPara>)}
      <PreviewButton>{inviteButtonLabel.trim() || INVITE_DEFAULTS.buttonLabel}</PreviewButton>
      <PreviewLink>Or paste this into your browser:<br />{SIGN_PAGE_ORIGIN}/sign/…</PreviewLink>
      <PreviewFooter>{inviteFooter.trim() || INVITE_DEFAULTS.footer}</PreviewFooter>
    </InvitePreview>
  );

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
              {/* The rail says where the operator is standing and how much is left. Steps
                  already passed stay clickable — going back to change one line should never
                  mean walking the whole flow again. */}
              <WizRail aria-label="Steps">
                {steps.map((k, i) => (
                  <RailStep
                    key={k}
                    type="button"
                    $state={i < stepIndex ? "past" : i === stepIndex ? "now" : "next"}
                    disabled={i >= stepIndex || uploading}
                    aria-current={i === stepIndex ? "step" : undefined}
                    onClick={() => { setMsg(""); setStepKey(k); }}
                  >
                    <RailDot aria-hidden="true" />{STEP_LABEL[k]}
                  </RailStep>
                ))}
              </WizRail>

              {/* ── 1 · Kind ────────────────────────────────────────────────── */}
              {stepKey === "mode" && (
                <>
                  <StepLead>How does this document get signed?</StepLead>
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
                          preview. Either box resizes from its bottom-right corner.</p>
                          <p>Two further steps write the invitation itself — subject, heading, message,
                          button, footer, reply-to — and the two lines heading the page its button
                          opens, both previewed as you type.</p>
                        </>
                      )}
                    />
                  </ModeRow>
                  <StepBody>
                    {mode === "waiver"
                      ? "A waiver is one link that anyone can open and sign their own copy of — a release form, a photo consent, a code of conduct. Four steps."
                      : "Multiple signatures is one document that several named people sign in turn, each with their own boxes on the page — a contract, an agreement, a lease. Six steps."}
                  </StepBody>
                </>
              )}

              {/* ── 2 · People ──────────────────────────────────────────────── */}
              {stepKey === "people" && (
                <>
                  <StepLead>
                    {mode === "multisig"
                      ? "Who signs, in the order they sign — and who receives the finished document."
                      : "Who gets the link. Leave this empty and you simply get the link yourself."}
                  </StepLead>

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
                      {recipients.length > 0 && (
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
                    </>
                  )}
                </>
              )}

              {/* ── 3 · Document ────────────────────────────────────────────── */}
              {stepKey === "document" && (
                <>
                  <StepLead>
                    {mode === "multisig"
                      ? "Stage the PDF, then tick what each signer is asked for and drag their boxes onto the printed lines."
                      : "Stage the PDF. Nothing is uploaded until the Send button on the last step."}
                  </StepLead>
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
                    <FieldPlacer
                      file={uploadFile}
                      signers={recipients}
                      placements={placements}
                      onChange={setPlacements}
                    />
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

                  {uploadFile && !uploading && (
                    <Row>
                      <GhostBtn type="button" onClick={clearStaged}>Clear file</GhostBtn>
                    </Row>
                  )}
                </>
              )}

              {/* ── 4 · Invitation (multisig) ───────────────────────────────── */}
              {stepKey === "invite" && (
                <>
                  <StepLead>
                    Office writes and sends this email itself — every line the signer reads is a field
                    here, and the card below is it, repainting as you type.
                  </StepLead>

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

                  <PreviewHead>
                    <Label>The email, as it arrives</Label>
                    <InfoBubble
                      title="Who the email comes from"
                      theme="cyan"
                      placement="popover"
                      body={
                        <>
                          <p>Office writes and sends this email itself, from <strong>Tiny Global Village
                          &lt;no-reply@tinyglobalvillage.com&gt;</strong>. Documenso emails nobody about
                          a document sent from here — every line the signer reads is one of the fields
                          on this step.</p>
                          <p>Reply-to is where their answer lands, and it is never empty: left blank it
                          is support@tinyglobalvillage.com. Set it to your own address when you want a
                          signer&apos;s reply to reach you directly.</p>
                        </>
                      }
                    />
                  </PreviewHead>
                  {emailPreview}
                </>
              )}

              {/* ── 5 · Signing page (multisig) ─────────────────────────────── */}
              {stepKey === "page" && (
                <>
                  <StepLead>
                    Where the button leads. These two lines head the screen the signer signs on — the
                    real page is framed below, and it repaints as you type.
                  </StepLead>
                  <TwoUp>
                    <div>
                      <SubLabel>Small line</SubLabel>
                      <LineInput
                        value={signEyebrow}
                        maxLength={60}
                        onChange={(e) => setSignEyebrow(e.target.value)}
                        aria-label="Signing page small line"
                      />
                    </div>
                    <div>
                      <SubLabel>Title</SubLabel>
                      <LineInput
                        value={signPageTitle}
                        maxLength={120}
                        onChange={(e) => setSignPageTitle(e.target.value)}
                        aria-label="Signing page title"
                      />
                    </div>
                  </TwoUp>
                  <FieldHint>Empty a field and that line is left off the page entirely.</FieldHint>
                  <SignPagePreview eyebrow={signEyebrow} title={signPageTitle} />
                  <FieldHint>The document itself appears in the empty panel — this is the frame
                  around it, with no signer and nothing to sign.</FieldHint>
                </>
              )}

              {/* ── 6 · Review & send ───────────────────────────────────────── */}
              {stepKey === "review" && (
                <>
                  <StepLead>
                    {mode === "multisig"
                      ? "Nothing has been uploaded or emailed yet. Send does both."
                      : "Nothing has been uploaded yet. Send creates the document and dispatches it as chosen."}
                  </StepLead>
                  <Recap>
                    <dt>Document</dt>
                    <dd>{uploadFile ? uploadFile.name : "— none staged"}</dd>
                    {mode === "multisig" ? (
                      <>
                        <dt>Signers</dt>
                        <dd>{recipients.length
                          ? recipients.map((r, i) => `${i + 1}. ${r.name ? `${r.name} · ` : ""}${r.email}`).join("   ")
                          : "— none"}</dd>
                        <dt>Order</dt>
                        <dd>{inOrder
                          ? "One at a time — each signature emails the next signer"
                          : "Everyone is emailed their link at once"}</dd>
                        <dt>Signed copy to</dt>
                        <dd>{ccList.length ? ccList.map((c) => c.email).join("   ") : "— nobody"}
                          {copyToSigners ? "   + everyone who signed" : ""}</dd>
                        <dt>Subject</dt>
                        <dd>{emailSubject.trim() || `Please sign: ${previewTitle}`}</dd>
                        <dt>Reply-to</dt>
                        <dd>{emailReplyTo.trim() || "support@tinyglobalvillage.com"}</dd>
                      </>
                    ) : (
                      <>
                        <dt>Recipients</dt>
                        <dd>{recipients.length
                          ? recipients.map((r) => r.email).join("   ")
                          : "— none; you just get the link"}</dd>
                        {recipients.length > 0 && (
                          <>
                            <dt>Delivery</dt>
                            <dd>{channel === "email"
                              ? "Office emails each recipient the link"
                              : "Recorded only — you copy the link and deliver it yourself"}</dd>
                          </>
                        )}
                      </>
                    )}
                    <dt>Certificate page</dt>
                    <dd>{includeCert ? "Appended to the signed PDF" : "Left off your stored copy"}</dd>
                  </Recap>

                  {mode === "multisig" ? (
                    <>
                      {/* Both halves of what is about to be sent, in one place: the email at the
                          size it arrives, and the page its button opens. The signing face frames
                          the real route rather than a mock of it, so it cannot drift. */}
                      <PreviewHead>
                        <Label>Preview</Label>
                        <PillBar variant="flat"
                          segments={PREVIEW_SEGMENTS}
                          active={previewFace}
                          onChange={(k) => setPreviewFace(k as "email" | "page")}
                          accent={ACCENT}
                          ariaLabel="Preview which surface"
                        />
                      </PreviewHead>
                      {previewFace === "email" ? emailPreview : (
                        <>
                          <SignPagePreview eyebrow={signEyebrow} title={signPageTitle} />
                          <FieldHint>The document itself appears in the empty panel — this is the
                          frame around it, with no signer and nothing to sign.</FieldHint>
                        </>
                      )}
                    </>
                  ) : (
                    <FieldHint>A waiver shares one signing page for everyone who opens the link, so
                    there is no per-signer invitation to curate here.</FieldHint>
                  )}

                  {uploading && (
                    <Track>
                      <Fill $pct={uploadPct} />
                    </Track>
                  )}
                </>
              )}
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

        {/* Back on the left, Next on the right — the two directions a click-through has, in
            the two places a hand already looks for them. Pinned below the scrolling body so
            the way forward is never something you have to scroll to find. On the last step
            Next becomes Send: the only button in this console that dispatches anything. */}
        {!loading && tab === "new" && (
          <WizFoot>
            <BackBtn
              type="button"
              disabled={stepIndex === 0 || uploading}
              onClick={goBack}
            >
              <ArrowRightIcon size={15} style={{ transform: "scaleX(-1)" }} /> Back
            </BackBtn>
            <StepTally>Step {stepIndex + 1} of {steps.length} · {STEP_LABEL[stepKey]}</StepTally>
            {stepKey === "review" ? (
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
            ) : (
              <NextBtn
                type="button"
                disabled={uploading}
                title={blocked ?? undefined}
                $blocked={Boolean(blocked)}
                onClick={goNext}
              >
                Next <ArrowRightIcon size={15} />
              </NextBtn>
            )}
          </WizFoot>
        )}
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

// The signing page, live.
//
// The frame is mounted ONCE and then driven by postMessage: its src carries the lines it
// mounted with (so the very first paint is already right, and an HQ that hasn't shipped the
// listener still shows something true), and every keystroke after that rides a message into
// HQ's LivePreview, which sets state. No debounce, no reload, no flash between edits.
function SignPagePreview({ eyebrow, title }: { eyebrow: string; title: string }) {
  const [src] = useState(() => {
    const q = new URLSearchParams({ eyebrow: eyebrow.trim(), title: title.trim() });
    return `${SIGN_PAGE_ORIGIN}/sign/preview/?${q.toString()}`;
  });
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const live = useRef(false);
  const [scale, setScale] = useState(0.5);

  const push = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: "tgv-sign-preview", eyebrow, title },
      SIGN_PAGE_ORIGIN,
    );
  }, [eyebrow, title]);

  // Push every edit once the far side is listening…
  useEffect(() => { if (live.current) push(); }, [push]);
  // …and let the far side say when that is, which closes the race where the operator types
  // before the frame has finished loading. onLoad covers the reverse race, when the frame is
  // ready before this listener is. Both are idempotent.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== SIGN_PAGE_ORIGIN) return;
      if ((e.data as { type?: string } | null)?.type !== "tgv-sign-preview-ready") return;
      live.current = true;
      push();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [push]);

  // Rendered at a laptop's width, then scaled to whatever the dialog can spare — a
  // phone-width iframe would preview a layout no signer is going to meet.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setScale(w / SIGN_FRAME_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    // The height is SET from the measured width, not left to `aspect-ratio`: as a column
    // flex item whose only child is absolutely positioned, this box has no in-flow content,
    // and Chrome collapsed it to its two border pixels — the preview rendered, at 2px tall.
    <SignFrameBox ref={boxRef} style={{ height: `${Math.round(SIGN_FRAME_H * scale)}px` }}>
      <SignFrame
        ref={frameRef}
        src={src}
        title="Signing page preview"
        style={{ transform: `scale(${scale})` }}
        onLoad={() => { live.current = true; push(); }}
      />
    </SignFrameBox>
  );
}

// ── styled ──────────────────────────────────────────────────────────────────────
const Backdrop = styled.div`
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.66); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
`;
const Panel = styled.div`
  /* Wide enough that the framed signing page is judged at a readable scale — under
     ~700px the whole screen shrinks past the point where its copy can be curated. */
  width: min(860px, 100%); max-height: 90vh; display: flex; flex-direction: column;
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
const TwoUp = styled.div`
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  @media (max-width: 460px) { grid-template-columns: 1fr; }
`;
const SubLabel = styled.span`
  display: block; margin-bottom: 5px; font-size: 11px; font-weight: 600;
  color: rgba(232,232,239,0.6);
`;
const PreviewHead = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  flex-wrap: wrap; margin-top: 4px;
`;
// The signing page at a laptop's width, scaled into whatever the dialog can spare. The
// frame keeps its real proportions so the operator judges the layout a signer meets,
// not a squeezed one that only exists inside this box.
//
// No `aspect-ratio` here: SignPagePreview sets the height in pixels from the measured
// width. See its comment — this is a column flex item with no in-flow content, and the
// ratio collapsed to the border.
const SignFrameBox = styled.div`
  position: relative; margin-top: 4px; width: 100%; flex: 0 0 auto;
  border-radius: 10px; overflow: hidden; background: #f4f5f7;
  border: 1px solid rgba(255,255,255,0.14);
`;
const SignFrame = styled.iframe`
  position: absolute; top: 0; left: 0; border: 0; transform-origin: top left;
  width: ${SIGN_FRAME_W}px; height: ${SIGN_FRAME_H}px;
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
// Same flex trap as LineInput, one axis further: a textarea in a flex COLUMN still
// shrinks past its `rows`, which is what squashed the Message body down to one line.
// `flex: 0 0 auto` makes `rows` mean what it says, and the min-height is the floor —
// two of a single-line field (≈42px each), so Message is never shorter than Heading×2.
const Textarea = styled.textarea`${baseField} resize: vertical; width: 100%; flex: 0 0 auto; min-height: 84px;`;
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

// ── the click-through ──────────────────────────────────────────────────────────
const WizRail = styled.div`
  display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin-bottom: 2px;
`;
const RailStep = styled.button<{ $state: "past" | "now" | "next" }>`
  display: inline-flex; align-items: center; gap: 6px; background: transparent;
  border: 1px solid transparent; border-radius: 999px; padding: 4px 11px 4px 9px;
  font-size: 11.5px; font-weight: 650; letter-spacing: 0.01em; cursor: pointer;
  ${(p) =>
    p.$state === "now"
      ? "color: #cfe9ff; background: rgba(120,200,255,0.13); border-color: rgba(120,200,255,0.38);"
      : p.$state === "past"
      ? "color: rgba(232,232,239,0.62);"
      : "color: rgba(232,232,239,0.26); cursor: default;"}
  &:hover:not(:disabled) { color: #cfe9ff; background: rgba(120,200,255,0.08); }
`;
const RailDot = styled.span`
  width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex: 0 0 auto;
`;
// The step's question, in the operator's words, before any field of it.
const StepLead = styled.p`
  margin: 4px 0 2px; font-size: 13px; line-height: 1.5; color: rgba(232,232,239,0.72);
`;
const StepBody = styled.p`
  margin: 6px 0 0; font-size: 12px; line-height: 1.55; color: rgba(232,232,239,0.45);
`;
const WizFoot = styled.div`
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: 0 0 auto;
  padding: 13px 22px; border-top: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.016);
`;
const BackBtn = styled.button`
  ${baseField} display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
  flex: 0 0 auto; font-size: 12.5px; font-weight: 600; padding: 8px 14px 8px 12px;
  &:hover:not(:disabled) { border-color: rgba(120,200,255,0.5); }
  &:disabled { opacity: 0.32; cursor: default; }
`;
// Next stays pressable when a step is incomplete — the click answers WHY in the message
// bar. A greyed button that won't say what it wants is the same dead end twice.
const NextBtn = styled.button<{ $blocked: boolean }>`
  margin-left: auto; flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px;
  border: none; border-radius: 8px; padding: 9px 15px 9px 18px;
  font-size: 13px; font-weight: 650; cursor: pointer;
  background: ${(p) => (p.$blocked ? "rgba(120,200,255,0.16)" : "#3aa0ff")};
  color: ${(p) => (p.$blocked ? "#8fc9f5" : "#001a2e")};
  &:hover:not(:disabled) { background: ${(p) => (p.$blocked ? "rgba(120,200,255,0.24)" : "#58b0ff")}; }
  &:disabled { opacity: 0.45; cursor: default; }
`;
const StepTally = styled.span`
  font-size: 11.5px; color: rgba(232,232,239,0.4); flex: 0 1 auto;
`;
// The whole send in one glance, before the button that spends it.
const Recap = styled.dl`
  margin: 10px 0 2px; display: grid; grid-template-columns: minmax(112px, auto) 1fr;
  gap: 7px 16px; font-size: 12.5px; line-height: 1.55;
  dt { color: rgba(232,232,239,0.48); font-weight: 600; }
  dd { margin: 0; color: rgba(232,232,239,0.86); overflow-wrap: anywhere; }
`;
