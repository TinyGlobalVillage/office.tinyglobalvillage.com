"use client";

import { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "employee";

export type MemberProfile = {
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
  accentColor: string;
  title: string;
  bio?: string;
};

export type ChatSettings = {
  showTimestamps: boolean;
  timestampFormat: "relative" | "time" | "datetime";
  fontSize: "xs" | "sm" | "base";
  myFont: string;
};

const TS_FORMATS: { label: string; value: ChatSettings["timestampFormat"] }[] = [
  { label: "Relative (just now)", value: "relative" },
  { label: "Time (3:42 PM)",      value: "time"     },
  { label: "Full (Apr 15, 3:42)", value: "datetime" },
];
const FONT_SIZES: { label: string; value: ChatSettings["fontSize"] }[] = [
  { label: "Small",  value: "xs"   },
  { label: "Normal", value: "sm"   },
  { label: "Large",  value: "base" },
];
const FONTS = [
  { label: "Sans",  value: "sans",  css: "font-sans"  },
  { label: "Mono",  value: "mono",  css: "font-mono"  },
  { label: "Serif", value: "serif", css: "font-serif" },
];

const MEMBERS_PER_PAGE = 5;

function hexToRgb(hex: string) {
  const c = hex.replace("#", "");
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}

// ── Avatar component ──────────────────────────────────────────────────────────

export function UserAvatar({
  profile,
  size = 32,
}: {
  profile: Pick<MemberProfile, "displayName" | "accentColor" | "avatarUrl">;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const hasImg = profile.avatarUrl && !imgError;

  if (hasImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarUrl}
        alt={profile.displayName}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: `1.5px solid ${profile.accentColor}66`,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${profile.accentColor}44, ${profile.accentColor}18)`,
        border: `1.5px solid ${profile.accentColor}66`,
        color: profile.accentColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {profile.displayName[0]?.toUpperCase()}
    </div>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
      style={{
        background: role === "admin" ? "rgba(247,183,0,0.15)" : "rgba(255,255,255,0.07)",
        border: `1px solid ${role === "admin" ? "rgba(247,183,0,0.4)" : "rgba(255,255,255,0.15)"}`,
        color: role === "admin" ? "#f7b700" : "rgba(255,255,255,0.4)",
      }}
    >
      {role}
    </span>
  );
}

// ── Settings tab ──────────────────────────────────────────────────────────────

function SettingsTab({
  settings,
  onChange,
  currentUser,
  myProfile,
  isAdmin,
  storagePercent,
  onClearChat,
  onProfileRefresh,
}: {
  settings: ChatSettings;
  onChange: (s: ChatSettings) => void;
  currentUser: string;
  myProfile: MemberProfile | undefined;
  isAdmin: boolean;
  storagePercent: number;
  onClearChat: () => void;
  onProfileRefresh: () => void;
}) {
  const set = (patch: Partial<ChatSettings>) => onChange({ ...settings, ...patch });

  // Avatar upload
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  // Profile fields
  const [editName,  setEditName]  = useState(myProfile?.displayName ?? "");
  const [editEmail, setEditEmail] = useState(myProfile?.email ?? "");
  const [editTitle, setEditTitle] = useState(myProfile?.title ?? "");
  const [editBio,   setEditBio]   = useState(myProfile?.bio ?? "");
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (myProfile) {
      setEditName(myProfile.displayName);
      setEditEmail(myProfile.email ?? "");
      setEditTitle(myProfile.title ?? "");
      setEditBio(myProfile.bio ?? "");
    }
  }, [myProfile]);

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/users/avatar", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json();
        setAvatarError(d.error ?? "Upload failed");
      } else {
        onProfileRefresh();
      }
    } catch {
      setAvatarError("Upload failed");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const saveProfile = async () => {
    if (!editName.trim()) return;
    setSaveError("");
    setSaving(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editName.trim(),
          email: editEmail.trim(),
          title: editTitle.trim(),
          bio: editBio.trim(),
        }),
      });
      if (!res.ok) setSaveError("Save failed");
      else onProfileRefresh();
    } finally {
      setSaving(false);
    }
  };

  const accent = myProfile?.accentColor ?? "#ff4ecb";

  return (
    <div className="flex flex-col gap-5">
      {/* ── Identity section ────────────────────────────────────────────── */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-3">Identity</p>

        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="relative group"
              title="Click to change avatar"
            >
              {myProfile && <UserAvatar profile={myProfile} size={56} />}
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(0,0,0,0.55)" }}
              >
                <span className="text-white text-xs">📷</span>
              </div>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
                <span className="text-[9px] text-white animate-pulse">…</span>
              </div>
            )}
          </div>

          {/* Profile fields */}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Display name"
              className="bg-transparent outline-none text-sm font-bold text-white rounded-lg px-3 py-1.5 w-full"
              style={{ border: `1px solid ${accent}44` }}
            />
            <input
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="Email address"
              type="email"
              className="bg-transparent outline-none text-xs text-white/70 rounded-lg px-3 py-1.5 w-full"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title / role"
              className="bg-transparent outline-none text-xs text-white/70 rounded-lg px-3 py-1.5 w-full"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="Bio…"
              rows={2}
              className="bg-transparent outline-none text-xs text-white/70 rounded-lg px-3 py-1.5 w-full resize-none"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            />
            {avatarError && <p className="text-[9px] text-red-400">{avatarError}</p>}
            {saveError && <p className="text-[9px] text-red-400">{saveError}</p>}
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/25">Click avatar to change photo</p>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="text-[10px] px-3 py-1.5 rounded-lg transition-all disabled:opacity-30"
                style={{ background: `rgba(${hexToRgb(accent)},0.18)`, border: `1px solid ${accent}55`, color: accent }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-px" style={{ background: "rgba(255,255,255,0.07)" }} />

      {/* ── Timestamps ──────────────────────────────────────────────────── */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-3">Timestamps</p>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-white/60">Show timestamps</span>
          <button
            onClick={() => set({ showTimestamps: !settings.showTimestamps })}
            className="w-10 h-5 rounded-full relative transition-all"
            style={{ background: settings.showTimestamps ? "rgba(255,78,203,0.7)" : "rgba(255,255,255,0.1)" }}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
              style={{
                left: settings.showTimestamps ? "calc(100% - 18px)" : "2px",
                background: settings.showTimestamps ? "#fff" : "rgba(255,255,255,0.4)",
              }}
            />
          </button>
        </div>

        {settings.showTimestamps && (
          <div className="flex flex-col gap-1 pl-1">
            {TS_FORMATS.map((f) => (
              <button
                key={f.value}
                onClick={() => set({ timestampFormat: f.value })}
                className="flex items-center gap-2 text-[11px] px-2 py-1 rounded-lg transition-all text-left"
                style={{
                  background: settings.timestampFormat === f.value ? "rgba(255,78,203,0.1)" : "transparent",
                  color: settings.timestampFormat === f.value ? "#ff4ecb" : "rgba(255,255,255,0.45)",
                }}
              >
                <span
                  className="w-3 h-3 rounded-full border flex items-center justify-center shrink-0"
                  style={{ borderColor: settings.timestampFormat === f.value ? "#ff4ecb" : "rgba(255,255,255,0.2)" }}
                >
                  {settings.timestampFormat === f.value && (
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                  )}
                </span>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Font ────────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-2">Appearance</p>
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-[10px] text-white/40 mb-1">Font size</p>
            <div className="flex gap-1">
              {FONT_SIZES.map((f) => (
                <button
                  key={f.value}
                  onClick={() => set({ fontSize: f.value })}
                  className="flex-1 py-1 rounded-lg text-[10px] transition-all"
                  style={{
                    background: settings.fontSize === f.value ? "rgba(255,78,203,0.15)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${settings.fontSize === f.value ? "rgba(255,78,203,0.5)" : "rgba(255,255,255,0.08)"}`,
                    color: settings.fontSize === f.value ? "#ff4ecb" : "rgba(255,255,255,0.45)",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-white/40 mb-1">Font family</p>
            <div className="flex gap-1">
              {FONTS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => set({ myFont: f.value })}
                  className={`flex-1 py-1 rounded-lg text-[10px] transition-all ${f.css}`}
                  style={{
                    background: settings.myFont === f.value ? "rgba(255,78,203,0.15)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${settings.myFont === f.value ? "rgba(255,78,203,0.5)" : "rgba(255,255,255,0.08)"}`,
                    color: settings.myFont === f.value ? "#ff4ecb" : "rgba(255,255,255,0.45)",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Storage (admin only) ─────────────────────────────────────────── */}
      {isAdmin && (
        <>
          <div className="w-full h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/30">Chat storage</p>
              <span className="text-[9px] text-white/40">{storagePercent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, storagePercent)}%`,
                  background: storagePercent > 80 ? "#ff6b6b" : storagePercent > 60 ? "#f7b700" : "#4ade80",
                }}
              />
            </div>
            <button
              onClick={onClearChat}
              className="w-full text-[10px] font-bold py-1.5 rounded-lg transition-all"
              style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", color: "#ff6b6b" }}
            >
              🗑 Clear All Chat &amp; Files
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Members tab ───────────────────────────────────────────────────────────────

function MembersTab({
  profiles,
  currentUser,
  isAdmin,
  onRoleChange,
}: {
  profiles: MemberProfile[];
  currentUser: string;
  isAdmin: boolean;
  onRoleChange: (username: string, role: UserRole) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [changing, setChanging] = useState<string | null>(null);

  const filtered = profiles.filter((p) => {
    const q = query.toLowerCase();
    return (
      p.displayName.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / MEMBERS_PER_PAGE));
  const pageItems = filtered.slice(page * MEMBERS_PER_PAGE, (page + 1) * MEMBERS_PER_PAGE);

  // Reset page when search changes
  useEffect(() => { setPage(0); }, [query]);

  const handleRoleChange = async (username: string, role: UserRole) => {
    setChanging(username);
    await onRoleChange(username, role);
    setChanging(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 text-xs">🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members…"
          className="w-full bg-transparent outline-none text-xs text-white/70 rounded-xl pl-8 pr-3 py-2"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 text-xs"
          >✕</button>
        )}
      </div>

      {/* Member cards */}
      <div className="flex flex-col gap-2">
        {pageItems.length === 0 ? (
          <p className="text-xs text-white/25 text-center py-6">No members found.</p>
        ) : (
          pageItems.map((p) => {
            const isSelf = p.username === currentUser;
            const canChangeRole = isAdmin && !isSelf;
            return (
              <div
                key={p.username}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: isSelf
                    ? `rgba(${hexToRgb(p.accentColor)},0.08)`
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isSelf ? `${p.accentColor}33` : "rgba(255,255,255,0.07)"}`,
                }}
              >
                <UserAvatar profile={p} size={36} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white leading-tight">
                      {p.displayName}
                    </span>
                    {isSelf && (
                      <span className="text-[8px] text-white/30 font-bold uppercase tracking-wider">(you)</span>
                    )}
                    <RoleBadge role={p.role} />
                  </div>
                  <p className="text-[10px] text-white/35 truncate mt-0.5">{p.email}</p>
                </div>

                {/* Role changer (admins only, not self) */}
                {canChangeRole ? (
                  <div className="shrink-0">
                    {changing === p.username ? (
                      <span className="text-[9px] text-white/30 animate-pulse">Saving…</span>
                    ) : (
                      <select
                        value={p.role}
                        onChange={(e) => handleRoleChange(p.username, e.target.value as UserRole)}
                        className="text-[10px] rounded-lg px-2 py-1 outline-none cursor-pointer"
                        style={{
                          background: "rgba(255,255,255,0.07)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          color: "rgba(255,255,255,0.6)",
                        }}
                      >
                        <option value="admin">Admin</option>
                        <option value="employee">Employee</option>
                      </select>
                    )}
                  </div>
                ) : (
                  <div className="shrink-0 w-[72px]" /> /* placeholder for alignment */
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination (GPG) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all disabled:opacity-25"
            style={{ background: "rgba(255,78,203,0.1)", border: "1px solid rgba(255,78,203,0.3)", color: "#ff4ecb" }}
          >←</button>

          <span className="text-[10px] text-white/30 tabular-nums">
            {page + 1} / {totalPages}
            <span className="text-white/20 ml-1.5">({filtered.length} member{filtered.length !== 1 ? "s" : ""})</span>
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all disabled:opacity-25"
            style={{ background: "rgba(255,78,203,0.1)", border: "1px solid rgba(255,78,203,0.3)", color: "#ff4ecb" }}
          >→</button>
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

type ModalTab = "settings" | "members";

export default function ChatSettingsModal({
  settings,
  onSettingsChange,
  profiles,
  currentUser,
  storagePercent,
  onClearChat,
  onClose,
  onProfileRefresh,
}: {
  settings: ChatSettings;
  onSettingsChange: (s: ChatSettings) => void;
  profiles: MemberProfile[];
  currentUser: string;
  storagePercent: number;
  onClearChat: () => void;
  onClose: () => void;
  onProfileRefresh: () => void;
}) {
  const [tab, setTab] = useState<ModalTab>("settings");

  const myProfile = profiles.find((p) => p.username === currentUser);
  const isAdmin = myProfile?.role === "admin";

  const handleRoleChange = useCallback(async (username: string, role: UserRole) => {
    await fetch("/api/users/role", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, role }),
    });
    onProfileRefresh();
  }, [onProfileRefresh]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[80]"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed z-[81] flex flex-col"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(96vw, 520px)",
          maxHeight: "85vh",
          background: "rgba(7,9,13,0.99)",
          border: "1px solid rgba(255,78,203,0.2)",
          borderRadius: 20,
          boxShadow: "0 24px 80px rgba(0,0,0,0.85), 0 0 40px rgba(255,78,203,0.08)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          {/* Tab pills */}
          <div
            className="flex items-center rounded-full p-0.5"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {([
              { id: "settings", label: "⚙ Settings" },
              { id: "members",  label: "👥 Members"  },
            ] as { id: ModalTab; label: string }[]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full transition-all"
                style={{
                  background: tab === t.id ? "rgba(255,78,203,0.2)" : "transparent",
                  border: tab === t.id ? "1px solid rgba(255,78,203,0.4)" : "1px solid transparent",
                  color: tab === t.id ? "#ff4ecb" : "rgba(255,255,255,0.3)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Member count badge */}
          {tab === "members" && (
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(255,78,203,0.12)", border: "1px solid rgba(255,78,203,0.3)", color: "#ff4ecb" }}
            >
              {profiles.length}
            </span>
          )}

          <button
            onClick={onClose}
            className="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-xs hover:bg-white/10 transition-all"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5" style={{ scrollbarWidth: "thin" }}>
          {tab === "settings" && (
            <SettingsTab
              settings={settings}
              onChange={onSettingsChange}
              currentUser={currentUser}
              myProfile={myProfile}
              isAdmin={isAdmin}
              storagePercent={storagePercent}
              onClearChat={onClearChat}
              onProfileRefresh={onProfileRefresh}
            />
          )}
          {tab === "members" && (
            <MembersTab
              profiles={profiles}
              currentUser={currentUser}
              isAdmin={isAdmin}
              onRoleChange={handleRoleChange}
            />
          )}
        </div>
      </div>
    </>
  );
}
