"use client";

import { useEffect, useState } from "react";

type UserPresence = {
  sysUser: string;
  displayName: string;
  online: boolean;
  lastSeen: string | null;
};

const USER_COLOR: Record<string, string> = {
  admin:  "#ff4ecb",
  marmar: "#00bfff",
};

export default function PresenceDots() {
  const [presence, setPresence] = useState<UserPresence[]>([]);

  const poll = async () => {
    try {
      const res = await fetch("/api/presence");
      if (res.ok) setPresence(await res.json());
    } catch {
      // silently ignore — stale data stays visible
    }
  };

  useEffect(() => {
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  if (presence.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      {presence.map((u) => (
        <PresenceDot key={u.sysUser} user={u} color={USER_COLOR[u.sysUser] ?? "#ffffff"} />
      ))}
    </div>
  );
}

function PresenceDot({ user, color }: { user: UserPresence; color: string }) {
  const dotColor = user.online ? color : "#4b5563";
  const label = user.online
    ? "Online"
    : user.lastSeen
    ? `Last seen ${user.lastSeen}`
    : "Offline";

  return (
    <div className="group relative flex items-center gap-1.5 cursor-default">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{
          background: dotColor,
          boxShadow: user.online ? `0 0 5px ${dotColor}` : "none",
          animation: user.online ? "pulse-green 2.5s ease-in-out infinite" : "none",
        }}
      />
      <span
        className="text-xs hidden sm:inline"
        style={{ color: user.online ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)" }}
      >
        {user.displayName}
      </span>

      {/* Tooltip */}
      <div
        className="absolute bottom-full right-0 mb-2 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        style={{
          background: "rgba(10,10,15,0.95)",
          border: `1px solid ${dotColor}44`,
          color: "#ededed",
        }}
      >
        <span className="font-bold" style={{ color: dotColor }}>
          {user.displayName}
        </span>
        <span className="text-white/50 ml-1.5">{label}</span>
      </div>
    </div>
  );
}
