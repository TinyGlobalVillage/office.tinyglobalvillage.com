"use client";

// ESignControlModal — TGV Office "E-Sign Documents" console (Utils → Documents group).
//
// Lifts the @tgv/module-legal/module-documenso e-sign engine (built for Studio waivers) onto
// Office so operators (Gio/Marthe) can send ANY document to ANYONE for signature.
//
// THREE views on a PillBar:
//   New Document — the shared click-through, `EsignWizard` from the module (Gio 2026-10-18:
//     "Lift this entire module onto the dashboard … the same modal as on TGV Office"). Office
//     is one HOST of it: this file passes the staff roster as the quick-add list, the
//     operator's own addresses, the My Documents / disk chooser, the house email look, and
//     the multipart send to /api/esign/documents. Every member dashboard hosts the same
//     component with its own answers to those. The wizard's two steps, Document → Invitation,
//     and the Invitation step's PillBar over the two emails (the signing invitation, and the
//     follow-up that carries the signed copy) live in the module, not here.
//   Activity — the outbox (sent → signed per recipient; X removes an entry, log-only).
//   Documents — the library w/ kind filter, per-signer status, copy-link, delete.
//
// Office WRITES AND SENDS both emails itself — Documenso is told to email nobody — from the
// house mailbox (SUPPORT_FROM_EMAIL, "Tiny Global Village"); per-send sender control is
// Reply-To, defaulting to support@. The signed copy goes to the delivery list the operator
// ticks on the Invitation step, seeded with the operator alone.
//
// Self-contained (styled-components, per Office's no-Tailwind rule). Inline SVGs — no emoji.

import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import ConfirmModal from "../frontdesk/ConfirmModal";
import DocumentChooser from "./DocumentChooser";
import EsignWizard, { type EsignSendResult, type EsignWizardPayload } from "@tgv/module-documenso/components/EsignWizard";
import { HOUSE_MAIL_BRAND } from "@tgv/module-documenso/components/mailDefaults";

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
const KIND_SEGMENTS = [
  { key: "all", label: "All" },
  { key: "waiver", label: "Waivers" },
  { key: "multisig", label: "Multiple Signatures" },
];
const ACCENT = "58, 160, 255"; // modal cyan-blue (#3aa0ff)
const DEFAULT_REPLY_TO = "support@tinyglobalvillage.com";

const XIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const DownloadIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M6 11l6 6 6-6M4 21h16" />
  </svg>
);

type ConfirmState = {
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
  run: () => Promise<void>;
};

/** The wizard's payload as /api/esign/documents takes it: one multipart POST with progress. */
function postEsignDocument(payload: EsignWizardPayload, onProgress: (pct: number | null) => void): Promise<EsignSendResult> {
  const fd = new FormData();
  fd.append("title", payload.title);
  fd.append("file", payload.file);
  fd.append("kind", "multisig");
  fd.append("signers", JSON.stringify(payload.signers));
  fd.append("sequential", String(payload.sequential));
  fd.append("deliveryEmails", JSON.stringify(payload.deliveryEmails));
  fd.append("note", payload.invite.message ?? "");
  fd.append("emailSubject", payload.invite.subject ?? "");
  fd.append("inviteHeading", payload.invite.heading ?? "");
  fd.append("inviteButtonLabel", payload.invite.buttonLabel ?? "");
  fd.append("inviteFooter", payload.invite.footer ?? "");
  fd.append("emailReplyTo", payload.invite.replyTo ?? "");
  fd.append("completionSubject", payload.completion.subject ?? "");
  fd.append("completionHeading", payload.completion.heading ?? "");
  fd.append("completionMessage", payload.completion.message ?? "");
  fd.append("completionFooter", payload.completion.footer ?? "");
  fd.append("placements", JSON.stringify(payload.placements));
  fd.append("includeCertificate", String(payload.includeCertificate));

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/esign/documents");
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.upload.onload = () => onProgress(null); // bytes are up; the server is talking to Documenso
    xhr.onload = () => {
      let d: { ok?: boolean; error?: string; document?: { invitedCount?: number; inviteFailed?: string[] } } = {};
      try { d = JSON.parse(xhr.responseText); } catch { /* non-JSON body */ }
      if (xhr.status >= 200 && xhr.status < 300 && d?.ok) {
        const failed = d.document?.inviteFailed ?? [];
        resolve({
          ok: true,
          invitedCount: d.document?.invitedCount,
          ...(failed.length ? { summary: `Created, but the invitation to ${failed.join(", ")} could not be sent — resend it from the Documents tab.` } : {}),
        });
      } else resolve({ ok: false, error: d?.error ?? `Upload failed (HTTP ${xhr.status})` });
    };
    xhr.onerror = () => resolve({ ok: false, error: "Upload failed (network error)" });
    xhr.ontimeout = () => resolve({ ok: false, error: "Upload timed out after 2 min — please try again." });
    xhr.send(fd);
  });
}

