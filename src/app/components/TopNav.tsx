"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProfileModal, { type Profile, type Memo, type Ping } from "./ProfileModal";
import { UserAvatar } from "./ChatSettingsModal";
import { signOut } from "next-auth/react";
import { useNavHistory } from "./useNavHistory";

const navLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Deploy", href: "/dashboard/deploy" },
  { label: "Processes", href: "/dashboard/processes" },
  { label: "Storage", href: "/dashboard/storage" },
  { label: "Editor", href: "/dashboard/editor" },
  { label: "Database", href: "/dashboard/database" },
  { label: "Utils", href: "/dashboard/utils" },
];

function BalloonSVG({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.35)} viewBox="0 0 30 41" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="15" cy="14" rx="13" ry="13.5" fill="#ff4ecb" />
      <path d="M2 14 Q6 0 15 1 Q6 6 2 14Z" fill="rgba(255,255,255,0.12)" />
      <path d="M28 14 Q24 0 15 1 Q24 6 28 14Z" fill="rgba(0,0,0,0.12)" />
      <path d="M15 1 Q18 14 15 27.5 Q12 14 15 1Z" fill="rgba(255,255,255,0.10)" />
      <ellipse cx="15" cy="14" rx="13" ry="2" fill="rgba(247,183,0,0.55)" />
      <ellipse cx="11" cy="9" rx="3.5" ry="4" fill="rgba(255,255,255,0.22)" />
      <path d="M11.5 27 L13 31.5 M18.5 27 L17 31.5" stroke="rgba(247,183,0,0.8)" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="11.5" y="31.5" width="7" height="5.5" rx="1.5" fill="rgba(247,183,0,0.85)" stroke="rgba(180,120,0,0.5)" strokeWidth="0.5" />
      <line x1="15" y1="31.5" x2="15" y2="37" stroke="rgba(0,0,0,0.2)" strokeWidth="0.6" />
      <line x1="11.5" y1="34" x2="18.5" y2="34" stroke="rgba(0,0,0,0.2)" strokeWidth="0.6" />
    </svg>
  );
}

