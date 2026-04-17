"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import AccountSwitcher, { type AccountMeta } from "./AccountSwitcher";
import MailboxPanel from "./MailboxPanel";
import MessageList from "./MessageList";
import MessageView from "./MessageView";
import ComposeModal from "./ComposeModal";
import EmailSettings from "./EmailSettings";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Props = { zoom: number };

type Mailbox = {
  id: string;
  name: string;
  role: string | null;
  totalEmails: number;
  unreadEmails: number;
  parentId: string | null;
  sortOrder: number;
};

type EmailSummary = {
  id: string;
  subject: string | null;
  from: { name?: string; email: string }[];
  to: { name?: string; email: string }[];
  receivedAt: string;
  preview: string;
  unread: boolean;
  flagged: boolean;
  hasAttachment: boolean;
  size: number;
  threadId: string;
};

type EmailDetail = EmailSummary & {
  htmlBody: string | null;
  textBody: string | null;
  attachments: { name: string; type: string; size: number; blobId: string }[];
  cc: { name?: string; email: string }[];
  replyTo: { name?: string; email: string }[];
  inReplyTo: string | null;
  messageId: string[];
};

type Settings = {
  sections: {
    mailboxPanel: boolean;
    previewPane: boolean;
    composeToolbar: boolean;
    attachmentBar: boolean;
    ccBcc: boolean;
    threadView: boolean;
  };
  display: {
    zoom: number;
    splitMode: "vertical" | "horizontal" | "fullList";
    defaultAccount: string;
  };
};

type ComposeMode = {
  mode: "new" | "reply" | "replyAll" | "forward" | "editAsNew" | "sendCopy";
  email?: EmailDetail;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function replySubject(subject: string | null): string {
  if (!subject) return "Re: ";
  return subject.startsWith("Re:") ? subject : `Re: ${subject}`;
}

function forwardSubject(subject: string | null): string {
  if (!subject) return "Fwd: ";
  return subject.startsWith("Fwd:") ? subject : `Fwd: ${subject}`;
}

function quoteEmail(email: EmailDetail): string {
  const from = email.from
    .map((a) => (a.name ? `${a.name} <${a.email}>` : a.email))
    .join(", ");
  const date = new Date(email.receivedAt).toLocaleString();
  const body = email.textBody ?? "(no text body)";
  return `\n\n--- Original message from ${from} on ${date} ---\n${body}`;
}

/* ------------------------------------------------------------------ */
/*  Styled                                                             */
/* ------------------------------------------------------------------ */

const Root = styled.div<{ $zoom: number }>`
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: ${(p) => p.$zoom * 100}%;
  background: var(--t-bg, #060810);
  color: var(--t-text, rgba(255, 255, 255, 0.85));
`;

const SwitcherBar = styled.div`
  flex-shrink: 0;
`;

/* --- Mobile layout --- */

const MobileWrap = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (min-width: 640px) {
    display: none;
  }
`;

const MobilePane = styled.div`
  flex: 1;
  overflow: hidden;
`;

const MobileTabBar = styled.div`
  flex-shrink: 0;
  display: flex;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: var(--t-bg, rgba(6, 8, 16, 0.95));

  [data-theme="light"] & {
    border-top-color: var(--t-border);
    background: var(--t-bg);
  }
`;

const MobileTab = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 10px 0;
  font-size: 10px;
  font-weight: 600;
  text-align: center;
  transition: all 0.15s;
  background: none;
  border: none;
  cursor: pointer;
  color: ${(p) => (p.$active ? colors.cyan : "rgba(255, 255, 255, 0.3)")};
  border-top: 2px solid ${(p) => (p.$active ? colors.cyan : "transparent")};

  [data-theme="light"] & {
    color: ${(p) => (p.$active ? colors.cyan : "var(--t-textFaint)")};
  }
`;

/* --- Desktop layout --- */

const DesktopWrap = styled.div`
  flex: 1;
  display: none;
  overflow: hidden;

  @media (min-width: 640px) {
    display: flex;
  }
`;

const MailboxCol = styled.div`
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid rgba(255, 255, 255, 0.06);

  [data-theme="light"] & {
    border-right-color: var(--t-border);
  }
`;

const ListCol = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.06);

  [data-theme="light"] & {
    border-right-color: var(--t-border);
  }
`;

const PreviewCol = styled.div`
  flex: 1;
  overflow: hidden;
`;

const HorizontalTop = styled.div`
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  [data-theme="light"] & {
    border-bottom-color: var(--t-border);
  }
`;

const HorizontalBottom = styled.div`
  flex: 1;
  overflow: hidden;
