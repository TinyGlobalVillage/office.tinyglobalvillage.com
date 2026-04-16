"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import ChatSettingsModal, { UserAvatar, type MemberProfile, type ChatSettings as ModalChatSettings } from "./ChatSettingsModal";

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  from: string;
  content: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  createdAt: string;
  editedAt?: string;
};

type DmMessage = {
  id: string;
  from: string;
  to: string;
  content: string;
  createdAt: string;
  editedAt?: string;
};

type Profile = MemberProfile;
type ChatSettings = ModalChatSettings;

type DrawerMode =
  | { view: "chat" }
  | { view: "members" }
  | { view: "dm"; peer: Profile };

const DEFAULT_SETTINGS: ChatSettings = {
  showTimestamps: true,
  timestampFormat: "time",
  fontSize: "sm",
  myFont: "sans",
};

const SETTINGS_KEY    = "tgv_chat_settings";
const TAB_STORAGE_KEY = "tgv-drawer-tab-chat-y";
const DRAWER_EVENT    = "tgv-right-drawer";
const DEFAULT_W       = 380;
const MIN_W           = 300;
const MAX_W           = 700;
const PAGE_SIZES      = [5, 10, 25, 50];

const VIOLET = "#a259ff";

function getDefaultTabY() {
  if (typeof window === "undefined") return 480;
  return Math.round(window.innerHeight * 0.5) + 50;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function fmtTimestamp(iso: string, format: ChatSettings["timestampFormat"]): string {
  const d = new Date(iso);
  if (format === "relative") {
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
  if (format === "time") return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function isImage(mime?: string) { return mime?.startsWith("image/") ?? false; }

function hexToRgb(hex: string): string {
  const c = hex.replace("#", "");
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}

function loadSettings(): ChatSettings {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(SETTINGS_KEY) : null;
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

// ── File attachment ────────────────────────────────────────────────────────────

function FileAttachment({ url, name, size, mime }: { url: string; name?: string; size?: number; mime?: string }) {
  if (isImage(mime)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mt-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name ?? "image"} className="max-w-[180px] max-h-[140px] rounded-xl object-cover"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" download={name}
      className="flex items-center gap-2 mt-1.5 rounded-xl px-3 py-2 transition-all"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", textDecoration: "none" }}>
      <span className="text-base shrink-0">
        {mime?.startsWith("video/") ? "🎥" : mime?.startsWith("audio/") ? "🎵" : "📎"}
      </span>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] text-white/70 truncate max-w-[140px]">{name ?? "file"}</span>
        {size && <span className="text-[9px] text-white/30">{fmtBytes(size)}</span>}
      </div>
      <span className="text-[9px] text-white/30 shrink-0 ml-auto">↓</span>
    </a>
  );
}

// ── Message bubble (shared by chat + DM) ─────────────────────────────────────

function MessageBubble({
  id, from, content, fileUrl, fileName, fileSize, fileMime, createdAt, editedAt,
  profile, isMe, settings, canDelete,
  onDelete, onEdit,
}: {
  id: string; from: string; content: string;
  fileUrl?: string; fileName?: string; fileSize?: number; fileMime?: string;
  createdAt: string; editedAt?: string;
  profile?: Profile; isMe: boolean;
  settings: ChatSettings; canDelete: boolean;
  onDelete: () => void; onEdit: (content: string) => void;
}) {
  const accent = profile?.accentColor ?? "#ff4ecb";
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(content);

  const fontClass = { sans: "font-sans", mono: "font-mono", serif: "font-serif" }[settings.myFont] ?? "font-sans";
  const sizeClass = { xs: "text-xs", sm: "text-sm", base: "text-base" }[settings.fontSize] ?? "text-sm";

  const saveEdit = () => {
    if (editVal.trim()) onEdit(editVal.trim());
    setEditing(false);
  };

  return (
    <div className={`flex gap-2 group ${isMe ? "flex-row-reverse" : "flex-row"}`}>
      <UserAvatar
        profile={profile ?? { displayName: from, accentColor: "#ff4ecb", avatarUrl: "" }}
        size={28}
      />
      <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
        <div className={`flex items-baseline gap-2 mb-0.5 ${isMe ? "flex-row-reverse" : ""}`}>
          <span className="text-[10px] font-bold" style={{ color: accent }}>
            {isMe ? "You" : (profile?.displayName ?? from)}
          </span>
          {settings.showTimestamps && (
            <span className="text-[9px] text-white/25">
              {fmtTimestamp(createdAt, settings.timestampFormat)}
              {editedAt && " · edited"}
            </span>
          )}
        </div>
        <div className={`relative rounded-2xl px-3 py-2 ${fontClass} ${sizeClass}`}
          style={{
            background: isMe ? `rgba(${hexToRgb(accent)},0.18)` : "rgba(255,255,255,0.06)",
            border: isMe ? `1px solid ${accent}44` : "1px solid rgba(255,255,255,0.08)",
            color: isMe ? "#fff" : "rgba(255,255,255,0.8)",
            borderRadius: isMe ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
          }}>
          {editing ? (
            <div className="flex gap-2">
              <input value={editVal} onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="flex-1 bg-transparent outline-none" autoFocus />
              <button onClick={saveEdit} className="text-[9px] text-white/60 hover:text-white">Save</button>
              <button onClick={() => setEditing(false)} className="text-[9px] text-white/30">✕</button>
            </div>
          ) : (
            <>
              {content && <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</p>}
              {fileUrl && <FileAttachment url={fileUrl} name={fileName} size={fileSize} mime={fileMime} />}
            </>
          )}
          {!editing && (
            <div className={`absolute top-0 ${isMe ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"} flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity`}>
              {isMe && (
                <button onClick={() => { setEditing(true); setEditVal(content); }}
                  className="text-[9px] text-white/30 hover:text-white/70 px-1" title="Edit">✎</button>
              )}
              {canDelete && (
                <button onClick={onDelete}
                  className="text-[9px] text-white/30 hover:text-red-400 px-1" title="Delete">✕</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Members panel ─────────────────────────────────────────────────────────────

function MembersPanel({
  profiles,
  presence,
  currentUser,
  onSelectUser,
}: {
  profiles: Profile[];
  presence: { sysUser: string; online: boolean }[];
  currentUser: string;
  onSelectUser: (p: Profile) => void;
}) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [customSize, setCustomSize] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [page, setPage] = useState(0);

  const filtered = profiles.filter((p) =>
    p.displayName.toLowerCase().includes(search.toLowerCase()) ||
    p.username.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const setSize = (n: number) => {
    setPageSize(n);
    setPage(0);
    setShowCustom(false);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Search */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="4.5" cy="4.5" r="3.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>
            <path d="M7.5 7.5l2 2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search members…"
            className="flex-1 bg-transparent outline-none text-[11px] text-white/70"
          />
          {search && (
            <button onClick={() => { setSearch(""); setPage(0); }} className="text-[9px] text-white/30 hover:text-white/60">✕</button>
          )}
        </div>
      </div>

      {/* Per-page + count */}
      <div className="px-3 pb-2 flex items-center justify-between flex-shrink-0">
        <span className="text-[9px] text-white/30">{filtered.length} member{filtered.length !== 1 ? "s" : ""}</span>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-white/25">Show:</span>
          <div className="flex items-center gap-0.5">
            {PAGE_SIZES.map((n) => (
              <button
                key={n}
                onClick={() => setSize(n)}
                className="text-[9px] px-1.5 py-0.5 rounded transition-all"
                style={{
                  background: pageSize === n && !showCustom ? `${VIOLET}22` : "transparent",
                  color: pageSize === n && !showCustom ? VIOLET : "rgba(255,255,255,0.3)",
                  border: pageSize === n && !showCustom ? `1px solid ${VIOLET}44` : "1px solid transparent",
                }}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setShowCustom((p) => !p)}
              className="text-[9px] px-1.5 py-0.5 rounded transition-all"
              style={{
                background: showCustom ? `${VIOLET}22` : "transparent",
                color: showCustom ? VIOLET : "rgba(255,255,255,0.3)",
                border: showCustom ? `1px solid ${VIOLET}44` : "1px solid transparent",
              }}
            >
              Custom
            </button>
          </div>
          {showCustom && (
            <input
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const n = parseInt(customSize, 10);
                  if (n > 0) setSize(n);
                }
              }}
              placeholder="n"
              className="w-10 text-[9px] bg-transparent outline-none text-center rounded px-1 py-0.5"
              style={{ border: `1px solid ${VIOLET}44`, color: VIOLET }}
              autoFocus
            />
          )}
        </div>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-1" style={{ scrollbarWidth: "thin" }}>
        {paged.length === 0 ? (
          <p className="text-[11px] text-white/25 text-center py-8">No members found</p>
        ) : (
          paged.map((p) => {
            const pres = presence.find((pr) => pr.sysUser === p.username);
            const online = pres?.online ?? false;
            const isMe = p.username === currentUser;
            return (
              <button
                key={p.username}
                onClick={() => !isMe && onSelectUser(p)}
                disabled={isMe}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all text-left w-full group"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  cursor: isMe ? "default" : "pointer",
                  opacity: isMe ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isMe) (e.currentTarget as HTMLElement).style.background = `rgba(${hexToRgb(p.accentColor)},0.1)`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                }}
              >
                <div className="relative shrink-0">
                  <UserAvatar profile={p} size={32} />
                  <span
                    className="absolute bottom-0 right-0 w-2 h-2 rounded-full border"
                    style={{ background: online ? "#4ade80" : "#374151", borderColor: "#060810", boxShadow: online ? "0 0 4px #4ade80" : "none" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white leading-tight">{p.displayName}</p>
                  <p className="text-[9px]" style={{ color: online ? "#4ade8099" : "rgba(255,255,255,0.25)" }}>
                    {online ? "● Online" : "○ Offline"}
                  </p>
                </div>
                {!isMe && (
                  <span className="text-[9px] text-white/20 group-hover:text-white/50 shrink-0 transition-colors">
                    DM →
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 px-3 py-2 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="w-6 h-6 rounded flex items-center justify-center text-[10px] disabled:opacity-30 transition-all"
            style={{ color: VIOLET }}
          >‹</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const pageNum = totalPages <= 7 ? i : i; // simplify for now
            return (
              <button
                key={i}
                onClick={() => setPage(i)}
                className="w-6 h-6 rounded text-[10px] transition-all"
                style={{
                  background: safePage === i ? `${VIOLET}25` : "transparent",
                  color: safePage === i ? VIOLET : "rgba(255,255,255,0.3)",
                  border: safePage === i ? `1px solid ${VIOLET}44` : "1px solid transparent",
                }}
              >
                {i + 1}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage === totalPages - 1}
            className="w-6 h-6 rounded flex items-center justify-center text-[10px] disabled:opacity-30 transition-all"
            style={{ color: VIOLET }}
          >›</button>
        </div>
      )}
    </div>
  );
}

// ── Main ChatDrawer ───────────────────────────────────────────────────────────

export default function ChatDrawer() {
  const [open, setOpen]           = useState(false);
  const [width, setWidth]         = useState(DEFAULT_W);
  const [tabY, setTabY]           = useState<number>(480);
  const [mode, setMode]           = useState<DrawerMode>({ view: "chat" });

  // Chat state
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [profiles, setProfiles]   = useState<Profile[]>([]);
  const [presence, setPresence]   = useState<{ sysUser: string; online: boolean }[]>([]);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [input, setInput]         = useState("");
  const [sending, setSending]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [storagePercent, setStoragePercent] = useState(0);
  const [unread, setUnread]       = useState(0);
  const [settings, setSettings]   = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // DM state
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([]);
  const [dmInput, setDmInput]     = useState("");
  const [dmSending, setDmSending] = useState(false);

  // Typing indicator state
  const [typers, setTypers]       = useState<string[]>([]);
  const lastTypingSentRef         = useRef(0);

  const fileRef     = useRef<HTMLInputElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const dmBottomRef = useRef<HTMLDivElement>(null);
  const seenCount   = useRef(0);
  const lastSeenId  = useRef<string>("");
  const resizing    = useRef(false);
  const startX      = useRef(0);
  const startW      = useRef(0);
  const startTabY   = useRef(0);
  const startTabPos = useRef(0);
  const didDrag     = useRef(false);

  const isAdmin = profiles.find((p) => p.username === currentUser)?.role === "admin";

  // Init
  useEffect(() => {
    setSettings(loadSettings());
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    setTabY(saved ? parseInt(saved, 10) : getDefaultTabY());
    const savedW = sessionStorage.getItem("chat-drawer-width");
    if (savedW) setWidth(parseInt(savedW, 10));
    const savedLastSeen = localStorage.getItem("tgv_chat_last_seen_id");
    if (savedLastSeen) lastSeenId.current = savedLastSeen;
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail !== "chat") setOpen(false);
    };
    window.addEventListener(DRAWER_EVENT, handler);
    return () => window.removeEventListener(DRAWER_EVENT, handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Load session + profiles + presence
  const loadProfiles = useCallback(async () => {
    const [profRes, presRes] = await Promise.all([
      fetch("/api/users/profile").then((r) => r.json()).catch(() => ({ profiles: [] })),
      fetch("/api/presence").then((r) => r.json()).catch(() => []),
    ]);
    setProfiles(profRes.profiles ?? []);
    setPresence(Array.isArray(presRes) ? presRes : []);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/users/me").then((r) => r.json()).catch(() => null),
      fetch("/api/users/profile").then((r) => r.json()).catch(() => ({ profiles: [] })),
      fetch("/api/presence").then((r) => r.json()).catch(() => []),
    ]).then(([meRes, profRes, presRes]) => {
      setCurrentUser(meRes?.username ?? "admin");
      setProfiles(profRes.profiles ?? []);
      setPresence(Array.isArray(presRes) ? presRes : []);
    });
  }, []);

  // Poll messages
  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/chat?limit=100");
      if (!res.ok) return;
      const d = await res.json();
      const msgs: ChatMessage[] = d.messages ?? [];
      setMessages(msgs);
      setStoragePercent(d.storagePercent ?? 0);
      if (!open && lastSeenId.current) {
        const idx = msgs.findIndex((m) => m.id === lastSeenId.current);
        const newCount = idx === -1 ? msgs.length : msgs.length - idx - 1;
        setUnread(newCount > 0 ? newCount : 0);
      } else if (!open && msgs.length > seenCount.current) {
        setUnread(msgs.length - seenCount.current);
      }
    } catch { /* ignore */ }
  }, [open]);

  useEffect(() => {
    loadMessages();
    const id = setInterval(loadMessages, 10_000);
    return () => clearInterval(id);
  }, [loadMessages]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      seenCount.current = messages.length;
      const latest = messages[messages.length - 1];
      if (latest) {
        lastSeenId.current = latest.id;
        try { localStorage.setItem("tgv_chat_last_seen_id", latest.id); } catch { /* ignore */ }
      }
      setUnread(0);
    }
  }, [messages, open]);

  // Load DM thread when in DM mode
  const loadDmMessages = useCallback(async (peerUsername: string) => {
    const res = await fetch(`/api/chat/dm?with=${peerUsername}`).then((r) => r.json()).catch(() => ({ messages: [] }));
    setDmMessages(res.messages ?? []);
  }, []);

  useEffect(() => {
    if (mode.view !== "dm") return;
    const peer = (mode as { view: "dm"; peer: Profile }).peer;
    loadDmMessages(peer.username);
    const id = setInterval(() => loadDmMessages(peer.username), 10_000);
    return () => clearInterval(id);
  }, [mode, loadDmMessages]);

  useEffect(() => {
    if (mode.view === "dm") {
      dmBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [dmMessages, mode]);

  // Poll typing indicators (2s when drawer is open)
  useEffect(() => {
    if (!open || (mode.view !== "chat" && mode.view !== "dm")) return;
    const context = mode.view === "dm"
      ? `dm:${(mode as { view: "dm"; peer: Profile }).peer.username}`
      : "chat";
    const poll = () => {
      fetch(`/api/chat/typing?context=${encodeURIComponent(context)}`)
        .then((r) => r.json())
        .then((d) => setTypers(d.typers ?? []))
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [open, mode]);

  // Send typing signal (debounced — at most once per 2s)
  const signalTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    const context = mode.view === "dm"
      ? `dm:${(mode as { view: "dm"; peer: Profile }).peer.username}`
      : "chat";
    fetch("/api/chat/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context }),
    }).catch(() => {});
  }, [mode]);

  const saveSettings = (s: ChatSettings) => {
    setSettings(s);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  };

  // ── Tab pill drag ──────────────────────────────────────────────────────────
  const onTabMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startTabY.current = e.clientY;
    startTabPos.current = tabY;
    didDrag.current = false;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startTabY.current;
      if (Math.abs(delta) > 4) didDrag.current = true;
      if (didDrag.current) {
        const next = Math.max(40, Math.min(window.innerHeight - 100, startTabPos.current + delta));
        setTabY(next);
        localStorage.setItem(TAB_STORAGE_KEY, String(next));
      }
    };
    const onUp = () => {
      if (!didDrag.current) {
        setOpen((p) => {
          const next = !p;
          if (next) window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: "chat" }));
          return next;
        });
      }
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.body.style.cursor = "ns-resize";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [tabY]);

  // ── Resize drawer ──────────────────────────────────────────────────────────
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    resizing.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = ev.clientX - startX.current;
      const newW = Math.min(MAX_W, Math.max(MIN_W, startW.current + delta));
      setWidth(newW);
      sessionStorage.setItem("chat-drawer-width", String(newW));
    };
    const onUp = () => {
      resizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [width]);

  // ── Chat actions ────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if ((!input.trim() && !uploadFile) || sending) return;
    setSending(true);
    try {
      if (uploadFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append("file", uploadFile);
        if (input.trim()) fd.append("content", input.trim());
        const res = await fetch("/api/chat/upload", { method: "POST", body: fd });
        if (res.ok) { setInput(""); setUploadFile(null); await loadMessages(); }
        setUploading(false);
      } else {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: input.trim() }),
        });
        if (res.ok) { setInput(""); await loadMessages(); }
      }
    } finally { setSending(false); }
  };

  const deleteMessage = async (id: string) => {
    await fetch(`/api/chat?id=${id}`, { method: "DELETE" });
    await loadMessages();
  };

  const editMessage = async (id: string, content: string) => {
    await fetch("/api/chat", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, content }) });
    await loadMessages();
  };

  const clearChat = async () => {
    if (!confirm("Clear all chat messages and files? This cannot be undone.")) return;
    await fetch("/api/chat/clear", { method: "POST" });
    await loadMessages();
  };

  // ── DM actions ──────────────────────────────────────────────────────────────
  const sendDm = async () => {
    if (!dmInput.trim() || dmSending || mode.view !== "dm") return;
    const peer = (mode as { view: "dm"; peer: Profile }).peer;
    setDmSending(true);
    try {
      await fetch("/api/chat/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: peer.username, content: dmInput.trim() }),
      });
      setDmInput("");
      await loadDmMessages(peer.username);
    } finally { setDmSending(false); }
  };

  const deleteDm = async (id: string) => {
    if (mode.view !== "dm") return;
    const peer = (mode as { view: "dm"; peer: Profile }).peer;
    await fetch(`/api/chat/dm?id=${id}&with=${peer.username}`, { method: "DELETE" });
    await loadDmMessages(peer.username);
  };

  const editDm = async (id: string, content: string) => {
    if (mode.view !== "dm") return;
    const peer = (mode as { view: "dm"; peer: Profile }).peer;
    await fetch("/api/chat/dm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, with: peer.username, content }),
    });
    await loadDmMessages(peer.username);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setUploadFile(f);
    e.target.value = "";
  };

  const fontClass = { sans: "font-sans", mono: "font-mono", serif: "font-serif" }[settings.myFont] ?? "font-sans";

  const peer = mode.view === "dm" ? (mode as { view: "dm"; peer: Profile }).peer : null;

  return (
    <>
      {/* ── Side tab pill ────────────────────────────────────────────────────── */}
      <button
        onMouseDown={onTabMouseDown}
        title={open ? "Close chat" : "Open chat"}
        className="fixed left-0 z-[63] flex flex-col items-center justify-center gap-2 select-none"
        style={{
          top: tabY, transform: "translateY(-50%)",
          width: 28, paddingTop: 12, paddingBottom: 12,
          background: open ? "rgba(255,78,203,0.25)" : unread > 0 ? "rgba(255,78,203,0.22)" : "rgba(255,78,203,0.12)",
          border: "1px solid rgba(255,78,203,0.45)", borderLeft: "none",
          borderRadius: "0 10px 10px 0", color: "#ff4ecb",
          boxShadow: unread > 0 ? "2px 0 14px rgba(255,78,203,0.35)" : "2px 0 10px rgba(255,78,203,0.18)",
          backdropFilter: "blur(8px)", transition: "background 0.2s", cursor: "grab",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,78,203,0.3)"; }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = open ? "rgba(255,78,203,0.25)" : unread > 0 ? "rgba(255,78,203,0.22)" : "rgba(255,78,203,0.12)";
        }}
      >
        <span className="relative flex items-center justify-center">
          {open ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M1 1h12v9H8l-3 3V10H1V1z" stroke="#ff4ecb" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="4.5" cy="5.5" r="0.8" fill="#ff4ecb"/>
              <circle cx="7" cy="5.5" r="0.8" fill="#ff4ecb"/>
              <circle cx="9.5" cy="5.5" r="0.8" fill="#ff4ecb"/>
            </svg>
          )}
          {unread > 0 && !open && (
            <span className="absolute flex items-center justify-center text-[7px] font-bold"
              style={{ background: "#00bfff", color: "#060810", borderRadius: "50%", width: 13, height: 13, top: -6, right: -6 }}>
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
        <span style={{ writingMode: "vertical-rl", fontSize: 9, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          Chat
        </span>
      </button>

      {/* ── Backdrop ─────────────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-[58]" style={{ backdropFilter: "blur(1px)" }} onClick={() => setOpen(false)} />
      )}

      {/* ── Drawer ───────────────────────────────────────────────────────────── */}
      <div
        className={`fixed top-0 left-0 h-full z-[62] flex flex-col overflow-hidden ${fontClass}`}
        style={{
          width,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: resizing.current ? "none" : "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          background: "rgba(6,8,12,0.99)",
          borderRight: "1px solid rgba(255,78,203,0.18)",
          boxShadow: open ? "12px 0 60px rgba(0,0,0,0.7)" : "none",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", minHeight: 44 }}>

          {/* Back button (members / dm mode) */}
          {mode.view !== "chat" && (
            <button
              onClick={() => setMode(mode.view === "dm" ? { view: "members" } : { view: "chat" })}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-all hover:bg-white/10 flex-shrink-0"
              style={{ color: VIOLET }}
            >
              ‹
            </button>
          )}

          {/* Title */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {mode.view === "chat" && (
              <>
                <span className="text-sm">💬</span>
                <span className="text-sm font-bold" style={{ color: "#00bfff" }}>TGV Chat</span>
              </>
            )}
            {mode.view === "members" && (
              <>
                <span className="text-sm font-bold" style={{ color: VIOLET }}>Members</span>
              </>
            )}
            {mode.view === "dm" && peer && (
              <>
                <UserAvatar profile={peer} size={20} />
                <span className="text-sm font-bold truncate" style={{ color: peer.accentColor }}>{peer.displayName}</span>
                <span className="text-[9px] text-white/30">DM</span>
              </>
            )}
          </div>

          {/* Member avatar chips (chat mode only) */}
          {mode.view === "chat" && (
            <div className="flex gap-1 shrink-0">
              {profiles.map((p) => (
                <span key={p.username} title={p.displayName} className="shrink-0">
                  <UserAvatar profile={p} size={20} />
                </span>
              ))}
            </div>
          )}

          {/* Members toggle button */}
          {mode.view === "chat" && (
            <button
              onClick={() => setMode({ view: "members" })}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-all hover:bg-white/10 flex-shrink-0"
              style={{ color: VIOLET }}
              title="Members"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="5" r="2.5"/>
                <circle cx="11" cy="5" r="2.5"/>
                <path d="M0 14c0-2.5 2.2-4 5-4s5 1.5 5 4"/>
                <path d="M11 10c2.2.5 4 1.8 4 4" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          {/* Clear chat (chat mode, admin or everyone) */}
          {mode.view === "chat" && (
            <button
              onClick={clearChat}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-all hover:bg-red-500/15"
              style={{ color: "rgba(255,255,255,0.2)" }}
              title="Clear all messages"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
                <path d="M2 4h10M5 4V2.5A.5.5 0 0 1 5.5 2h3a.5.5 0 0 1 .5.5V4M3 4l.7 7.5A1 1 0 0 0 4.7 12.5h4.6a1 1 0 0 0 1-.9L11 4H3z"/>
              </svg>
            </button>
          )}

          {/* Gear (chat mode) */}
          {mode.view === "chat" && (
            <button onClick={() => setShowSettingsModal(true)}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.5)" }} title="Settings">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 10.5A2.5 2.5 0 1 1 8 5.5a2.5 2.5 0 0 1 0 5zm5.29-2.77a5.07 5.07 0 0 0 .04-.73 5 5 0 0 0-.04-.73l1.57-1.23a.38.38 0 0 0 .09-.48l-1.49-2.57a.37.37 0 0 0-.45-.16l-1.85.74a5.4 5.4 0 0 0-1.26-.73L9.67.37A.36.36 0 0 0 9.31 0H6.69a.36.36 0 0 0-.36.37l-.27 1.97a5.4 5.4 0 0 0-1.26.73l-1.85-.74a.37.37 0 0 0-.45.16L1.05 4.86a.37.37 0 0 0 .09.48l1.57 1.23c-.03.24-.04.48-.04.73s.01.49.04.73L1.14 9.26a.37.37 0 0 0-.09.48l1.49 2.57c.09.16.28.22.45.16l1.85-.74c.39.28.82.52 1.26.73l.27 1.97c.05.2.24.37.45.37H9.3c.21 0 .4-.17.45-.37l.27-1.97a5.4 5.4 0 0 0 1.26-.73l1.85.74c.17.06.36 0 .45-.16l1.49-2.57a.37.37 0 0 0-.09-.48l-1.69-1.27z"/>
              </svg>
            </button>
          )}

          <button onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:bg-white/10 transition-all flex-shrink-0"
            style={{ color: "rgba(255,255,255,0.3)" }}>✕</button>
        </div>

        {/* ── Members panel ────────────────────────────────────────────────────── */}
        {mode.view === "members" && (
          <MembersPanel
            profiles={profiles}
            presence={presence}
            currentUser={currentUser}
            onSelectUser={(p) => { setMode({ view: "dm", peer: p }); setDmMessages([]); }}
          />
        )}

        {/* ── Chat messages ─────────────────────────────────────────────────────  */}
        {mode.view === "chat" && (
          <div className={`flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 text-${settings.fontSize}`}
            style={{ scrollbarWidth: "thin" }}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-white/20">
                <span className="text-4xl">💬</span>
                <p className="text-xs">No messages yet. Say hi!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const profile = profiles.find((p) => p.username === msg.from);
                return (
                  <MessageBubble
                    key={msg.id}
                    id={msg.id} from={msg.from} content={msg.content}
                    fileUrl={msg.fileUrl} fileName={msg.fileName} fileSize={msg.fileSize} fileMime={msg.fileMime}
                    createdAt={msg.createdAt} editedAt={msg.editedAt}
                    profile={profile} isMe={msg.from === currentUser}
                    settings={settings} canDelete={msg.from === currentUser || isAdmin}
                    onDelete={() => deleteMessage(msg.id)}
                    onEdit={(content) => editMessage(msg.id, content)}
                  />
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* ── DM thread ─────────────────────────────────────────────────────────── */}
        {mode.view === "dm" && peer && (
          <div className={`flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 text-${settings.fontSize}`}
            style={{ scrollbarWidth: "thin" }}>
            {dmMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-white/20">
                <UserAvatar profile={peer} size={40} />
                <p className="text-xs mt-1">Start a conversation with {peer.displayName}</p>
              </div>
            ) : (
              dmMessages.map((msg) => {
                const profile = profiles.find((p) => p.username === msg.from);
                return (
                  <MessageBubble
                    key={msg.id}
                    id={msg.id} from={msg.from} content={msg.content}
                    createdAt={msg.createdAt} editedAt={msg.editedAt}
                    profile={profile} isMe={msg.from === currentUser}
                    settings={settings} canDelete={msg.from === currentUser}
                    onDelete={() => deleteDm(msg.id)}
                    onEdit={(content) => editDm(msg.id, content)}
                  />
                );
              })
            )}
            <div ref={dmBottomRef} />
          </div>
        )}

        {/* ── Input (chat + DM) ─────────────────────────────────────────────────── */}
        {(mode.view === "chat" || mode.view === "dm") && (
          <div className="flex-shrink-0 px-4 py-3 flex flex-col gap-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>

            {mode.view === "chat" && uploadFile && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(0,191,255,0.08)", border: "1px solid rgba(0,191,255,0.25)" }}>
                <span className="text-xs text-cyan-400 flex-1 truncate">📎 {uploadFile.name}</span>
                <span className="text-[9px] text-white/30">{fmtBytes(uploadFile.size)}</span>
                <button onClick={() => setUploadFile(null)} className="text-[9px] text-white/30 hover:text-red-400">✕</button>
              </div>
            )}

            {typers.length > 0 && (
              <div className="flex items-center gap-1.5 px-1" style={{ minHeight: 16 }}>
                <span className="flex gap-0.5 items-end">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1 h-1 rounded-full"
                      style={{
                        background: "rgba(255,255,255,0.4)",
                        animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </span>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {typers.length === 1
                    ? `${typers[0]} is typing…`
                    : typers.length === 2
                    ? `${typers[0]} and ${typers[1]} are typing…`
                    : "Several people are typing…"}
                </span>
              </div>
            )}

            <div className="flex items-end gap-2">
              {mode.view === "chat" && (
                <>
                  <button onClick={() => fileRef.current?.click()}
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                    style={{ background: "rgba(0,191,255,0.08)", border: "1px solid rgba(0,191,255,0.3)", color: "#00bfff" }}
                    title="Attach file">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                  </button>
                  <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
                </>
              )}

              <textarea
                value={mode.view === "dm" ? dmInput : input}
                onChange={(e) => {
                  if (mode.view === "dm") setDmInput(e.target.value);
                  else setInput(e.target.value);
                  if (e.target.value.trim()) signalTyping();
                }}
                onKeyDown={(e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    mode.view === "dm" ? sendDm() : sendMessage();
                  }
                }}
                placeholder={mode.view === "dm" && peer ? `Message ${peer.displayName}…` : "Enter to send · Shift+Enter for newline"}
                rows={1}
                className={`flex-1 bg-transparent outline-none text-white/80 resize-none rounded-xl px-3 py-2 ${fontClass}`}
                style={{
                  border: `1px solid ${mode.view === "dm" ? `${peer?.accentColor ?? VIOLET}44` : "rgba(255,255,255,0.1)"}`,
                  fontSize: settings.fontSize === "xs" ? 11 : settings.fontSize === "sm" ? 13 : 15,
                  maxHeight: 80,
                }}
              />

              <button
                onClick={mode.view === "dm" ? sendDm : sendMessage}
                disabled={mode.view === "dm" ? (!dmInput.trim() || dmSending) : ((sending || uploading) || (!input.trim() && !uploadFile))}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30"
                style={{
                  background: mode.view === "dm" ? `${peer?.accentColor ?? VIOLET}22` : "rgba(0,191,255,0.2)",
                  border: `1px solid ${mode.view === "dm" ? `${peer?.accentColor ?? VIOLET}55` : "rgba(0,191,255,0.4)"}`,
                  color: mode.view === "dm" ? (peer?.accentColor ?? VIOLET) : "#00bfff",
                }}
                title="Send (Enter)">
                {(sending || uploading || dmSending) ? (
                  <span className="text-[9px]">…</span>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M0 12L12 6 0 0v4.5l8.57 1.5L0 7.5z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Resize handle */}
        <div onMouseDown={onResizeStart}
          className="absolute top-0 right-0 h-full w-1.5 cursor-ew-resize z-10 group"
          style={{ background: "transparent" }}>
          <div className="absolute inset-y-0 right-0 w-px group-hover:w-1 transition-all"
            style={{ background: "rgba(255,78,203,0.15)" }} />
        </div>
      </div>

      {showSettingsModal && (
        <ChatSettingsModal
          settings={settings}
          onSettingsChange={saveSettings}
          profiles={profiles}
          currentUser={currentUser}
          storagePercent={storagePercent}
          onClearChat={clearChat}
          onClose={() => setShowSettingsModal(false)}
          onProfileRefresh={loadProfiles}
        />
      )}
    </>
  );
}
