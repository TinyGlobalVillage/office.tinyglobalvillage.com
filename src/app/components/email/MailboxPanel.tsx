"use client";

type Mailbox = {
  id: string;
  name: string;
  role: string | null;
  totalEmails: number;
  unreadEmails: number;
  parentId: string | null;
  sortOrder: number;
};

type Props = {
  mailboxes: Mailbox[];
  selected: string | null;
  onSelect: (id: string) => void;
  onCompose: () => void;
};

const ROLE_ICON: Record<string, string> = {
  inbox: "📥",
  sent: "📤",
  drafts: "📝",
  trash: "🗑",
  spam: "🚫",
  archive: "🗃",
  starred: "⭐",
};

const ROLE_ORDER: Record<string, number> = {
  inbox: 0,
  sent: 1,
  drafts: 2,
  archive: 3,
  spam: 4,
  trash: 5,
};

export default function MailboxPanel({ mailboxes, selected, onSelect, onCompose }: Props) {
  const sorted = [...mailboxes].sort((a, b) => {
    const ra = ROLE_ORDER[a.role ?? ""] ?? 10;
    const rb = ROLE_ORDER[b.role ?? ""] ?? 10;
    if (ra !== rb) return ra - rb;
    return a.sortOrder - b.sortOrder;
  });

  // Separate top-level from sub-folders
  const topLevel = sorted.filter((m) => !m.parentId);
  const children = sorted.filter((m) => !!m.parentId);

  const renderMailbox = (m: Mailbox, indent = 0) => {
    const icon = ROLE_ICON[m.role ?? ""] ?? "📁";
    const isSelected = m.id === selected;
    const subs = children.filter((c) => c.parentId === m.id);

    return (
      <div key={m.id}>
        <button
          onClick={() => onSelect(m.id)}
          className="w-full flex items-center gap-2 rounded-lg transition-all text-left"
          style={{
            padding: `5px ${8 + indent * 16}px 5px ${8 + indent * 12}px`,
            background: isSelected ? "rgba(0,191,255,0.12)" : "transparent",
            color: isSelected ? "#00bfff" : "rgba(255,255,255,0.65)",
          }}
        >
          <span className="text-xs flex-shrink-0 w-4 text-center">{icon}</span>
          <span className="flex-1 text-[11px] font-medium truncate">{m.name}</span>
          {m.unreadEmails > 0 && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: "rgba(0,191,255,0.2)", color: "#00bfff" }}
            >
              {m.unreadEmails > 99 ? "99+" : m.unreadEmails}
            </span>
          )}
        </button>
        {subs.map((s) => renderMailbox(s, indent + 1))}
      </div>
    );
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: "rgba(0,0,0,0.2)", borderRight: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Compose button */}
      <div className="p-2 flex-shrink-0">
        <button
          onClick={onCompose}
          className="w-full py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          style={{
            background: "rgba(0,191,255,0.15)",
            border: "1px solid rgba(0,191,255,0.3)",
            color: "#00bfff",
          }}
        >
          <span>✏</span> Compose
        </button>
      </div>

      {/* Mailbox list */}
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {topLevel.length === 0 && (
          <div className="text-center py-8 text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
            Loading…
          </div>
        )}
        {topLevel.map((m) => renderMailbox(m))}
      </div>
    </div>
  );
}
