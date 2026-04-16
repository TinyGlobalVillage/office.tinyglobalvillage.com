"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ProfileModal, { type Profile, type Memo, type Ping, hexToRgb } from "./ProfileModal";
import { UserAvatar } from "./ChatSettingsModal";
import type { UserPresence } from "./PresenceDots";

export default function UsersCard({ className = "" }: { className?: string }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [presence, setPresence] = useState<UserPresence[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [pings, setPings] = useState<Ping[]>([]);
  const [unreadPings, setUnreadPings] = useState(0);
  const [openProfile, setOpenProfile] = useState<Profile | null>(null);
  const [currentUser, setCurrentUser] = useState<string>("");

  const load = async () => {
    const [profRes, presRes, memoRes, pingRes, meRes] = await Promise.all([
      fetch("/api/users/profile").then((r) => r.json()).catch(() => ({ profiles: [] })),
      fetch("/api/presence").then((r) => r.json()).catch(() => []),
      fetch("/api/users/memo").then((r) => r.json()).catch(() => ({ memos: [] })),
      fetch("/api/users/ping").then((r) => r.json()).catch(() => ({ pings: [], unread: 0 })),
      fetch("/api/users/me").then((r) => r.json()).catch(() => null),
    ]);
    setProfiles(profRes.profiles ?? []);
    setPresence(Array.isArray(presRes) ? presRes : []);
    setMemos(memoRes.memos ?? []);
    setPings(pingRes.pings ?? []);
    setUnreadPings(pingRes.unread ?? 0);
    setCurrentUser(meRes?.username ?? "admin");
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  // When openProfile data changes (after refresh), keep it in sync
  useEffect(() => {
    if (openProfile) {
      const updated = profiles.find((p) => p.username === openProfile.username);
      if (updated) setOpenProfile(updated);
    }
  }, [profiles]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`card-tgv p-5 flex flex-col gap-3 ${className}`} style={{ borderColor: "rgba(162,89,255,0.25)", boxShadow: "0 0 24px rgba(162,89,255,0.06)" }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#a259ff" }}>
          Team
        </h3>
        {unreadPings > 0 && (
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(162,89,255,0.18)",
              border: "1px solid rgba(162,89,255,0.45)",
              color: "#a259ff",
            }}
          >
            {unreadPings} ping{unreadPings !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {profiles.map((p) => {
          const pres = presence.find((u) => u.sysUser === p.username);
          const online = pres?.online ?? false;
          const accent = p.accentColor;
          // Show ping badge on the RECIPIENT's own card (current user), not the sender's
          const myUnreadPings = p.username === currentUser ? pings.filter((pg) => !pg.read) : [];

          return (
            <button
              key={p.username}
              onClick={() => setOpenProfile(p)}
              className="flex items-center gap-3 rounded-xl p-2 transition-all text-left w-full group"
              style={{ background: "rgba(255,255,255,0.03)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = `rgba(${hexToRgb(accent)},0.08)`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
              }
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <UserAvatar profile={p} size={36} />
                <span
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    background: online ? "#4ade80" : "#374151",
                    borderColor: "#060810",
                    boxShadow: online ? "0 0 5px #4ade80" : "none",
                  }}
                />
              </div>

              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-semibold text-white leading-tight">{p.displayName}</span>
                <span className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {p.title || p.email}
                </span>
              </div>

              {/* Unread ping badge — only on current user's card */}
              {myUnreadPings.length > 0 && (
                <span
                  className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: `rgba(${hexToRgb(accent)},0.2)`,
                    border: `1px solid ${accent}66`,
                    color: accent,
                  }}
                >
                  {myUnreadPings.length}
                </span>
              )}

              <span className="text-[10px] text-white/20 group-hover:text-white/40 transition-colors shrink-0">
                →
              </span>
            </button>
          );
        })}
      </div>

      {/* Recent memos preview */}
      {memos.length > 0 && (
        <div className="border-t pt-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/25 mb-1.5">
            Recent Memos
          </p>
          {memos.slice(0, 2).map((m) => (
            <div key={m.id} className="text-[10px] text-white/40 truncate py-0.5">
              <span style={{ color: "rgba(255,255,255,0.25)" }}>
                {new Date(m.createdAt).toLocaleDateString()}
              </span>
              {" · "}
              {m.content}
            </div>
          ))}
        </div>
      )}

      {/* Profile modal — portaled to body so card's hover transform doesn't break fixed positioning */}
      {openProfile && createPortal(
        <ProfileModal
          profile={openProfile}
          profiles={profiles}
          memos={memos}
          pings={pings}
          currentUser={currentUser}
          onClose={() => setOpenProfile(null)}
          onRefresh={load}
        />,
        document.body
      )}

    </div>
  );
}