`;

/* --- DragHandle --- */

const DragHandleBar = styled.div<{ $dir: "vertical" | "horizontal" }>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${(p) => (p.$dir === "vertical" ? "col-resize" : "row-resize")};
  user-select: none;
  width: ${(p) => (p.$dir === "vertical" ? "6px" : "auto")};
  height: ${(p) => (p.$dir === "horizontal" ? "6px" : "auto")};
  background: transparent;
  transition: background 0.15s;

  &:hover {
    background: rgba(${rgb.cyan}, 0.08);
  }

  &:active {
    background: rgba(${rgb.cyan}, 0.15);
  }
`;

const DragDot = styled.div<{ $dir: "vertical" | "horizontal" }>`
  width: ${(p) => (p.$dir === "vertical" ? "2px" : "16px")};
  height: ${(p) => (p.$dir === "vertical" ? "16px" : "2px")};
  border-radius: 1px;
  background: rgba(255, 255, 255, 0.15);

  [data-theme="light"] & {
    background: rgba(0, 0, 0, 0.15);
  }
`;

/* --- Error / retry --- */

const ErrorBlock = styled.div`
  padding: 16px;
  text-align: center;
`;

const ErrorMsg = styled.div`
  font-size: 12px;
  margin-bottom: 8px;
  color: rgba(${rgb.red}, 0.8);

  [data-theme="light"] & {
    color: ${colors.red};
  }
`;

const RetryBtn = styled.button`
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  background: rgba(${rgb.cyan}, 0.12);
  border: 1px solid rgba(${rgb.cyan}, 0.3);
  color: ${colors.cyan};
  transition: all 0.15s;

  &:hover {
    background: rgba(${rgb.cyan}, 0.2);
  }
`;

const ComposeFloatBtn = styled.button`
  position: fixed;
  bottom: 72px;
  right: 16px;
  z-index: 40;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  background: rgba(${rgb.cyan}, 0.2);
  border: 1px solid rgba(${rgb.cyan}, 0.4);
  color: ${colors.cyan};
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  transition: all 0.15s;

  &:hover {
    background: rgba(${rgb.cyan}, 0.3);
  }

  @media (min-width: 640px) {
    display: none;
  }

  [data-theme="light"] & {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  }
`;

const SettingsBtn = styled.button`
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.4);
  transition: all 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: var(--t-border);
    color: var(--t-textMuted);
    &:hover {
      background: rgba(0, 0, 0, 0.06);
    }
  }
`;

const DesktopComposeBtn = styled.button`
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  background: rgba(${rgb.cyan}, 0.15);
  border: 1px solid rgba(${rgb.cyan}, 0.35);
  color: ${colors.cyan};
  transition: all 0.15s;

  &:hover {
    background: rgba(${rgb.cyan}, 0.25);
  }
`;

const TopActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  [data-theme="light"] & {
    border-bottom-color: var(--t-border);
  }
