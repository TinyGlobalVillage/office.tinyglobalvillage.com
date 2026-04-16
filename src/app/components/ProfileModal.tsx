"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import ChatSettingsModal, { UserAvatar, type ChatSettings, type UserRole, type MemberProfile } from "./ChatSettingsModal";

export type Profile = {
  username: string;
  displayName: string;
  email: string;
  title: string;
  bio: string;
  accentColor: string;
  avatarUrl: string;
  role: UserRole;
};

const CHAT_SETTINGS_KEY = "tgv_chat_settings";
const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  showTimestamps: true,
  timestampFormat: "time",
  fontSize: "sm",
  myFont: "sans",
};

export type Memo = {
  id: string;
  from: string;
  to: string;
  content: string;
  createdAt: string;
  editedAt?: string;
};

export type Ping = {
  id: string;
  from: string;
  to: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ProfileModal({
  profile,
  profiles,
  memos,
  pings,
  currentUser,
  onClose,
  onRefresh,
}: {
  profile: Profile;
  profiles: Profile[];
  memos: Memo[];
  pings: Ping[];
  currentUser: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const isOwn = profile.username === currentUser;
  const accent = profile.accentColor;

  // Memo state
  const [newMemo, setNewMemo] = useState("");
  const [sendingMemo, setSendingMemo] = useState(false);
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editMemoContent, setEditMemoContent] = useState("");

  // Ping state
  const [pingMsg, setPingMsg] = useState("");
  const [sendingPing, setSendingPing] = useState(false);
  const [showPingInput, setShowPingInput] = useState(false);

  // Avatar upload state (own profile)
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Settings modal state (own profile)
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [storagePercent, setStoragePercent] = useState(0);

  const openSettingsModal = async () => {
    const res = await fetch("/api/chat?limit=1").then((r) => r.json()).catch(() => ({}));
    setStoragePercent(res.storagePercent ?? 0);
    setShowSettingsModal(true);
  };

  const clearChat = async () => {
    if (!confirm("Clear all chat messages and files? This cannot be undone.")) return;
    await fetch("/api/chat/clear", { method: "POST" });
    const res = await fetch("/api/chat?limit=1").then((r) => r.json()).catch(() => ({}));
    setStoragePercent(res.storagePercent ?? 0);
  };

  // Chat settings state (own profile)
  const [chatSettings, setChatSettings] = useState<ChatSettings>(DEFAULT_CHAT_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_SETTINGS_KEY);
      if (raw) setChatSettings({ ...DEFAULT_CHAT_SETTINGS, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);

  const saveChatSettings = (patch: Partial<ChatSettings>) => {
    setChatSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(CHAT_SETTINGS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/users/avatar", { method: "POST", body: fd });
      if (res.ok) onRefresh();
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  // When viewing own profile: show all pings TO me
  // When viewing other's profile: show pings FROM that person TO me
  const relevantPings = isOwn
    ? pings.filter((p) => p.to === currentUser && !p.read)
    : pings.filter((p) => p.from === profile.username && p.to === currentUser && !p.read);

  const relevantMemos = memos.filter(
    (m) => m.from === profile.username || m.to === profile.username
  );

  // Lock body scroll to stop page vibration when modal opens
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (showSettingsModal) { setShowSettingsModal(false); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose, showSettingsModal]);

  const sendMemo = async () => {
    if (!newMemo.trim()) return;
    setSendingMemo(true);
    await fetch("/api/users/memo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: profile.username, content: newMemo.trim() }),
    });
    setNewMemo("");
    setSendingMemo(false);
    onRefresh();
  };

  const saveMemoEdit = async (id: string) => {
    await fetch("/api/users/memo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, content: editMemoContent }),
    });
    setEditingMemoId(null);
    onRefresh();
  };

  const deleteMemo = async (id: string) => {
    await fetch(`/api/users/memo?id=${id}`, { method: "DELETE" });
    onRefresh();
  };

  const archiveMemo = async (id: string) => {
    await fetch("/api/users/memo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, archive: true }),
    });
    onRefresh();
  };

  const sendPing = async () => {
    if (!pingMsg.trim()) return;
    setSendingPing(true);
    await fetch("/api/users/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: profile.username, message: pingMsg.trim() }),
    });
    setPingMsg("");
    setShowPingInput(false);
    setSendingPing(false);
    onRefresh();
  };

  const markPingRead = async (id: string) => {
    await fetch("/api/users/ping", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    onRefresh();
  };

  const markAllPingsRead = async () => {
    await fetch("/api/users/ping", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    onRefresh();
  };

  return (
    <>
      {showSettingsModal && (
        <ChatSettingsModal
          settings={chatSettings}
          onSettingsChange={saveChatSettings}
          profiles={profiles as unknown as MemberProfile[]}
          currentUser={currentUser}
          storagePercent={storagePercent}
          onClearChat={clearChat}
          onClose={() => setShowSettingsModal(false)}
          onProfileRefresh={onRefresh}
        />
      )}

      <div
        className="fixed inset-0 z-[70]"
        style={{
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(4px)",
          visibility: showSettingsModal ? "hidden" : "visible",
        }}
        onClick={onClose}
      />
      <div
        className="fixed z-[71] flex flex-col overflow-hidden"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(96vw, 520px)",
          maxHeight: "85vh",
          background: "rgba(7,9,13,0.99)",
          border: `1px solid ${accent}33`,
          borderRadius: 20,
          boxShadow: `0 24px 80px rgba(0,0,0,0.8), 0 0 40px ${accent}18`,
          visibility: showSettingsModal ? "hidden" : "visible",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-4 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="relative shrink-0 group/avatar">
            <UserAvatar profile={profile} size={44} />
            {isOwn && (
              <>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                  title="Change avatar"
                >
                  {uploadingAvatar
                    ? <span className="text-[9px] text-white animate-pulse">…</span>
                    : <span className="text-white text-xs">📷</span>}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white">{profile.displayName}</h3>
            <p className="text-xs text-white/40">{profile.email}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isOwn && (
              <button
                onClick={openSettingsModal}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
                style={{ color: accent }}
                title="Edit profile & settings"
              >
                <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 10.5A2.5 2.5 0 1 1 8 5.5a2.5 2.5 0 0 1 0 5zm5.29-2.77a5.07 5.07 0 0 0 .04-.73 5 5 0 0 0-.04-.73l1.57-1.23a.38.38 0 0 0 .09-.48l-1.49-2.57a.37.37 0 0 0-.45-.16l-1.85.74a5.4 5.4 0 0 0-1.26-.73L9.67.37A.36.36 0 0 0 9.31 0H6.69a.36.36 0 0 0-.36.37l-.27 1.97a5.4 5.4 0 0 0-1.26.73l-1.85-.74a.37.37 0 0 0-.45.16L1.05 4.86a.37.37 0 0 0 .09.48l1.57 1.23c-.03.24-.04.48-.04.73s.01.49.04.73L1.14 9.26a.37.37 0 0 0-.09.48l1.49 2.57c.09.16.28.22.45.16l1.85-.74c.39.28.82.52 1.26.73l.27 1.97c.05.2.24.37.45.37H9.3c.21 0 .4-.17.45-.37l.27-1.97a5.4 5.4 0 0 0 1.26-.73l1.85.74c.17.06.36 0 .45-.16l1.49-2.57a.37.37 0 0 0-.09-.48l-1.69-1.27z"/>
                </svg>
              </button>
            )}
            {!isOwn && (
              <button
                onClick={() => setShowPingInput((p) => !p)}
                className="text-[10px] px-2.5 py-1 rounded-lg transition-all"
                style={{
                  background: showPingInput
                    ? `rgba(${hexToRgb(accent)},0.2)`
                    : `rgba(${hexToRgb(accent)},0.10)`,
                  border: `1px solid ${accent}44`,
                  color: accent,
                }}
              >
                🔔 Ping
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:bg-white/10 transition-all"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5"
          style={{ scrollbarWidth: "thin" }}
        >
          {/* Bio */}
          {profile.bio && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/25 mb-1.5">Bio</p>
              <p className="text-xs text-white/55 leading-relaxed">{profile.bio}</p>
            </div>
          )}

          {/* Title */}
          {profile.title && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/25 mb-1">Role</p>
              <p className="text-xs text-white/55">{profile.title}</p>
            </div>
          )}

          {/* Ping input (sending to other user) */}
          {showPingInput && !isOwn && (
            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{
                background: `rgba(${hexToRgb(accent)},0.07)`,
                border: `1px solid ${accent}33`,
              }}
            >
              <p
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: accent }}
              >
                Send a ping to {profile.displayName}
              </p>
              <div className="flex gap-2">
                <input
                  value={pingMsg}
                  onChange={(e) => setPingMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendPing();
                  }}
                  placeholder="Quick message…"
                  className="flex-1 bg-transparent outline-none text-xs text-white/80"
                  style={{ borderBottom: `1px solid ${accent}44`, paddingBottom: 2 }}
                  autoFocus
                />
                <button
                  onClick={sendPing}
                  disabled={!pingMsg.trim() || sendingPing}
                  className="text-[10px] px-3 py-1 rounded-lg transition-all disabled:opacity-40"
                  style={{
                    background: `rgba(${hexToRgb(accent)},0.2)`,
                    border: `1px solid ${accent}55`,
                    color: accent,
                  }}
                >
                  {sendingPing ? "…" : "Send 🔔"}
                </button>
              </div>
            </div>
          )}

          {/* Pings section */}
          {relevantPings.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/25">
                  {isOwn ? "Unread Pings" : `Pings from ${profile.displayName}`}
                </p>
                {isOwn && relevantPings.length > 1 && (
                  <button
                    onClick={markAllPingsRead}
                    className="text-[9px] text-white/30 hover:text-white/60 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {relevantPings.map((p) => {
                  const senderProfile = profiles.find((pr) => pr.username === p.from);
                  const senderAccent = senderProfile?.accentColor ?? "#ff4ecb";
                  return (
                    <div
                      key={p.id}
                      className="flex items-start gap-2 rounded-xl px-3 py-2"
                      style={{
                        background: `rgba(${hexToRgb(senderAccent)},0.08)`,
                        border: `1px solid ${senderAccent}22`,
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        {isOwn && (
                          <p
                            className="text-[9px] font-bold uppercase tracking-wider mb-0.5"
                            style={{ color: senderAccent }}
                          >
                            from {senderProfile?.displayName ?? p.from}
                          </p>
                        )}
                        <span className="text-[10px] text-white/70">{p.message}</span>
                      </div>
                      <span className="text-[9px] text-white/25 shrink-0">{timeAgo(p.createdAt)}</span>
                      <button
                        onClick={() => markPingRead(p.id)}
                        className="text-[9px] shrink-0 transition-all hover:opacity-70"
                        style={{ color: senderAccent }}
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Memos */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/25 mb-2">Memos</p>

            {/* New memo input */}
            <div className="flex gap-2 mb-3">
              <input
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMemo();
                  }
                }}
                placeholder={isOwn ? "Note to self…" : `Note for ${profile.displayName}…`}
                className="flex-1 bg-transparent outline-none text-xs text-white/70 rounded-lg px-3 py-2"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              />
              <button
                onClick={sendMemo}
                disabled={!newMemo.trim() || sendingMemo}
                className="text-[10px] px-3 py-1 rounded-lg transition-all disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                Add
              </button>
            </div>

            {/* Memo list */}
            {relevantMemos.length === 0 ? (
              <p className="text-[10px] text-white/20">No memos yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {relevantMemos.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl px-3 py-2 group"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {editingMemoId === m.id ? (
                      <div className="flex gap-2">
                        <input
                          value={editMemoContent}
                          onChange={(e) => setEditMemoContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveMemoEdit(m.id);
                            if (e.key === "Escape") setEditingMemoId(null);
                          }}
                          className="flex-1 bg-transparent outline-none text-xs text-white/80"
                          autoFocus
                        />
                        <button
                          onClick={() => saveMemoEdit(m.id)}
                          className="text-[9px] text-white/40 hover:text-white/70"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMemoId(null)}
                          className="text-[9px] text-white/30"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-white/75 leading-relaxed">{m.content}</p>
                          <p className="text-[9px] text-white/25 mt-0.5">
                            {profiles.find((p) => p.username === m.from)?.displayName ?? m.from} ·{" "}
                            {timeAgo(m.createdAt)}
                            {m.editedAt && " · edited"}
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {m.from === currentUser && (
                            <button
                              onClick={() => {
                                setEditingMemoId(m.id);
                                setEditMemoContent(m.content);
                              }}
                              className="text-[9px] text-white/30 hover:text-white/60"
                              title="Edit"
                            >
                              ✎
                            </button>
                          )}
                          <button
                            onClick={() => archiveMemo(m.id)}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] transition-all"
                            style={{ background: "rgba(162,89,255,0.15)", border: "1px solid rgba(162,89,255,0.35)", color: "#a259ff" }}
                            title="Archive (hide from your view)"
                          >
                            ⬇
                          </button>
                          <button
                            onClick={() => deleteMemo(m.id)}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] transition-all hover:bg-red-500/20 hover:border-red-400/40 hover:text-red-400"
                            style={{ background: "rgba(162,89,255,0.15)", border: "1px solid rgba(162,89,255,0.35)", color: "#a259ff" }}
                            title="Delete permanently"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
