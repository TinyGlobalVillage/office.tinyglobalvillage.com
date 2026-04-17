"use client";

import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import { ModalBackdrop, CloseBtn } from "../../styled";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type EmailDetail = {
  id: string;
  subject: string | null;
  from: { name?: string; email: string }[];
  to: { name?: string; email: string }[];
  cc: { name?: string; email: string }[];
  receivedAt: string;
  preview: string;
  unread: boolean;
  flagged: boolean;
  hasAttachment: boolean;
  size: number;
  threadId: string;
  htmlBody: string | null;
  textBody: string | null;
  attachments: { name: string; type: string; size: number; blobId: string }[];
  replyTo: { name?: string; email: string }[];
  inReplyTo: string | null;
  messageId: string[];
};

type Props = {
  email: EmailDetail | null;
  loading: boolean;
  account: string;
  pinVerified: boolean;
  showCcBcc: boolean;
  onReply: (email: EmailDetail) => void;
  onReplyAll: (email: EmailDetail) => void;
  onForward: (email: EmailDetail) => void;
  onEditAsNew: (email: EmailDetail) => void;
  onSendCopy: (email: EmailDetail) => void;
  onAction: (id: string, action: "markRead" | "markUnread" | "flag" | "unflag" | "trash") => void;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatAddress(addr: { name?: string; email: string }[] | null | undefined): string {
  if (!addr || !addr.length) return "(none)";
  return addr
    .map((a) => (a?.name ? `${a.name} <${a.email}>` : a?.email ?? ""))
    .filter(Boolean)
    .join(", ");
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/*  Styled                                                             */
/* ------------------------------------------------------------------ */

const Root = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const CenteredMsg = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

const LoadingLabel = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const EmptyWrap = styled.div`
  text-align: center;
  color: rgba(255, 255, 255, 0.15);

  [data-theme="light"] & {
    color: var(--t-textGhost);
  }
`;

const EmptyIcon = styled.div`
  font-size: 30px;
  margin-bottom: 8px;
`;

const EmptyText = styled.div`
  font-size: 11px;
`;

const HeaderPane = styled.div`
  flex-shrink: 0;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  [data-theme="light"] & {
    border-bottom-color: var(--t-border);
  }
`;

const Subject = styled.h2`
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0 0 12px;
  color: rgba(255, 255, 255, 0.9);

  [data-theme="light"] & {
    color: var(--t-text);
  }
`;

const MetaBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  margin-bottom: 12px;
  color: rgba(255, 255, 255, 0.4);

  [data-theme="light"] & {
    color: var(--t-textMuted);
  }
`;

const MetaRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 4px;
`;

const MetaLabel = styled.span`
  font-weight: 600;
  flex-shrink: 0;
  min-width: 30px;
  color: rgba(255, 255, 255, 0.25);

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const MetaValue = styled.span<{ $dim?: boolean }>`
  color: ${(p) => (p.$dim ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.7)")};

  [data-theme="light"] & {
    color: ${(p) => (p.$dim ? "var(--t-textMuted)" : "var(--t-text)")};
  }
`;

const AttachmentRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
`;

const AttachmentChip = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: var(--t-border);
    color: var(--t-textMuted);
  }
`;

const AttachmentSize = styled.span`
  color: rgba(255, 255, 255, 0.25);

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const ActionBar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ReplyBtn = styled.button`
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  transition: all 0.15s;
  cursor: pointer;
  background: rgba(${rgb.cyan}, 0.1);
  border: 1px solid rgba(${rgb.cyan}, 0.25);
  color: ${colors.cyan};

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const ActionsWrap = styled.div`
  position: relative;
`;

const ActionsBtn = styled.button<{ $open: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  transition: all 0.15s;
  cursor: pointer;
  background: ${(p) => (p.$open ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.05)")};
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  [data-theme="light"] & {
    background: ${(p) => (p.$open ? "rgba(0, 0, 0, 0.06)" : "var(--t-surface)")};
    border-color: var(--t-border);
    color: var(--t-textMuted);
  }
`;

const Chevron = styled.svg<{ $open: boolean }>`
  transform: ${(p) => (p.$open ? "rotate(180deg)" : "none")};
  transition: transform 0.15s;
`;

const ActionsDropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  border-radius: 12px;
  overflow: hidden;
  z-index: 50;
  min-width: 200px;
  background: rgba(8, 10, 16, 0.99);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.8);

  [data-theme="light"] & {
    background: #fff;
    border-color: var(--t-border);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.12);
  }