`;

/* ------------------------------------------------------------------ */
/*  DragHandle                                                         */
/* ------------------------------------------------------------------ */

function DragHandle({
  direction,
  onDrag,
}: {
  direction: "vertical" | "horizontal";
  onDrag: (delta: number) => void;
}) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const start = direction === "vertical" ? e.clientX : e.clientY;

    const handleMove = (ev: MouseEvent) => {
      const current = direction === "vertical" ? ev.clientX : ev.clientY;
      onDrag(current - start);
    };

    const handleUp = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  return (
    <DragHandleBar $dir={direction} onMouseDown={handleMouseDown}>
      <DragDot $dir={direction} />
    </DragHandleBar>
  );
}

/* ------------------------------------------------------------------ */
/*  EmailClient                                                        */
/* ------------------------------------------------------------------ */

export default function EmailClient({ zoom }: Props) {
  const [accounts, setAccounts] = useState<AccountMeta[]>([]);
  const [selected, setSelected] = useState<string>("admin");
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string | null>(null);
  const [mailboxError, setMailboxError] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailSummary[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [emailDetail, setEmailDetail] = useState<EmailDetail | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [msgsError, setMsgsError] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeMode | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mobilePane, setMobilePane] = useState<"mailboxes" | "list" | "message">("list");

  // Desktop drag-split state
  const [mailboxWidth, setMailboxWidth] = useState(200);
  const [listWidth, setListWidth] = useState(340);
  const [splitRatio, setSplitRatio] = useState(0.4); // for horizontal mode
  const mailboxBaseRef = useRef(200);
  const listBaseRef = useRef(340);
  const splitBaseRef = useRef(0.4);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch accounts
  useEffect(() => {
    fetch("/api/email/session")
      .then((r) => r.json())
      .then((d: { accounts?: AccountMeta[] }) => {
        if (d.accounts?.length) {
          setAccounts(d.accounts);
          setSelected(d.accounts[0].key);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch settings
  useEffect(() => {
    fetch("/api/email/settings")
      .then((r) => r.json())
      .then((d: Settings) => {
        if (d?.sections && d?.display) setSettings(d);
      })
      .catch(() => {});
  }, []);

  // Fetch mailboxes when account changes
  useEffect(() => {
    if (!selected) return;
    setMailboxError(null);
    fetch(`/api/email/mailboxes?account=${selected}`)
      .then((r) => r.json())
      .then((d: { mailboxes?: Mailbox[] }) => {
        const mbs = d.mailboxes ?? [];
        setMailboxes(mbs);
        const inbox = mbs.find((m) => m.role === "inbox");
        if (inbox) setSelectedMailbox(inbox.id);
        else if (mbs.length) setSelectedMailbox(mbs[0].id);
      })
      .catch(() => setMailboxError("Failed to load mailboxes."));
  }, [selected]);

  // Fetch messages when mailbox changes
  const fetchMessages = useCallback(() => {
    if (!selected || !selectedMailbox) return;
    setLoadingMsgs(true);
    setMsgsError(null);
    fetch(`/api/email/messages?account=${selected}&mailbox=${selectedMailbox}`)
      .then((r) => r.json())
      .then((d: { messages?: EmailSummary[]; total?: number }) => {
        setMessages(d.messages ?? []);
        setTotalMessages(d.total ?? 0);
      })
      .catch(() => setMsgsError("Failed to load messages."))
      .finally(() => setLoadingMsgs(false));
  }, [selected, selectedMailbox]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Fetch email detail when message selected
  useEffect(() => {
    if (!selected || !selectedMessage) {
      setEmailDetail(null);
      return;
    }
    setLoadingDetail(true);
    fetch(`/api/email/messages?account=${selected}&id=${selectedMessage}`)
      .then((r) => r.json())
      .then((d: EmailDetail) => setEmailDetail(d))
      .catch(() => setEmailDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [selected, selectedMessage]);

  const handleSelectMessage = (id: string) => {
    setSelectedMessage(id);
    setMobilePane("message");
  };

  const handleAction = useCallback(
    (id: string, action: "markRead" | "markUnread" | "flag" | "unflag" | "trash") => {
      fetch("/api/email/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: selected, id, action }),
      })
        .then((r) => r.json())
        .then((d: { ok?: boolean }) => {
          if (d.ok) {
            fetchMessages();
            if (action === "trash" && selectedMessage === id) {
              setSelectedMessage(null);
              setEmailDetail(null);
            }
          }
        })
        .catch(() => {});
    },
    [selected, selectedMessage, fetchMessages],
  );

  const openCompose = (mode: ComposeMode) => setCompose(mode);

  const handleReply = (email: EmailDetail) => {
    openCompose({ mode: "reply", email });
  };
  const handleReplyAll = (email: EmailDetail) => {
    openCompose({ mode: "replyAll", email });
  };
  const handleForward = (email: EmailDetail) => {
    openCompose({ mode: "forward", email });
  };
  const handleEditAsNew = (email: EmailDetail) => {
    openCompose({ mode: "editAsNew", email });
  };
  const handleSendCopy = (email: EmailDetail) => {
    openCompose({ mode: "sendCopy", email });
  };

  const composeProps = () => {
    if (!compose) return null;
    const acct = accounts.find((a) => a.key === selected) ?? accounts[0];
    if (!acct) return null;

    const base = {
      fromEmail: acct.email,
      fromLabel: acct.label,
      account: acct.key,
      accounts,
      pinVerified: true,
      onClose: () => setCompose(null),
      onSent: fetchMessages,
    };

    const em = compose.email;
    if (!em) return base;

    switch (compose.mode) {
      case "reply":
        return {
          ...base,
          initialTo: em.replyTo.length ? em.replyTo : em.from,
          initialSubject: replySubject(em.subject),
          initialBody: quoteEmail(em),
          inReplyTo: em.messageId[0] ?? undefined,
          references: em.messageId,
        };
      case "replyAll":
        return {
          ...base,
          initialTo: em.replyTo.length ? em.replyTo : em.from,
          initialCc: em.cc,
          initialSubject: replySubject(em.subject),
          initialBody: quoteEmail(em),
          inReplyTo: em.messageId[0] ?? undefined,
          references: em.messageId,
        };
      case "forward":
        return {
          ...base,
          initialSubject: forwardSubject(em.subject),
          initialBody: quoteEmail(em),
        };
      case "editAsNew":
        return {
          ...base,
          initialTo: em.to,
          initialCc: em.cc,
          initialSubject: em.subject ?? "",
          initialBody: em.textBody ?? "",
        };
      case "sendCopy":
        return {
          ...base,
          initialSubject: em.subject ?? "",
          initialBody: em.textBody ?? "",
        };
      default:
        return base;
    }
  };

  const splitMode = settings?.display?.splitMode ?? "vertical";
  const showMailbox = settings?.sections?.mailboxPanel !== false;
  const showPreview = settings?.sections?.previewPane !== false && splitMode !== "fullList";
  const showCcBcc = settings?.sections?.ccBcc ?? false;

  /* --- Desktop drag handlers --- */

  const handleMailboxDrag = useCallback(
    (delta: number) => {
      setMailboxWidth(Math.max(140, Math.min(360, mailboxBaseRef.current + delta)));
    },
    [],
  );
  const handleMailboxDragEnd = () => {
    mailboxBaseRef.current = mailboxWidth;
  };

  const handleListDrag = useCallback(
    (delta: number) => {
      setListWidth(Math.max(200, Math.min(600, listBaseRef.current + delta)));
    },
    [],
  );
  const handleListDragEnd = () => {
    listBaseRef.current = listWidth;
  };

  const handleSplitDrag = useCallback(
    (delta: number) => {
      if (!containerRef.current) return;
      const h = containerRef.current.clientHeight;
      setSplitRatio(Math.max(0.2, Math.min(0.8, splitBaseRef.current + delta / h)));
    },
    [],
  );
  const handleSplitDragEnd = () => {
    splitBaseRef.current = splitRatio;
  };

  /* --- Render --- */

  return (
    <Root $zoom={zoom}>
      <SwitcherBar>
        <AccountSwitcher
          accounts={accounts}
          selected={selected}
          onSelect={(key) => {
            setSelected(key);
            setMailboxes([]);
            setSelectedMailbox(null);
            setMessages([]);
            setTotalMessages(0);
            setSelectedMessage(null);
            setEmailDetail(null);
            setMailboxError(null);
          }}
          onSettings={() => setShowSettings(true)}
        />
      </SwitcherBar>

      {/* Mobile layout */}
      <MobileWrap>
        <MobilePane>
          {mobilePane === "mailboxes" && (
            <MailboxPanel
              mailboxes={mailboxes}
              selected={selectedMailbox}
              onSelect={(id) => {
                setSelectedMailbox(id);
                setMobilePane("list");
              }}
              onCompose={() => openCompose({ mode: "new" })}
            />
          )}
          {mobilePane === "list" && (
            <>
              {msgsError ? (
                <ErrorBlock>
                  <ErrorMsg>{msgsError}</ErrorMsg>
                  <RetryBtn onClick={fetchMessages}>Retry</RetryBtn>
                </ErrorBlock>
              ) : (
                <MessageList
                  messages={messages}
                  total={totalMessages}
                  loading={loadingMsgs}
                  selected={selectedMessage}
                  onSelect={handleSelectMessage}
                  onAction={handleAction}
                  onLoadMore={fetchMessages}
                />
              )}
            </>
          )}
          {mobilePane === "message" && (
            <MessageView
              email={emailDetail}
              loading={loadingDetail}
              account={selected}
              pinVerified={true}
              showCcBcc={showCcBcc}
              onReply={handleReply}
              onReplyAll={handleReplyAll}
              onForward={handleForward}
              onEditAsNew={handleEditAsNew}
              onSendCopy={handleSendCopy}
              onAction={handleAction}
            />
          )}
        </MobilePane>
        <MobileTabBar>
          <MobileTab $active={mobilePane === "mailboxes"} onClick={() => setMobilePane("mailboxes")}>
            Mailboxes
          </MobileTab>
          <MobileTab $active={mobilePane === "list"} onClick={() => setMobilePane("list")}>
            Messages
          </MobileTab>
          <MobileTab $active={mobilePane === "message"} onClick={() => setMobilePane("message")}>
            Reading
          </MobileTab>
        </MobileTabBar>
        <ComposeFloatBtn onClick={() => openCompose({ mode: "new" })}>
          {"✎"}
        </ComposeFloatBtn>
      </MobileWrap>

      {/* Desktop layout */}
      <DesktopWrap ref={containerRef}>
        {showMailbox && (
          <>
            <MailboxCol style={{ width: mailboxWidth }}>
              {mailboxError ? (
                <ErrorBlock>
                  <ErrorMsg>{mailboxError}</ErrorMsg>
                  <RetryBtn onClick={() => setSelected(selected)}>Retry</RetryBtn>
                </ErrorBlock>
              ) : (
                <MailboxPanel
                  mailboxes={mailboxes}
                  selected={selectedMailbox}
                  onSelect={(id) => {
                    setSelectedMailbox(id);
                    setSelectedMessage(null);
                    setEmailDetail(null);
                  }}
                  onCompose={() => openCompose({ mode: "new" })}
                />
              )}
            </MailboxCol>
            <DragHandle
              direction="vertical"
              onDrag={handleMailboxDrag}
            />
          </>
        )}

        {splitMode === "vertical" || splitMode === "fullList" ? (
          <>
            <ListCol style={{ width: splitMode === "fullList" && !showPreview ? undefined : listWidth, flex: splitMode === "fullList" ? 1 : undefined }}>
              <TopActions>
                <DesktopComposeBtn onClick={() => openCompose({ mode: "new" })}>
                  + Compose
                </DesktopComposeBtn>
                <div style={{ flex: 1 }} />
                <SettingsBtn onClick={() => setShowSettings(true)}>
                  {"⚙"}
                </SettingsBtn>
              </TopActions>
              {msgsError ? (
                <ErrorBlock>
                  <ErrorMsg>{msgsError}</ErrorMsg>
                  <RetryBtn onClick={fetchMessages}>Retry</RetryBtn>
                </ErrorBlock>
              ) : (
                <MessageList
                  messages={messages}
                  total={totalMessages}
                  loading={loadingMsgs}
                  selected={selectedMessage}
                  onSelect={handleSelectMessage}
                  onAction={handleAction}
                  onLoadMore={fetchMessages}
                />
              )}
            </ListCol>
            {showPreview && (
              <>
                <DragHandle
                  direction="vertical"
                  onDrag={handleListDrag}
                />
                <PreviewCol>
                  <MessageView
                    email={emailDetail}
                    loading={loadingDetail}
                    account={selected}
                    pinVerified={true}
                    showCcBcc={showCcBcc}
                    onReply={handleReply}
                    onReplyAll={handleReplyAll}
                    onForward={handleForward}
                    onEditAsNew={handleEditAsNew}
                    onSendCopy={handleSendCopy}
                    onAction={handleAction}
                  />
                </PreviewCol>
              </>
            )}
          </>
        ) : (
          /* horizontal split */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <TopActions>
              <DesktopComposeBtn onClick={() => openCompose({ mode: "new" })}>
                + Compose
              </DesktopComposeBtn>
              <div style={{ flex: 1 }} />
              <SettingsBtn onClick={() => setShowSettings(true)}>
                {"⚙"}
              </SettingsBtn>
            </TopActions>
            <HorizontalTop style={{ height: `${splitRatio * 100}%` }}>
              {msgsError ? (
                <ErrorBlock>
                  <ErrorMsg>{msgsError}</ErrorMsg>
                  <RetryBtn onClick={fetchMessages}>Retry</RetryBtn>
                </ErrorBlock>
              ) : (
                <MessageList
                  messages={messages}
                  total={totalMessages}
                  loading={loadingMsgs}
                  selected={selectedMessage}
                  onSelect={handleSelectMessage}
                  onAction={handleAction}
                  onLoadMore={fetchMessages}
                />
              )}
            </HorizontalTop>
            <DragHandle
              direction="horizontal"
              onDrag={handleSplitDrag}
            />
            <HorizontalBottom>
              <MessageView
                email={emailDetail}
                loading={loadingDetail}
                account={selected}
                pinVerified={true}
                showCcBcc={showCcBcc}
                onReply={handleReply}
                onReplyAll={handleReplyAll}
                onForward={handleForward}
                onEditAsNew={handleEditAsNew}
                onSendCopy={handleSendCopy}
                onAction={handleAction}
              />
            </HorizontalBottom>
          </div>
        )}
      </DesktopWrap>

      {/* Compose modal */}
      {compose && (() => {
        const props = composeProps();
        return props ? <ComposeModal {...props} /> : null;
      })()}

      {/* Settings modal */}
      {showSettings && (
        <EmailSettings
          accounts={accounts}
          onClose={() => setShowSettings(false)}
          onSaved={(s) => {
            setSettings(s);
            setShowSettings(false);
          }}
        />
      )}
    </Root>
  );
}
