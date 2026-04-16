"use client";

import { useEffect, useRef, useState } from "react";

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

function formatAddress(addr: { name?: string; email: string }[] | null | undefined): string {
  if (!addr || !addr.length) return "(none)";
  return addr.map((a) => (a?.name ? `${a.name} <${a.email}>` : a?.email ?? "")).filter(Boolean).join(", ");
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Raw message modal ─────────────────────────────────────────────────────────

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
  ].filter((l) => l !== null).join("\n");

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: "min(96vw, 720px)", maxHeight: "80vh",
          background: "rgba(8,10,16,0.99)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
            Raw Message
          </span>
          <button onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.35)" }}>✕</button>
        </div>
        <pre className="flex-1 overflow-y-auto px-4 py-4 text-[11px] font-mono leading-relaxed whitespace-pre-wrap"
          style={{ color: "rgba(255,255,255,0.6)", scrollbarWidth: "thin" }}>
          {raw}
        </pre>
      </div>
    </div>
  );
}

export default function MessageView({
  email, loading, showCcBcc,
  onReply, onReplyAll, onForward, onEditAsNew, onSendCopy, onAction,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewMode, setViewMode] = useState<"html" | "text">("html");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showRawModal, setShowRawModal] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Inject HTML into sandboxed iframe
  useEffect(() => {
    if (!iframeRef.current || !email?.htmlBody) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`
      <!DOCTYPE html><html>
      <head>
        <meta charset="utf-8">
        <base target="_blank">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 13px;
            line-height: 1.6;
            color: #e0e0e0;
            background: transparent;
            margin: 16px;
            padding: 0;
            word-break: break-word;
          }
          a { color: #00bfff; }
          img { max-width: 100%; height: auto; }
          pre, code { background: rgba(255,255,255,0.05); padding: 2px 5px; border-radius: 4px; }
        </style>
      </head>
      <body>${email.htmlBody}</body>
      </html>
    `);
    doc.close();
  }, [email?.htmlBody, email?.id]);

  // Close actions dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset view mode when email changes
  useEffect(() => { setViewMode("html"); }, [email?.id]);

  const handlePrint = () => {
    if (viewMode === "html" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    } else {
      const w = window.open("", "_blank");
      if (w && email) {
        w.document.write(`<html><head><title>${email.subject ?? "Email"}</title></head><body><pre style="font-family:sans-serif;white-space:pre-wrap">${email.textBody ?? email.htmlBody ?? ""}</pre></body></html>`);
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
    ].filter((l) => l !== null).join("\r\n");

    const blob = new Blob([lines], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(email.subject ?? "email").replace(/[^a-z0-9]/gi, "_").slice(0, 60)}.eml`;
    a.click();
    URL.revokeObjectURL(url);
    setActionsOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[12px] animate-pulse" style={{ color: "rgba(255,255,255,0.3)" }}>Loading…</div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center" style={{ color: "rgba(255,255,255,0.15)" }}>
          <div className="text-3xl mb-2">✉</div>
          <div className="text-[11px]">Select an email to read</div>
        </div>
      </div>
    );
  }

  const divider = (
    <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "3px 0" }} />
  );

  type ActionItem = { label: string; icon: string; onClick: () => void; danger?: boolean } | "divider";

  const actionItems: ActionItem[] = [
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
      onClick: () => { setViewMode((v) => v === "text" ? "html" : "text"); setActionsOpen(false); },
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
    { label: "Delete", icon: "🗑", danger: true, onClick: () => { onAction(email.id, "trash"); setActionsOpen(false); } },
  ];

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Subject */}
          <h2 className="text-sm font-semibold leading-snug mb-3" style={{ color: "rgba(255,255,255,0.9)" }}>
            {email.subject ?? "(no subject)"}
          </h2>

          {/* Meta */}
          <div className="flex flex-col gap-1 text-[11px] mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
            <div className="flex items-baseline gap-1">
              <span className="font-semibold flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)", minWidth: 30 }}>From</span>
              <span style={{ color: "rgba(255,255,255,0.7)" }}>{formatAddress(email.from)}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-semibold flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)", minWidth: 30 }}>To</span>
              <span style={{ color: "rgba(255,255,255,0.5)" }}>{formatAddress(email.to)}</span>
            </div>
            {showCcBcc && email.cc.length > 0 && (
              <div className="flex items-baseline gap-1">
                <span className="font-semibold flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)", minWidth: 30 }}>Cc</span>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>{formatAddress(email.cc)}</span>
              </div>
            )}
            <div className="flex items-baseline gap-1">
              <span className="font-semibold flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)", minWidth: 30 }}>Date</span>
              <span>{formatDate(email.receivedAt)}</span>
            </div>
          </div>

          {/* Attachments */}
          {email.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {email.attachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  📎 {att.name} <span style={{ color: "rgba(255,255,255,0.25)" }}>({humanSize(att.size)})</span>
                </div>
              ))}
            </div>
          )}

          {/* Action bar: Reply + Actions dropdown */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onReply(email)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:bg-white/10"
              style={{
                background: "rgba(0,191,255,0.1)",
                border: "1px solid rgba(0,191,255,0.25)",
                color: "#00bfff",
              }}
            >
              ↩ Reply
            </button>

            {/* Actions dropdown */}
            <div ref={actionsRef} className="relative">
              <button
                onClick={() => setActionsOpen((p) => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:bg-white/10"
                style={{
                  background: actionsOpen ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                Actions
                <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor"
                  style={{ transform: actionsOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                  <path d="M4 6L0.5 1.5h7L4 6z" />
                </svg>
              </button>

              {actionsOpen && (
                <div
                  className="absolute top-full left-0 mt-1 rounded-xl overflow-hidden z-50"
                  style={{
                    minWidth: 200,
                    background: "rgba(8,10,16,0.99)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 12px 48px rgba(0,0,0,0.8)",
                  }}
                >
                  {actionItems.map((item, i) => {
                    if (item === "divider") return divider;
                    return (
                      <button
                        key={i}
                        onClick={item.onClick}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-left transition-colors hover:bg-white/6"
                        style={{ color: item.danger ? "rgba(255,100,100,0.8)" : "rgba(255,255,255,0.65)" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = item.danger
                            ? "rgba(255,100,100,0.08)"
                            : "rgba(255,255,255,0.06)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                        }}
                      >
                        <span className="w-4 text-center flex-shrink-0 text-[10px]" style={{ color: item.danger ? "rgba(255,100,100,0.6)" : "rgba(255,255,255,0.3)" }}>
                          {item.icon}
                        </span>
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {viewMode === "text" || !email.htmlBody ? (
            <div className="h-full overflow-y-auto px-4 py-3">
              <pre
                className="text-[11px] whitespace-pre-wrap font-mono leading-relaxed"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                {email.textBody ?? "(no text body)"}
              </pre>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              className="w-full h-full"
              style={{ border: "none", background: "transparent" }}
              title="Email body"
            />
          )}
        </div>
      </div>

      {/* Raw message modal */}
      {showRawModal && (
        <RawMessageModal email={email} onClose={() => setShowRawModal(false)} />
      )}
    </>
  );
}
