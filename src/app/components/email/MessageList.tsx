"use client";

type EmailSummary = {
  id: string;
  subject: string | null;
  from: { name?: string; email: string }[] | null;
  receivedAt: string | null;
  preview: string | null;
  unread: boolean;
  flagged: boolean;
  hasAttachment: boolean;
};

type Props = {
  messages: EmailSummary[];
  selected: string | null;
  total: number;
  loading: boolean;
  onSelect: (id: string) => void;
  onLoadMore: () => void;
  onAction: (id: string, action: "markRead" | "markUnread" | "flag" | "unflag" | "trash") => void;
};

function fromLabel(from: { name?: string; email: string }[] | null | undefined): string {
  if (!from || !from.length) return "(no sender)";
  const f = from[0];
  return f?.name || f?.email || "(no sender)";
}

function relativeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = diff / 60000;
  const hours = mins / 60;
  const days = hours / 24;

  if (mins < 1) return "just now";
  if (mins < 60) return `${Math.floor(mins)}m`;
  if (hours < 24) return `${Math.floor(hours)}h`;
  if (days < 7) return `${Math.floor(days)}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MessageList({
  messages, selected, total, loading, onSelect, onLoadMore, onAction,
}: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 flex-shrink-0 text-[10px]"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}
      >
        <span>{messages.length} of {total}</span>
        {loading && <span className="animate-pulse">loading…</span>}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !loading && (
          <div className="flex items-center justify-center h-24 text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
            No messages
          </div>
        )}

        {messages.map((msg) => (
          <button
            key={msg.id}
            onClick={() => onSelect(msg.id)}
            className="w-full text-left transition-all group"
            style={{
              background: selected === msg.id ? "rgba(0,191,255,0.08)" : "transparent",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              borderLeft: `2px solid ${selected === msg.id ? "#00bfff" : "transparent"}`,
            }}
          >
            <div className="flex items-start gap-2 px-3 py-2.5">
              {/* Unread dot */}
              <div className="flex-shrink-0 mt-1.5">
                {msg.unread
                  ? <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#00bfff" }} />
                  : <div className="w-1.5 h-1.5 rounded-full" style={{ background: "transparent" }} />
                }
              </div>

              <div className="flex-1 min-w-0">
                {/* From + date row */}
                <div className="flex items-baseline justify-between gap-1 mb-0.5">
                  <span
                    className="text-[11px] truncate"
                    style={{
                      fontWeight: msg.unread ? 700 : 400,
                      color: msg.unread ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)",
                    }}
                  >
                    {fromLabel(msg.from)}
                  </span>
                  <span className="text-[9px] flex-shrink-0 ml-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {relativeDate(msg.receivedAt)}
                  </span>
                </div>

                {/* Subject */}
                <div
                  className="text-[11px] truncate mb-0.5"
                  style={{
                    fontWeight: msg.unread ? 600 : 400,
                    color: msg.unread ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {msg.subject ?? "(no subject)"}
                </div>

                {/* Preview + icons */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] truncate flex-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                    {msg.preview}
                  </span>
                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {msg.hasAttachment && <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>📎</span>}
                    {msg.flagged && <span className="text-[9px]">⭐</span>}
                    {/* Quick actions */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onAction(msg.id, msg.unread ? "markRead" : "markUnread"); }}
                      title={msg.unread ? "Mark read" : "Mark unread"}
                      className="px-1 text-[9px] rounded transition-all hover:bg-white/10"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                    >
                      {msg.unread ? "✓" : "●"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onAction(msg.id, msg.flagged ? "unflag" : "flag"); }}
                      title={msg.flagged ? "Unflag" : "Flag"}
                      className="px-1 text-[9px] rounded transition-all hover:bg-white/10"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                    >
                      {msg.flagged ? "★" : "☆"}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onAction(msg.id, "trash"); }}
                      title="Move to trash"
                      className="px-1 text-[9px] rounded transition-all hover:bg-white/10"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </button>
        ))}

        {/* Load more */}
        {messages.length < total && (
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="w-full py-3 text-[11px] font-semibold transition-all hover:bg-white/5 disabled:opacity-40"
            style={{ color: "rgba(0,191,255,0.6)" }}
          >
            {loading ? "Loading…" : `Load more (${total - messages.length} remaining)`}
          </button>
        )}
      </div>
    </div>
  );
}