`;

const ActionDivider = styled.div`
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 3px 0;

  [data-theme="light"] & {
    background: var(--t-border);
  }
`;

const ActionItem = styled.button<{ $danger?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 500;
  text-align: left;
  transition: background 0.1s;
  background: none;
  border: none;
  cursor: pointer;
  color: ${(p) => (p.$danger ? "rgba(255, 100, 100, 0.8)" : "rgba(255, 255, 255, 0.65)")};

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  [data-theme="light"] & {
    color: ${(p) => (p.$danger ? colors.red : "var(--t-text)")};
    &:hover {
      background: rgba(0, 0, 0, 0.04);
    }
  }
`;

const ActionIcon = styled.span<{ $danger?: boolean }>`
  width: 16px;
  text-align: center;
  flex-shrink: 0;
  font-size: 10px;
  color: ${(p) => (p.$danger ? "rgba(255, 100, 100, 0.6)" : "rgba(255, 255, 255, 0.3)")};

  [data-theme="light"] & {
    color: ${(p) => (p.$danger ? `rgba(${rgb.red}, 0.6)` : "var(--t-textFaint)")};
  }
`;

const BodyPane = styled.div`
  flex: 1;
  overflow: hidden;
`;

const TextBody = styled.div`
  height: 100%;
  overflow-y: auto;
  padding: 12px 16px;
`;

const TextPre = styled.pre`
  font-size: 11px;
  white-space: pre-wrap;
  font-family: monospace;
  line-height: 1.625;
  color: rgba(255, 255, 255, 0.6);

  [data-theme="light"] & {
    color: var(--t-text);
  }
`;

const HtmlFrame = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
`;

/* --- RawMessageModal styled --- */

const RawBackdrop = styled(ModalBackdrop)`
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const RawContainer = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  width: min(96vw, 720px);
  max-height: 80vh;
  background: rgba(8, 10, 16, 0.99);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.8);

  [data-theme="light"] & {
    background: rgba(255, 255, 255, 0.99);
    border-color: var(--t-border);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.15);
  }
`;

const RawHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);

  [data-theme="light"] & {
    border-bottom-color: var(--t-border);
  }
`;

const RawTitle = styled.span`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.4);

  [data-theme="light"] & {
    color: var(--t-textMuted);
  }
`;

const RawCloseBtn = styled(CloseBtn)`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  background: none;
  border: none;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  [data-theme="light"] & {
    color: var(--t-textFaint);
    &:hover {
      background: rgba(0, 0, 0, 0.06);
    }
  }
`;

const RawBody = styled.pre`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  font-size: 11px;
  font-family: monospace;
  line-height: 1.625;
  white-space: pre-wrap;
  color: rgba(255, 255, 255, 0.6);
  scrollbar-width: thin;

  [data-theme="light"] & {
    color: var(--t-text);
  }
`;

/* ------------------------------------------------------------------ */
/*  RawMessageModal                                                    */
/* ------------------------------------------------------------------ */