export default function ESignControlModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("new");
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  // The operator's own addresses (Fastmail sending identities + roster email). Gio receives
  // at four domains; the roster's single address was answering a question he hadn't been asked.
  const [myAddresses, setMyAddresses] = useState<string[]>([]);
  const [docFilter, setDocFilter] = useState<KindFilter>("all");

  const loadDocuments = useCallback(async () => {
    try {
      const r = await fetch("/api/esign/documents");
      const d = await r.json();
      if (d?.ok) {
        setConfigured(Boolean(d.configured));
        setDocuments(d.documents ?? []);
        setStaff(d.staff ?? []);
        if (d.me?.email) {
          const mine = String(d.me.email).toLowerCase();
          setMyAddresses(Array.isArray(d.me.addresses) && d.me.addresses.length ? d.me.addresses.map(String) : [mine]);
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

  const onSent = useCallback((r: EsignSendResult) => {
    if (r.ok) void Promise.all([loadDocuments(), loadActivity()]);
  }, [loadDocuments, loadActivity]);

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
        ? "It leaves the library and the envelope is retired at the signing service — signing links already sent stop working, and nobody is emailed about the removal. A document that already completed keeps its signed copy; consent records are kept for audit."
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
            <CloseBtn type="button" onClick={onClose} aria-label="Close"><XIcon /></CloseBtn>
          </HeaderActions>
        </Header>

        {!configured && tab !== "new" && (
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

        {msg && tab !== "new" && <Msg onClick={() => setMsg("")}>{msg}</Msg>}

        {loading && <Body><Dim>Loading…</Dim></Body>}

        {!loading && tab === "new" && (
          <EsignWizard
            configured={configured}
            myAddresses={myAddresses}
            quickAdd={staff.map((s) => ({ email: s.email, name: s.username }))}
            quickAddLabel="Add staff"
            defaultDelivery="me"
            brand={HOUSE_MAIL_BRAND}
            senderLine="Tiny Global Village <no-reply@tinyglobalvillage.com>"
            replyToEditable
            replyToFixed={DEFAULT_REPLY_TO}
            renderPicker={(p) => (
              <DocumentChooser open={p.open} onClose={p.onClose} onPick={(f) => p.onPick(f)} onNotice={p.onNotice} />
            )}
            send={postEsignDocument}
            onSent={onSent}
          />
        )}

        {!loading && tab === "documents" && (
          <Body>
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
                            <SignerPill key={s.email} $s={s.status}>
                              {s.name || s.email} · {s.status === "sent" ? "pending" : s.status}
                            </SignerPill>
                          ))}
                        </SignerLine>
                      )}
                    </ItemMain>
                    <ItemActions>
                      {d.shareUrl && <GhostBtn type="button" onClick={() => copyLink(d.shareUrl)}>Copy link</GhostBtn>}
                      <DelBtn type="button" onClick={() => askDeleteDoc(d)} aria-label="Delete document"><XIcon size={13} /></DelBtn>
                    </ItemActions>
                  </Item>
                ))}
              </List>
            </Section>
          </Body>
        )}

        {!loading && tab === "activity" && (
          <Body>
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
                        <IconLink href={`/api/esign/pdf/${a.signatureId}`} target="_blank" rel="noreferrer" aria-label="Download signed PDF">
                          <DownloadIcon />
                        </IconLink>
                      )}
                      <DelBtn type="button" onClick={() => askRemoveActivity(a)} aria-label="Remove entry"><XIcon size={13} /></DelBtn>
                    </ActRight>
                  </ActItem>
                ))}
              </List>
            </Section>
          </Body>
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

// ── styled ──────────────────────────────────────────────────────────────────────
const Backdrop = styled.div`
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.66); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
`;
const Panel = styled.div`
  /* Wide enough that the staged PDF and the email card are judged at a readable scale. */
  width: min(860px, 100%); max-height: 90vh; display: flex; flex-direction: column;
  background: #0d0d12; border: 1px solid rgba(120,200,255,0.18); border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.6); color: #e8e8ef; overflow: hidden;
  /* DDM accent (recipient pickers) → cyan to match the modal; the wizard reads --esw-*. */
  --ddm-accent: #3aa0ff;
  --ddm-accent-rgb: 58, 160, 255;
  --esw-accent: #3aa0ff;
  --esw-accent-rgb: 58, 160, 255;
  --esw-text: #e8e8ef;
  --esw-on-accent: #001a2e;
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
const Warn = styled.div`margin: 12px 22px 0; padding: 10px 12px; border-radius: 8px; font-size: 12.5px; background: rgba(255,180,60,0.1); border: 1px solid rgba(255,180,60,0.3); color: #ffcf87;`;
const TabsRow = styled.div`padding: 14px 22px 0;`;
const Msg = styled.div`margin: 12px 22px 0; padding: 9px 12px; border-radius: 8px; font-size: 12.5px; background: rgba(120,200,255,0.1); border: 1px solid rgba(120,200,255,0.28); color: #cfe9ff; cursor: pointer;`;
const Body = styled.div`padding: 18px 22px 22px; overflow-y: auto;`;
const Section = styled.div`display: flex; flex-direction: column; gap: 8px;`;
const baseField = `
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px; color: #e8e8ef; padding: 9px 11px; font-size: 13px; outline: none;
  &:focus { border-color: rgba(120,200,255,0.5); }
`;
const GhostBtn = styled.button`${baseField} cursor: pointer; flex: 0 0 auto; font-size: 12px; padding: 6px 12px; &:hover { border-color: rgba(120,200,255,0.5); }`;
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
