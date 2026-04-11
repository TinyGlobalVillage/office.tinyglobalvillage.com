"use client";

import { useEffect, useState } from "react";
import type { UserPresence } from "./PresenceDots";

const USER_COLOR: Record<string, string> = {
  admin:  "#ff4ecb",
  marmar: "#00bfff",
};

export default function PresenceCard({ className = "" }: { className?: string }) {
  const [presence, setPresence] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(true);

  const poll = async () => {
    try {
      const res = await fetch("/api/presence");
      if (res.ok) setPresence(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  const onlineCount = presence.filter((u) => u.online).length;

  return (
    <div className={`card-tgv glow-pink p-6 flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#ff4ecb" }}>
          Who&apos;s Online
        </h3>
        {!loading && (
          <span className="text-xs text-white/30">{onlineCount}/{presence.length} active</span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {presence.map((u) => (
            <UserRow key={u.sysUser} user={u} color={USER_COLOR[u.sysUser] ?? "#fff"} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({ user, color }: { user: UserPresence; color: string }) {
  const dotColor = user.online ? color : "#374151";
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
        style={{
          background: `linear-gradient(135deg, ${dotColor}33, ${dotColor}11)`,
          border: `1.5px solid ${dotColor}66`,
          color: user.online ? color : "#4b5563",
        }}
      >
        {user.displayName[0]}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-sm font-semibold text-white">{user.displayName}</span>
        <span className="text-xs text-white/35 truncate">
          {user.online
            ? `${user.sessions} active session${user.sessions !== 1 ? "s" : ""}`
            : user.lastSeen ? `Last seen ${user.lastSeen}` : "Offline"}
        </span>
      </div>
      <div className="shrink-0">
        {user.online ? (
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#4ade80" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80", boxShadow: "0 0 5px #4ade80", animation: "pulse-green 2s ease-in-out infinite" }} />
            Online
          </span>
        ) : (
          <span className="text-xs text-white/25">Offline</span>
        )}
      </div>
    </div>
  );
}
