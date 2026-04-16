"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AccountSwitcher, { type AccountMeta } from "./AccountSwitcher";
import MailboxPanel from "./MailboxPanel";
import MessageList from "./MessageList";
import MessageView from "./MessageView";
import ComposeModal from "./ComposeModal";
import EmailSettings from "./EmailSettings";

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

function replySubject(subject: string | null): string {
  if (!subject) return "Re: ";
  return subject.startsWith("Re:") ? subject : `Re: ${subject}`;
}

function forwardSubject(subject: string | null): string {
  if (!subject) return "Fwd: ";
  return subject.startsWith("Fwd:") ? subject : `Fwd: ${subject}`;
}

function quoteEmail(email: EmailDetail): string {
  const from = email.from.map((a) => a.name ? `${a.name} <${a.email}>` : a.email).join(", ");
  const date = new Date(email.receivedAt).toLocaleString();
  const body = email.textBody ?? "(no text body)";
  return `\n\n--- Original message from ${from} on ${date} ---\n${body}`;
}

export default function EmailClient({ zoom }: Props) {
  // Account state
  const [accounts, setAccounts] = useState<AccountMeta[]>([]);
  const [selected, setSelected] = useState<string>("admin");

  // Mail state
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

  // UI state
  const [compose, setCompose] = useState<ComposeMode | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);

  // Mobile nav state: which panel is active on small screens
  const [mobilePane, setMobilePane] = useState<"mailboxes" | "list" | "message">("list");

  // ── Load accounts list + set default selection for this user ─────────────
  useEffect(() => {
    Promise.all([
      fetch("/api/email/session").then((r) => r.json()).catch(() => ({ accounts: [] })),
      fetch("/api/users/me").then((r) => r.json()).catch(() => null),
    ]).then(([d, meRes]) => {
      const accs: AccountMeta[] = d.accounts ?? [];
      setAccounts(accs);
      // Default to the user's own personal inbox (server only returns personal
      // accounts belonging to the logged-in user), fall back to admin shared inbox.
      const ownPersonal = accs.find((a) => a.personal);
      const fallback = accs.find((a) => a.key === "admin") ?? accs[0];
      setSelected((ownPersonal ?? fallback)?.key ?? "admin");
    });
  }, []);

  // ── Load settings ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/email/settings")
      .then((r) => r.json())
      .then((d: Settings) => {
        if (d?.sections && d?.display) setSettings(d);
      })
      .catch(() => {});
  }, []);

  // ── Account selection ─────────────────────────────────────────────────────
  // No PIN gate needed — personal inbox access is gated server-side via the
  // tgv-2fa cookie that the proxy already enforces. The correct user's 2FA
  // session automatically unlocks their own inbox; the other user's cookie
  // won't satisfy the server's owner check.
  const handleSelectAccount = (key: string) => {
    setSelected(key);
    setMailboxes([]);
    setSelectedMailbox(null);
    setMessages([]);
    setTotalMessages(0);
    setSelectedMessage(null);
    setEmailDetail(null);
    setMailboxError(null);
  };

  // ── Load mailboxes ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selected) return;

    setMailboxError(null);
    fetch(`/api/email/mailboxes?account=${selected}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
        return d as { mailboxes: Mailbox[] };
      })
      .then((d) => {
        setMailboxes(d.mailboxes ?? []);
        const inbox = d.mailboxes?.find((m) => m.role === "inbox");
        if (inbox) setSelectedMailbox(inbox.id);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setMailboxError(msg);
        console.error("[EmailClient] mailboxes fetch failed:", msg);
      });
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load messages ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedMailbox || !selected) return;

    setLoadingMsgs(true);
    setMessages([]);
    setMsgsError(null);

    fetch(`/api/email/messages?account=${selected}&mailboxId=${selectedMailbox}&limit=30`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
        return d as { emails: EmailSummary[]; total: number };
      })
      .then((d) => {
        setMessages(d.emails ?? []);
        setTotalMessages(d.total ?? 0);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setMsgsError(msg);
        console.error("[EmailClient] messages fetch failed:", msg);
      })
      .finally(() => setLoadingMsgs(false));
  }, [selectedMailbox, selected]);

  // ── Load more ─────────────────────────────────────────────────────────────
  const loadMore = () => {
    if (!selectedMailbox || !selected || loadingMsgs) return;
    setLoadingMsgs(true);

    fetch(`/api/email/messages?account=${selected}&mailboxId=${selectedMailbox}&limit=30&position=${messages.length}`)
      .then((r) => r.json())
      .then((d: { emails: EmailSummary[]; total: number }) => {
        setMessages((prev) => [...prev, ...(d.emails ?? [])]);
        setTotalMessages(d.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));
  };

  // ── Load email detail ─────────────────────────────────────────────────────
  const selectMessage = useCallback((id: string) => {
    setMobilePane("message");
    setSelectedMessage(id);
    setEmailDetail(null);
    setLoadingDetail(true);

    fetch(`/api/email/messages?account=${selected}&id=${id}`)
      .then((r) => r.json())
      .then((d: { email: EmailDetail }) => {
        setEmailDetail(d.email ?? null);
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, unread: false } : m))
        );
      })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [selected]);

  // ── Message actions ───────────────────────────────────────────────────────
  const handleAction = useCallback(
    async (id: string, action: "markRead" | "markUnread" | "flag" | "unflag" | "trash") => {
      await fetch("/api/email/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: selected, action, emailId: id }),
      }).catch(() => {});

      setMessages((prev) =>
        prev
          .map((m) => {
            if (m.id !== id) return m;
            if (action === "markRead") return { ...m, unread: false };
            if (action === "markUnread") return { ...m, unread: true };
            if (action === "flag") return { ...m, flagged: true };
            if (action === "unflag") return { ...m, flagged: false };
            return m;
          })
          .filter((m) => !(action === "trash" && m.id === id))
      );

      if (action === "trash" && selectedMessage === id) {
        setSelectedMessage(null);
        setEmailDetail(null);
      }
    },
    [selected, selectedMessage]
  );

  // ── Settings save ─────────────────────────────────────────────────────────
  const handleSettingsSaved = (s: Settings) => {
    setSettings(s);
    setShowSettings(false);
  };

  const currentAccount = accounts.find((a) => a.key === selected);
  const splitMode = settings?.display?.splitMode ?? "vertical";
  const showMailboxPanel = settings?.sections?.mailboxPanel ?? true;
  const showPreviewPane = settings?.sections?.previewPane ?? true;
  const showCcBcc = settings?.sections?.ccBcc ?? false;

  // ── Panel widths (draggable) ───────────────────────────────────────────────
  const [mailboxW, setMailboxW] = useState(160);
  const [msgListW, setMsgListW] = useState(260);
  const [msgListH, setMsgListH] = useState(45); // % for horizontal split
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback(
    (
      e: React.MouseEvent,
      setter: (v: number) => void,
      axis: "x" | "y",
      min: number,
      max: number,
      current: number
    ) => {
      e.preventDefault();
      const origin = axis === "x" ? e.clientX : e.clientY;
      const startVal = current;

      const onMove = (ev: MouseEvent) => {
        const delta = (axis === "x" ? ev.clientX : ev.clientY) - origin;
        setter(Math.min(max, Math.max(min, startVal + delta)));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    []
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ fontSize: `${zoom}em` }}>
      {/* Account switcher bar */}
      <AccountSwitcher
        accounts={accounts}
        selected={selected}
        onSelect={handleSelectAccount}
        onSettings={() => setShowSettings(true)}
      />

      {/* ── Mobile layout (< sm) ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden sm:hidden">
        {/* Active mobile pane */}
        <div className="flex-1 overflow-hidden">
          {mobilePane === "mailboxes" && (
            mailboxError ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
                <div className="text-[10px] text-center" style={{ color: "rgba(255,100,100,0.8)" }}>{mailboxError}</div>
                <button onClick={() => { setMailboxError(null); setMailboxes([]); setSelectedMailbox(null); }}
                  className="text-[10px] px-3 py-1 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>Retry</button>
              </div>
            ) : (
              <MailboxPanel
                mailboxes={mailboxes}
                selected={selectedMailbox}
                onSelect={(id) => { setSelectedMailbox(id); setSelectedMessage(null); setEmailDetail(null); setMobilePane("list"); }}
                onCompose={() => setCompose({ mode: "new" })}
              />
            )
          )}
          {mobilePane === "list" && (
            msgsError ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
                <div className="text-[10px] text-center font-mono" style={{ color: "rgba(255,100,100,0.8)" }}>{msgsError}</div>
                <button onClick={() => { setMsgsError(null); setMessages([]); }}
                  className="text-[10px] px-3 py-1 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>Retry</button>
              </div>
            ) : (
              <MessageList
                messages={messages}
                selected={selectedMessage}
                total={totalMessages}
                loading={loadingMsgs}
                onSelect={selectMessage}
                onLoadMore={loadMore}
                onAction={handleAction}
              />
            )
          )}
          {mobilePane === "message" && (
            <MessageView
              email={emailDetail}
              loading={loadingDetail}
              account={selected}
              pinVerified={true}
              showCcBcc={showCcBcc}
              onReply={(e) => setCompose({ mode: "reply", email: e })}
              onReplyAll={(e) => setCompose({ mode: "replyAll", email: e })}
              onForward={(e) => setCompose({ mode: "forward", email: e })}
              onEditAsNew={(e) => setCompose({ mode: "editAsNew", email: e })}
              onSendCopy={(e) => setCompose({ mode: "sendCopy", email: e })}
              onAction={handleAction}
            />
          )}
        </div>

        {/* Mobile bottom tab bar */}
        <div
          className="flex-shrink-0 flex border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(8,11,16,0.98)" }}
        >
          {[
            { key: "mailboxes", label: "Folders", icon: "📂" },
            { key: "list", label: "Inbox", icon: "📋" },
            { key: "message", label: "Message", icon: "✉️" },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setMobilePane(key as typeof mobilePane)}
              className="flex-1 flex flex-col items-center py-2 gap-0.5 transition-all"
              style={{
                color: mobilePane === key ? "#ff4ecb" : "rgba(255,255,255,0.3)",
                fontSize: 10,
              }}
            >
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
          <button
            onClick={() => setCompose({ mode: "new" })}
            className="flex-1 flex flex-col items-center py-2 gap-0.5 transition-all"
            style={{ color: "rgba(0,191,255,0.7)", fontSize: 10 }}
          >
            <span style={{ fontSize: 18 }}>✏️</span>
            <span>Compose</span>
          </button>
        </div>
      </div>

      {/* ── Desktop layout (≥ sm) ─────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className={`hidden sm:flex flex-1 overflow-hidden relative ${splitMode === "horizontal" ? "flex-col" : "flex-row"}`}
      >
        {/* Mailbox panel */}
        {showMailboxPanel && splitMode !== "horizontal" && (
          <>
            <div className="flex-shrink-0 overflow-hidden" style={{ width: mailboxW }}>
              {mailboxError ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-3">
                  <div className="text-[10px] text-center" style={{ color: "rgba(255,100,100,0.8)" }}>
                    {mailboxError}
                  </div>
                  <button
                    onClick={() => { setMailboxError(null); setMailboxes([]); setSelectedMailbox(null); }}
                    className="text-[10px] px-3 py-1 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <MailboxPanel
                  mailboxes={mailboxes}
                  selected={selectedMailbox}
                  onSelect={(id) => {
                    setSelectedMailbox(id);
                    setSelectedMessage(null);
                    setEmailDetail(null);
                  }}
                  onCompose={() => setCompose({ mode: "new" })}
                />
              )}
            </div>
            {/* Mailbox ↔ list drag handle */}
            <DragHandle
              axis="x"
              onMouseDown={(e) => startDrag(e, setMailboxW, "x", 100, 320, mailboxW)}
            />
          </>
        )}

        {/* Mailbox panel (horizontal mode — above everything) */}
        {showMailboxPanel && splitMode === "horizontal" && (
          <div className="flex-shrink-0 overflow-x-auto overflow-y-hidden flex flex-row" style={{ height: 48 }}>
            {mailboxError ? (
              <div className="flex items-center gap-2 px-4">
                <span className="text-[10px]" style={{ color: "rgba(255,100,100,0.8)" }}>{mailboxError}</span>
                <button
                  onClick={() => { setMailboxError(null); setMailboxes([]); setSelectedMailbox(null); }}
                  className="text-[10px] px-2 py-0.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <MailboxPanel
                mailboxes={mailboxes}
                selected={selectedMailbox}
                onSelect={(id) => { setSelectedMailbox(id); setSelectedMessage(null); setEmailDetail(null); }}
                onCompose={() => setCompose({ mode: "new" })}
              />
            )}
          </div>
        )}

        {/* Message list */}
        {(splitMode !== "fullList" || !selectedMessage) && (
          <>
            <div
              className="flex-shrink-0 overflow-hidden"
              style={
                splitMode === "fullList"
                  ? { flex: 1 }
                  : splitMode === "vertical"
                  ? { width: msgListW, borderRight: "1px solid rgba(255,255,255,0.06)" }
                  : { height: `${msgListH}%`, borderBottom: "1px solid rgba(255,255,255,0.06)" }
              }
            >
              {msgsError ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
                  <div className="text-[10px] text-center font-mono" style={{ color: "rgba(255,100,100,0.8)" }}>
                    {msgsError}
                  </div>
                  <button
                    onClick={() => { setMsgsError(null); setMessages([]); }}
                    className="text-[10px] px-3 py-1 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <MessageList
                  messages={messages}
                  selected={selectedMessage}
                  total={totalMessages}
                  loading={loadingMsgs}
                  onSelect={selectMessage}
                  onLoadMore={loadMore}
                  onAction={handleAction}
                />
              )}
            </div>

            {/* List ↔ reading pane drag handle */}
            {showPreviewPane && selectedMessage && splitMode !== "fullList" && (
              <DragHandle
                axis={splitMode === "vertical" ? "x" : "y"}
                onMouseDown={(e) =>
                  splitMode === "vertical"
                    ? startDrag(e, setMsgListW, "x", 160, 500, msgListW)
                    : startDrag(e, setMsgListH, "y", 20, 75, msgListH)
                }
              />
            )}
          </>
        )}

        {/* Reading pane */}
        {showPreviewPane && (splitMode === "vertical" || splitMode === "horizontal") && (
          <div
            className="flex-1 overflow-hidden"
            style={splitMode === "horizontal" && selectedMessage ? { height: `${100 - msgListH}%` } : {}}
          >
            <MessageView
              email={emailDetail}
              loading={loadingDetail}
              account={selected}
              pinVerified={true}
              showCcBcc={showCcBcc}
              onReply={(e) => setCompose({ mode: "reply", email: e })}
              onReplyAll={(e) => setCompose({ mode: "replyAll", email: e })}
              onForward={(e) => setCompose({ mode: "forward", email: e })}
              onEditAsNew={(e) => setCompose({ mode: "editAsNew", email: e })}
              onSendCopy={(e) => setCompose({ mode: "sendCopy", email: e })}
              onAction={handleAction}
            />
          </div>
        )}
      </div>

      {/* Compose modal */}
      {compose && currentAccount && (() => {
        const defaultAccKey = compose.mode === "new"
          ? (settings?.display?.defaultAccount ?? selected)
          : selected;
        const composeFromAccount = accounts.find((a) => a.key === defaultAccKey) ?? currentAccount;
        return (
        <ComposeModal
          fromEmail={composeFromAccount.email}
          fromLabel={composeFromAccount.label}
          account={defaultAccKey}
          accounts={accounts}
          pinVerified={true}
          initialTo={
            compose.mode === "reply"
              ? compose.email?.from ?? []
              : compose.mode === "replyAll"
              ? [...(compose.email?.from ?? []), ...(compose.email?.to ?? [])]
              : compose.mode === "editAsNew"
              ? compose.email?.to ?? []
              : compose.mode === "sendCopy"
              ? compose.email?.to ?? []
              : []
          }
          initialSubject={
            compose.mode === "reply" || compose.mode === "replyAll"
              ? replySubject(compose.email?.subject ?? null)
              : compose.mode === "forward"
              ? forwardSubject(compose.email?.subject ?? null)
              : compose.mode === "editAsNew" || compose.mode === "sendCopy"
              ? compose.email?.subject ?? ""
              : ""
          }
          initialBody={
            compose.mode === "reply" || compose.mode === "replyAll" || compose.mode === "forward"
              ? (compose.email ? quoteEmail(compose.email) : "")
              : compose.mode === "editAsNew" || compose.mode === "sendCopy"
              ? (compose.email?.textBody ?? "")
              : ""
          }
          initialCc={
            compose.mode === "replyAll" ? compose.email?.cc ?? []
            : compose.mode === "editAsNew" || compose.mode === "sendCopy" ? compose.email?.cc ?? []
            : []
          }
          inReplyTo={
            compose.mode === "reply" || compose.mode === "replyAll"
              ? compose.email?.messageId?.[0]
              : undefined
          }
          references={
            compose.mode === "reply" || compose.mode === "replyAll"
              ? compose.email?.messageId
              : undefined
          }
          onClose={() => setCompose(null)}
          onSent={() => {
            if (selectedMailbox) {
              fetch(`/api/email/messages?account=${selected}&mailboxId=${selectedMailbox}&limit=30`)
                .then((r) => r.json())
                .then((d: { emails: EmailSummary[]; total: number }) => {
                  setMessages(d.emails ?? []);
                  setTotalMessages(d.total ?? 0);
                })
                .catch(() => {});
            }
          }}
        />
        );
      })()}

      {/* Settings modal */}
      {showSettings && (
        <EmailSettings
          accounts={accounts}
          onClose={() => setShowSettings(false)}
          onSaved={handleSettingsSaved}
        />
      )}
    </div>
  );
}

// ── Drag handle ───────────────────────────────────────────────────────────────
function DragHandle({
  axis,
  onMouseDown,
}: {
  axis: "x" | "y";
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  const isX = axis === "x";

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flexShrink: 0,
        width: isX ? 5 : "100%",
        height: isX ? "100%" : 5,
        cursor: isX ? "col-resize" : "row-resize",
        background: hover ? "rgba(0,191,255,0.18)" : "transparent",
        transition: "background 0.15s",
        zIndex: 10,
        position: "relative",
      }}
    >
      {/* visual line */}
      <div
        style={{
          position: "absolute",
          ...(isX
            ? { top: 0, bottom: 0, left: 2, width: 1 }
            : { left: 0, right: 0, top: 2, height: 1 }),
          background: hover ? "rgba(0,191,255,0.5)" : "rgba(255,255,255,0.05)",
          transition: "background 0.15s",
        }}
      />
    </div>
  );
}