export default function TopNav() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navH, setNavH] = useState(0);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const { canBack, canForward, back, forward } = useNavHistory();

  // User data for profile chips
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [pings, setPings] = useState<Ping[]>([]);
  const [presence, setPresence] = useState<{ sysUser: string; online: boolean; onlineSinceMs: number | null }[]>([]);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [openProfile, setOpenProfile] = useState<Profile | null>(null);
  const [unreadPings, setUnreadPings] = useState(0);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  const loadUserData = async () => {
    try {
      const [profRes, memoRes, pingRes, meRes, presRes] = await Promise.all([
        fetch("/api/users/profile").then((r) => r.json()).catch(() => ({ profiles: [] })),
        fetch("/api/users/memo").then((r) => r.json()).catch(() => ({ memos: [] })),
        fetch("/api/users/ping").then((r) => r.json()).catch(() => ({ pings: [], unread: 0 })),
        fetch("/api/users/me").then((r) => r.json()).catch(() => null),
        fetch("/api/presence").then((r) => r.json()).catch(() => []),
      ]);
      setProfiles(profRes.profiles ?? []);
      setMemos(memoRes.memos ?? []);
      setPings(pingRes.pings ?? []);
      setPresence(Array.isArray(presRes) ? presRes : []);
      setUnreadPings(pingRes.unread ?? 0);
      setCurrentUser(meRes?.username ?? "admin");
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadUserData();
    const id = setInterval(loadUserData, 30_000);
    return () => clearInterval(id);
  }, []);

  // Close overflow dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) setOverflowOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Measure real header height and sync to CSS custom property
  useEffect(() => {
    const measure = () => {
      if (headerRef.current) {
        const h = headerRef.current.offsetHeight;
        setNavH(h);
        document.documentElement.style.setProperty("--nav-h", `${h}px`);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (headerRef.current) ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, []);

  // Sync hidden state to CSS so pages can shift up/down
  useEffect(() => {
    document.documentElement.style.setProperty("--nav-offset", hidden ? "0px" : `${navH}px`);
    document.documentElement.classList.toggle("nav-hidden", hidden);
  }, [hidden, navH]);

  // Close dropdown on outside click or route change
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const currentPage = navLinks.find((l) => l.href === pathname)?.label ?? "Navigate";
  const myProfile = profiles.find((p) => p.username === currentUser);

  return (
    <>
      {/* ── Main nav header ───────────────────────────────────────────────── */}
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 px-4 pt-3 pb-2"
        style={{
          background: scrolled ? "rgba(0,0,0,0.92)" : "transparent",
          transform: hidden ? "translateY(-110%)" : "translateY(0)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1), background 0.3s",
        }}
      >
        <nav className="nav-tgv flex items-center justify-between px-5 py-2.5 max-w-7xl mx-auto">

          {/* Brand + Dropdown — grouped left */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2 group shrink-0">
              <BalloonSVG size={28} />
            </Link>

          {/* ── Back / Forward arrows ─────────────────────────────────────── */}
          <div className="flex items-center gap-1">
            <button
              onClick={back}
              disabled={!canBack}
              title="Back (⌘[ / Alt+←)"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all disabled:opacity-25 disabled:cursor-not-allowed"
              style={{
                background: "rgba(255,78,203,0.06)",
                border: "1px solid rgba(255,78,203,0.22)",
                color: "#ff4ecb",
              }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLElement).style.background = "rgba(255,78,203,0.18)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,78,203,0.06)"; }}
            >
              ‹
            </button>
            <button
              onClick={forward}
              disabled={!canForward}
              title="Forward (⌘] / Alt+→)"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all disabled:opacity-25 disabled:cursor-not-allowed"
              style={{
                background: "rgba(255,78,203,0.06)",
                border: "1px solid rgba(255,78,203,0.22)",
                color: "#ff4ecb",
              }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLElement).style.background = "rgba(255,78,203,0.18)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,78,203,0.06)"; }}
            >
              ›
            </button>
          </div>

          {/* ── Dropdown menu ─────────────────────────────────────────────── */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((p) => !p)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all"
              style={{
                background: menuOpen ? "rgba(255,78,203,0.25)" : "rgba(255,78,203,0.08)",
                border: "1px solid rgba(255,78,203,0.35)",
                color: "#ff4ecb",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,78,203,0.22)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = menuOpen
                  ? "rgba(255,78,203,0.25)"
                  : "rgba(255,78,203,0.08)";
              }}
            >
              <span>{currentPage}</span>
              <svg
                width="8" height="8" viewBox="0 0 8 8" fill="currentColor"
                style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
              >
                <path d="M4 6L0.5 1.5h7L4 6z" />
              </svg>
            </button>

            {menuOpen && (
              <div
                className="absolute top-full left-0 mt-2 rounded-xl overflow-hidden z-50"
                style={{
                  minWidth: 180,
                  background: "rgba(10,12,18,0.98)",
                  border: "1px solid rgba(255,78,203,0.25)",
                  boxShadow: "0 8px 40px rgba(255,78,203,0.12), 0 4px 20px rgba(0,0,0,0.7)",
                }}
              >
                {navLinks.map((link, i) => {
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all"
                      style={{
                        color: active ? "#ff4ecb" : "rgba(255,255,255,0.45)",
                        background: active ? "rgba(255,78,203,0.1)" : "transparent",
                        borderBottom: i < navLinks.length - 1 ? "1px solid rgba(255,78,203,0.08)" : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.color = "#ff4ecb";
                          (e.currentTarget as HTMLElement).style.background = "rgba(255,78,203,0.07)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)";
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                        }
                      }}
                    >
                      {active && <span style={{ color: "#ff4ecb", fontSize: 7 }}>●</span>}
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          </div>{/* end brand+dropdown group */}

          {/* Right: user chips + presence + sign out */}
          <div className="flex items-center gap-2 shrink-0">
            {/* User avatar chips — show max 3, overflow goes to dropdown */}
            {(() => {
              // Sort online users by onlineSinceMs asc (oldest first), offline last
              const sorted = [...profiles].sort((a, b) => {
                const pa = presence.find((pr) => pr.sysUser === a.username);
                const pb = presence.find((pr) => pr.sysUser === b.username);
                if (pa?.online && !pb?.online) return -1;
                if (!pa?.online && pb?.online) return 1;
                return (pa?.onlineSinceMs ?? 0) - (pb?.onlineSinceMs ?? 0);
              });

              const onlineCount = presence.filter((pr) => pr.online).length;
              const showDropdown = onlineCount > 3;
              const visibleChips = showDropdown ? sorted.slice(0, 3) : sorted;
              const overflowUsers = showDropdown ? sorted.slice(3) : [];

              const renderChip = (p: Profile) => {
                const isMe = p.username === currentUser;
                const myPingCount = isMe ? unreadPings : 0;
                const pres = presence.find((pr) => pr.sysUser === p.username);
                const online = pres?.online ?? false;
                return (
                  <button
                    key={p.username}
                    onClick={() => setOpenProfile(p)}
                    title={`${p.displayName}${myPingCount > 0 ? ` · ${myPingCount} unread ping${myPingCount !== 1 ? "s" : ""}` : ""}`}
                    className="relative p-0.5 rounded-full transition-all"
                    style={{ outline: `2px solid ${isMe ? `${p.accentColor}66` : "transparent"}` }}
                  >
                    <span className="relative shrink-0 block">
                      <UserAvatar profile={p} size={20} />
                      <span
                        className="absolute bottom-0 right-0 w-2 h-2 rounded-full border"
                        style={{
                          background: online ? "#4ade80" : "#374151",
                          borderColor: "#060810",
                          boxShadow: online ? "0 0 4px #4ade80" : "none",
                        }}
                      />
                    </span>
                    {myPingCount > 0 && (
                      <span
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                        style={{ background: p.accentColor, color: "#060810", boxShadow: `0 0 6px ${p.accentColor}` }}
                      >
                        {myPingCount > 9 ? "9+" : myPingCount}
                      </span>
                    )}
                  </button>
                );
              };

              return (
                <>
                  {visibleChips.map(renderChip)}
                  {showDropdown && (
                    <div ref={overflowRef} className="relative">
                      <button
                        onClick={() => setOverflowOpen((p) => !p)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all"
                        style={{
                          background: overflowOpen ? "rgba(255,78,203,0.25)" : "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,78,203,0.4)",
                          color: "#ff4ecb",
                        }}
                        title={`${overflowUsers.length} more user${overflowUsers.length !== 1 ? "s" : ""} online`}
                      >
                        +{overflowUsers.length}
                      </button>
                      {overflowOpen && (
                        <div
                          className="absolute right-0 top-full mt-2 flex flex-col gap-1 rounded-xl p-2 z-[200]"
                          style={{
                            background: "rgba(7,9,13,0.98)",
                            border: "1px solid rgba(255,78,203,0.2)",
                            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
                            minWidth: 160,
                          }}
                        >
                          {/* Most recent sign-in at bottom — slice already sorted asc */}
                          {overflowUsers.map((p) => {
                            const isMe = p.username === currentUser;
                            const pres = presence.find((pr) => pr.sysUser === p.username);
                            const online = pres?.online ?? false;
                            return (
                              <button
                                key={p.username}
                                onClick={() => { setOpenProfile(p); setOverflowOpen(false); }}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left w-full"
                                style={{ background: isMe ? `rgba(${hexToRgb(p.accentColor)},0.1)` : "transparent" }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = `rgba(${hexToRgb(p.accentColor)},0.12)`)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = isMe ? `rgba(${hexToRgb(p.accentColor)},0.1)` : "transparent")}
                              >
                                <span className="relative shrink-0 block">
                                  <UserAvatar profile={p} size={22} />
                                  <span
                                    className="absolute bottom-0 right-0 w-2 h-2 rounded-full border"
                                    style={{ background: online ? "#4ade80" : "#374151", borderColor: "#060810" }}
                                  />
                                </span>
                                <span className="text-[11px] font-semibold" style={{ color: p.accentColor }}>
                                  {p.displayName}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign out of TGV Office"
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all"
              style={{
                color: "rgba(255,78,203,0.6)",
                border: "1px solid rgba(255,78,203,0.2)",
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#ff4ecb";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,78,203,0.1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "rgba(255,78,203,0.6)";
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <span>⏏</span>
              <span>Sign out</span>
            </button>
          </div>
        </nav>
      </header>

      {/* ── Center drawer tab — hides / restores nav ──────────────────────── */}
      <button
        onClick={() => setHidden((p) => !p)}
        title={hidden ? "Show navigation" : "Hide navigation"}
        className="fixed left-1/2 z-[49] flex items-center gap-1.5 transition-all"
        style={{
          top: hidden ? 0 : navH,
          transform: "translateX(-50%)",
          background: "rgba(255,78,203,0.12)",
          border: "1px solid rgba(255,78,203,0.35)",
          borderTop: hidden ? "1px solid rgba(255,78,203,0.35)" : "none",
          borderRadius: hidden ? "0 0 10px 10px" : "0 0 10px 10px",
          padding: "4px 14px",
          color: "#ff4ecb",
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          backdropFilter: "blur(8px)",
          transition: "top 0.3s cubic-bezier(0.4,0,0.2,1), background 0.2s",
          boxShadow: "0 4px 20px rgba(255,78,203,0.15)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,78,203,0.22)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,78,203,0.12)";
        }}
      >
        <svg
          width="8" height="8" viewBox="0 0 8 8" fill="#ff4ecb"
          style={{ transform: hidden ? "rotate(180deg)" : "none", transition: "transform 0.3s" }}
        >
          <path d="M4 2L7.5 6.5H0.5L4 2Z" />
        </svg>
        <span>{hidden ? "TGV Office" : "Hide"}</span>
        <svg
          width="8" height="8" viewBox="0 0 8 8" fill="#ff4ecb"
          style={{ transform: hidden ? "rotate(180deg)" : "none", transition: "transform 0.3s" }}
        >
          <path d="M4 2L7.5 6.5H0.5L4 2Z" />
        </svg>
      </button>

      {/* Profile modal opened from nav chip */}
      {openProfile && myProfile && (
        <ProfileModal
          profile={openProfile}
          profiles={profiles}
          memos={memos}
          pings={pings}
          currentUser={currentUser}
          onClose={() => setOpenProfile(null)}
          onRefresh={loadUserData}
        />
      )}

    </>
  );
}

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