function RawMessageModal({ email, onClose }: { email: EmailDetail; onClose: () => void }) {
  const raw = [
    `From:    ${formatAddress(email.from)}`,
    `To:      ${formatAddress(email.to)}`,
    email.cc.length ? `Cc:      ${formatAddress(email.cc)}` : null,
    `Date:    ${formatDate(email.receivedAt)}`,
    `Subject: ${email.subject ?? "(no subject)"}`,
    email.inReplyTo ? `In-Reply-To: ${email.inReplyTo}` : null,
    email.messageId.length ? `Message-ID: ${email.messageId[0]}` : null,
    ``,
    email.textBody ?? email.htmlBody ?? "(no body)",
  ]
    .filter((l) => l !== null)
    .join("\n");

  return (
    <RawBackdrop onClick={onClose}>
      <RawContainer onClick={(e) => e.stopPropagation()}>
        <RawHeader>
          <RawTitle>Raw Message</RawTitle>
          <RawCloseBtn onClick={onClose}>{"✕"}</RawCloseBtn>
        </RawHeader>
        <RawBody>{raw}</RawBody>
      </RawContainer>
    </RawBackdrop>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageView                                                        */
/* ------------------------------------------------------------------ */

export default function MessageView({
  email,
  loading,
  showCcBcc,
  onReply,
  onReplyAll,
  onForward,
  onEditAsNew,
  onSendCopy,
  onAction,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewMode, setViewMode] = useState<"html" | "text">("html");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showRawModal, setShowRawModal] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!iframeRef.current || !email?.htmlBody) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.6;color:#e0e0e0;background:transparent;margin:16px;padding:0;word-break:break-word;}a{color:${colors.cyan};}img{max-width:100%;height:auto;}pre,code{background:rgba(255,255,255,0.05);padding:2px 5px;border-radius:4px;}</style></head><body>${email.htmlBody}</body></html>`,
    );
    doc.close();
  }, [email?.htmlBody, email?.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node))
        setActionsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setViewMode("html");
  }, [email?.id]);

  const handlePrint = () => {
    if (viewMode === "html" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    } else {
      const w = window.open("", "_blank");
      if (w && email) {
        w.document.write(
          `<html><head><title>${email.subject ?? "Email"}</title></head><body><pre style="font-family:sans-serif;white-space:pre-wrap">${email.textBody ?? email.htmlBody ?? ""}</pre></body></html>`,
        );
        w.document.close();
        w.print();
      }
    }
    setActionsOpen(false);
  };

  const handleDownload = () => {
    if (!email) return;
    const lines = [
      `From: ${formatAddress(email.from)}`,
      `To: ${formatAddress(email.to)}`,
      email.cc.length ? `Cc: ${formatAddress(email.cc)}` : null,
      `Date: ${formatDate(email.receivedAt)}`,
      `Subject: ${email.subject ?? "(no subject)"}`,
      email.inReplyTo ? `In-Reply-To: ${email.inReplyTo}` : null,
      email.messageId.length ? `Message-ID: ${email.messageId[0]}` : null,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      email.textBody ?? "(no text body)",
    ]
      .filter((l) => l !== null)
      .join("\r\n");
    const blob = new Blob([lines], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(email.subject ?? "email").replace(/[^a-z0-9]/gi, "_").slice(0, 60)}.eml`;
    a.click();
    URL.revokeObjectURL(url);
    setActionsOpen(false);
  };

  if (loading)
    return (
      <CenteredMsg>
        <LoadingLabel>Loading…</LoadingLabel>
      </CenteredMsg>
    );

  if (!email)
    return (
      <CenteredMsg>
        <EmptyWrap>
          <EmptyIcon>{"✉"}</EmptyIcon>
          <EmptyText>Select an email to read</EmptyText>
        </EmptyWrap>
      </CenteredMsg>
    );

  type ActionDef = { label: string; icon: string; onClick: () => void; danger?: boolean } | "divider";
  const actionItems: ActionDef[] = [
    { label: "Reply", icon: "↩", onClick: () => { onReply(email); setActionsOpen(false); } },
    { label: "Reply All", icon: "↩↩", onClick: () => { onReplyAll(email); setActionsOpen(false); } },
    { label: "Forward", icon: "→", onClick: () => { onForward(email); setActionsOpen(false); } },
    "divider",
    { label: "Edit as new", icon: "✎", onClick: () => { onEditAsNew(email); setActionsOpen(false); } },
    { label: "Send a copy", icon: "⊕", onClick: () => { onSendCopy(email); setActionsOpen(false); } },
    "divider",
    { label: "Print", icon: "⎙", onClick: handlePrint },
    { label: "Download .eml", icon: "⬇", onClick: handleDownload },
    "divider",
    {
      label: viewMode === "text" ? "View as HTML" : "View as text",
      icon: "</>",
      onClick: () => { setViewMode((v) => (v === "text" ? "html" : "text")); setActionsOpen(false); },
    },
    { label: "Show raw message", icon: "⊞", onClick: () => { setShowRawModal(true); setActionsOpen(false); } },
    "divider",
    {
      label: email.flagged ? "Remove flag" : "Flag",
      icon: email.flagged ? "★" : "☆",
      onClick: () => { onAction(email.id, email.flagged ? "unflag" : "flag"); setActionsOpen(false); },
    },
    {
      label: email.unread ? "Mark as read" : "Mark as unread",
      icon: email.unread ? "✓" : "●",
      onClick: () => { onAction(email.id, email.unread ? "markRead" : "markUnread"); setActionsOpen(false); },
    },
    "divider",
    {
      label: "Delete",
      icon: "🗑",
      danger: true,
      onClick: () => { onAction(email.id, "trash"); setActionsOpen(false); },
    },
  ];

  return (
    <>
      <Root>
        <HeaderPane>
          <Subject>{email.subject ?? "(no subject)"}</Subject>
          <MetaBlock>
            <MetaRow>
              <MetaLabel>From</MetaLabel>
              <MetaValue>{formatAddress(email.from)}</MetaValue>
            </MetaRow>
            <MetaRow>
              <MetaLabel>To</MetaLabel>
              <MetaValue $dim>{formatAddress(email.to)}</MetaValue>
            </MetaRow>
            {showCcBcc && email.cc.length > 0 && (
              <MetaRow>
                <MetaLabel>Cc</MetaLabel>
                <MetaValue $dim>{formatAddress(email.cc)}</MetaValue>
              </MetaRow>
            )}
            <MetaRow>
              <MetaLabel>Date</MetaLabel>
              <span>{formatDate(email.receivedAt)}</span>
            </MetaRow>
          </MetaBlock>

          {email.attachments.length > 0 && (
            <AttachmentRow>
              {email.attachments.map((att, i) => (
                <AttachmentChip key={i}>
                  {"📎"} {att.name}{" "}
                  <AttachmentSize>({humanSize(att.size)})</AttachmentSize>
                </AttachmentChip>
              ))}
            </AttachmentRow>
          )}

          <ActionBar>
            <ReplyBtn onClick={() => onReply(email)}>
              {"↩"} Reply
            </ReplyBtn>
            <ActionsWrap ref={actionsRef}>
              <ActionsBtn $open={actionsOpen} onClick={() => setActionsOpen((p) => !p)}>
                Actions
                <Chevron
                  $open={actionsOpen}
                  width="7"
                  height="7"
                  viewBox="0 0 8 8"
                  fill="currentColor"
                >
                  <path d="M4 6L0.5 1.5h7L4 6z" />
                </Chevron>
              </ActionsBtn>
              {actionsOpen && (
                <ActionsDropdown>
                  {actionItems.map((item, i) => {
                    if (item === "divider") return <ActionDivider key={i} />;
                    return (
                      <ActionItem key={i} onClick={item.onClick} $danger={item.danger}>
                        <ActionIcon $danger={item.danger}>{item.icon}</ActionIcon>
                        {item.label}
                      </ActionItem>
                    );
                  })}
                </ActionsDropdown>
              )}
            </ActionsWrap>
          </ActionBar>
        </HeaderPane>

        <BodyPane>
          {viewMode === "text" || !email.htmlBody ? (
            <TextBody>
              <TextPre>{email.textBody ?? "(no text body)"}</TextPre>
            </TextBody>
          ) : (
            <HtmlFrame
              ref={iframeRef}
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              title="Email body"
            />
          )}
        </BodyPane>
      </Root>
      {showRawModal && <RawMessageModal email={email} onClose={() => setShowRawModal(false)} />}
    </>
  );
}
