"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styled from "styled-components";
import ProfileModal, { type Profile, type Memo, type Ping } from "./ProfileModal";
import { UserAvatar } from "./ChatSettingsModal";
import { signOut } from "next-auth/react";
import { useNavHistory } from "./useNavHistory";
import LDM from "./LDM";
import { colors, rgb } from "@/app/theme";

const navLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Deploy", href: "/dashboard/deploy" },
  { label: "Processes", href: "/dashboard/processes" },
  { label: "Storage", href: "/dashboard/storage" },
  { label: "Editor", href: "/dashboard/editor" },
  { label: "Database", href: "/dashboard/database" },
  { label: "Email", href: "/dashboard/email" },
  { label: "Utils", href: "/dashboard/utils" },
];

const modalLinks = [
  { label: "Claude", event: "open-claude", glow: "orange" },
  { label: "Sandbox", event: "open-sandbox", glow: "pink" },
  { label: "Library", event: "open-library", glow: "violet" },
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

/* ── Styled ────────────────────────────────────────────────────── */

const HeaderWrap = styled.header<{ $scrolled?: boolean; $hidden?: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  padding: 0.75rem 1rem 0.5rem;
  background: ${(p) => (p.$scrolled ? "rgba(0,0,0,0.92)" : "transparent")};
  transform: ${(p) => (p.$hidden ? "translateY(-110%)" : "translateY(0)")};
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s;

  [data-theme="light"] & {
    background: ${(p) => (p.$scrolled ? "rgba(248,246,243,0.92)" : "transparent")};
  }
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 1.25rem;
  max-width: 80rem;
  margin: 0 auto;
  border-radius: 1rem;
  background: rgba(${rgb.pink}, 0.03);
  border: 1px solid rgba(${rgb.pink}, 0.12);

  [data-theme="light"] & {
    background: rgba(${rgb.pink}, 0.02);
    border-color: rgba(${rgb.pink}, 0.08);
  }
`;

const LeftGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
`;

const ArrowBtn = styled.button`
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
  background: rgba(${rgb.pink}, 0.06);
  border: 1px solid rgba(${rgb.pink}, 0.22);
  color: ${colors.pink};

  &:hover {
    background: rgba(${rgb.pink}, 0.18);
  }

  &:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }
`;

const DDMTrigger = styled.button<{ $open?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  cursor: pointer;
  transition: all 0.15s;
  background: ${(p) => (p.$open ? `rgba(${rgb.pink}, 0.25)` : `rgba(${rgb.pink}, 0.08)`)};
  border: 1px solid rgba(${rgb.pink}, 0.35);
  color: ${colors.pink};

  &:hover {
    background: rgba(${rgb.pink}, 0.22);
  }
`;

const DDMMenu = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.5rem;
  border-radius: 0.75rem;
  overflow: hidden;
  z-index: 50;
  min-width: 180px;
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.pink}, 0.25);
  box-shadow: 0 8px 40px rgba(${rgb.pink}, 0.12), 0 4px 20px rgba(0, 0, 0, 0.7);

  [data-theme="light"] & {
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
  }
`;

const DDMLink = styled(Link)<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  text-decoration: none;
  transition: all 0.15s;
  color: ${(p) => (p.$active ? colors.pink : "var(--t-textFaint)")};
  background: ${(p) => (p.$active ? `rgba(${rgb.pink}, 0.1)` : "transparent")};
  border-bottom: 1px solid rgba(${rgb.pink}, 0.08);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    color: ${colors.pink};
    background: rgba(${rgb.pink}, 0.07);
  }
`;

const DDMDivider = styled.div`
  height: 1px;
  margin: 0.25rem 0;
  background: var(--t-border);
`;

const DDMBtn = styled.button<{ $glow?: string }>`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.375rem 0.75rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  color: ${(p) => p.$glow || "var(--t-textMuted)"};

  &:hover {
    background: var(--t-inputBg);
  }
`;

const RightGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
`;

const MobileOnly = styled.span`
  display: none;
  align-items: center;
  @media (max-width: 560px) { display: flex; }
`;

const DesktopOnly = styled.span`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  @media (max-width: 560px) { display: none; }
`;

const ChipBtn = styled.button<{ $accent: string; $isMe?: boolean }>`
  position: relative;
  padding: 0.125rem;
  border-radius: 50%;
  border: none;
  background: none;
  cursor: pointer;
  transition: all 0.15s;
  outline: 2px solid ${(p) => (p.$isMe ? `${p.$accent}66` : "transparent")};
`;

const PresenceDot = styled.span<{ $online?: boolean }>`
  position: absolute;
  bottom: 0;
  right: 0;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  border: 1px solid var(--t-bg);
  background: ${(p) => (p.$online ? colors.green : "#374151")};
  box-shadow: ${(p) => (p.$online ? `0 0 4px ${colors.green}` : "none")};
`;

const PingBadge = styled.span<{ $accent: string }>`
  position: absolute;
  top: -0.375rem;
  right: -0.375rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5rem;
  font-weight: 700;
  background: ${(p) => p.$accent};
  color: var(--t-bg);
  box-shadow: 0 0 6px ${(p) => p.$accent};
`;

const OverflowBtn = styled.button<{ $open?: boolean }>`
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5625rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  background: ${(p) => (p.$open ? `rgba(${rgb.pink}, 0.25)` : "var(--t-inputBg)")};
  border: 1px solid rgba(${rgb.pink}, 0.4);
  color: ${colors.pink};
`;

const OverflowMenu = styled.div`
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border-radius: 0.75rem;
  padding: 0.5rem;
  z-index: 200;
  min-width: 160px;
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.pink}, 0.2);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);

  [data-theme="light"] & {
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
  }
`;

const OverflowItem = styled.button<{ $accent: string; $isMe?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: 0.5rem;
  transition: all 0.15s;
  text-align: left;
  width: 100%;
  border: none;
  cursor: pointer;
  background: ${(p) => (p.$isMe ? `rgba(${hexToRgb(p.$accent)}, 0.1)` : "transparent")};

  &:hover {
    background: rgba(${(p) => hexToRgb(p.$accent)}, 0.12);
  }
`;

const OverflowName = styled.span<{ $accent: string }>`
  font-size: 0.6875rem;
  font-weight: 600;
  color: ${(p) => p.$accent};
`;

const SignOutBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.25rem 0.625rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s;
  color: rgba(${rgb.pink}, 0.6);
  border: 1px solid rgba(${rgb.pink}, 0.2);
  background: transparent;

  &:hover {
    color: ${colors.pink};
    background: rgba(${rgb.pink}, 0.1);
  }
`;

const DrawerTab = styled.button<{ $hidden?: boolean; $navH: number }>`
  position: fixed;
  left: 50%;
  z-index: 49;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  transform: translateX(-50%);
  top: ${(p) => (p.$hidden ? "0px" : `${p.$navH}px`)};
  padding: 4px 14px;
  border-radius: 0 0 10px 10px;
  border: 1px solid rgba(${rgb.pink}, 0.35);
  border-top: ${(p) => (p.$hidden ? `1px solid rgba(${rgb.pink}, 0.35)` : "none")};
  background: rgba(${rgb.pink}, 0.12);
  color: ${colors.pink};
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: top 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s;
  box-shadow: 0 4px 20px rgba(${rgb.pink}, 0.15);

  &:hover {
    background: rgba(${rgb.pink}, 0.22);
  }
`;

/* ── Component ───────────��─────────────────────────────────────── */

export default function TopNav() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navH, setNavH] = useState(0);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const { canBack, canForward, back, forward } = useNavHistory();

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
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadUserData();
    const id = setInterval(loadUserData, 30_000);
    return () => clearInterval(id);
  }, []);

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

  useEffect(() => {
    // --nav-offset = total space to leave above page content.
    // Includes navbar height + hide toggle pill + breathing gap (56px covers all three).
    const CLEARANCE = 56;
    document.documentElement.style.setProperty(
      "--nav-offset",
      hidden ? `${CLEARANCE}px` : `${navH + CLEARANCE}px`
    );
    document.documentElement.classList.toggle("nav-hidden", hidden);
  }, [hidden, navH]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const currentPage = navLinks.find((l) => l.href === pathname)?.label ?? "Navigate";
  const myProfile = profiles.find((p) => p.username === currentUser);

  const sorted = [...profiles].sort((a, b) => {
    const pa = presence.find((pr) => pr.sysUser === a.username);
    const pb = presence.find((pr) => pr.sysUser === b.username);
    if (pa?.online && !pb?.online) return -1;
    if (!pa?.online && pb?.online) return 1;
    return (pa?.onlineSinceMs ?? 0) - (pb?.onlineSinceMs ?? 0);
  });

  const onlineCount = presence.filter((pr) => pr.online).length;
  const showOverflow = onlineCount > 3;
  const visibleChips = showOverflow ? sorted.slice(0, 3) : sorted;
  const overflowUsers = showOverflow ? sorted.slice(3) : [];

  const renderChip = (p: Profile) => {
    const isMe = p.username === currentUser;
    const myPingCount = isMe ? unreadPings : 0;
    const pres = presence.find((pr) => pr.sysUser === p.username);
    const online = pres?.online ?? false;
    return (
      <ChipBtn
        key={p.username}
        $accent={p.accentColor}
        $isMe={isMe}
        onClick={() => setOpenProfile(p)}
        title={`${p.displayName}${myPingCount > 0 ? ` · ${myPingCount} unread ping${myPingCount !== 1 ? "s" : ""}` : ""}`}
      >
        <span style={{ position: "relative", display: "block", flexShrink: 0 }}>
          <UserAvatar profile={p} size={20} />
          <PresenceDot $online={online} />
        </span>
        {myPingCount > 0 && (
          <PingBadge $accent={p.accentColor}>
            {myPingCount > 9 ? "9+" : myPingCount}
          </PingBadge>
        )}
      </ChipBtn>
    );
  };

  return (
    <>
      <HeaderWrap ref={headerRef} $scrolled={scrolled} $hidden={hidden}>
        <Nav>
          <LeftGroup>
            <Link href="/dashboard" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              <BalloonSVG size={28} />
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <ArrowBtn onClick={back} disabled={!canBack} title="Back (⌘[ / Alt+←)">‹</ArrowBtn>
              <ArrowBtn onClick={forward} disabled={!canForward} title="Forward (⌘] / Alt+→)">›</ArrowBtn>
            </div>
            <div ref={menuRef} style={{ position: "relative" }}>
              <DDMTrigger $open={menuOpen} onClick={() => setMenuOpen((p) => !p)}>
                <MobileOnly>
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
                    <rect x="0" y="0" width="14" height="1.5" rx="0.75"/>
                    <rect x="0" y="4.25" width="14" height="1.5" rx="0.75"/>
                    <rect x="0" y="8.5" width="14" height="1.5" rx="0.75"/>
                  </svg>
                </MobileOnly>
                <DesktopOnly>
                  <span>{currentPage}</span>
                  <svg
                    width="8" height="8" viewBox="0 0 8 8" fill="currentColor"
                    style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
                  >
                    <path d="M4 6L0.5 1.5h7L4 6z" />
                  </svg>
                </DesktopOnly>
              </DDMTrigger>
              {menuOpen && (
                <DDMMenu>
                  {navLinks.map((link) => {
                    const active = pathname === link.href;
                    return (
                      <DDMLink key={link.href} href={link.href} $active={active}>
                        {active && <span style={{ color: colors.pink, fontSize: 7 }}>●</span>}
                        {link.label}
                      </DDMLink>
                    );
                  })}
                  <DDMDivider />
                  {modalLinks.map((ml) => (
                    <DDMBtn
                      key={ml.event}
                      $glow={colors[ml.glow as keyof typeof colors]}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent(ml.event));
                        setMenuOpen(false);
                      }}
                    >
                      {ml.label}
                    </DDMBtn>
                  ))}
                </DDMMenu>
              )}
            </div>
          </LeftGroup>

          <RightGroup>
            {visibleChips.map(renderChip)}
            {showOverflow && (
              <div ref={overflowRef} style={{ position: "relative" }}>
                <OverflowBtn
                  $open={overflowOpen}
                  onClick={() => setOverflowOpen((p) => !p)}
                  title={`${overflowUsers.length} more user${overflowUsers.length !== 1 ? "s" : ""} online`}
                >
                  +{overflowUsers.length}
                </OverflowBtn>
                {overflowOpen && (
                  <OverflowMenu>
                    {overflowUsers.map((p) => {
                      const isMe = p.username === currentUser;
                      const pres = presence.find((pr) => pr.sysUser === p.username);
                      const online = pres?.online ?? false;
                      return (
                        <OverflowItem
                          key={p.username}
                          $accent={p.accentColor}
                          $isMe={isMe}
                          onClick={() => { setOpenProfile(p); setOverflowOpen(false); }}
                        >
                          <span style={{ position: "relative", display: "block", flexShrink: 0 }}>
                            <UserAvatar profile={p} size={22} />
                            <PresenceDot $online={online} />
                          </span>
                          <OverflowName $accent={p.accentColor}>{p.displayName}</OverflowName>
                        </OverflowItem>
                      );
                    })}
                  </OverflowMenu>
                )}
              </div>
            )}
            <LDM size={28} />
            <SignOutBtn onClick={() => signOut({ callbackUrl: "/login" })} title="Sign out of TGV Office">
              <span>⏏</span>
              <DesktopOnly>Sign out</DesktopOnly>
            </SignOutBtn>
          </RightGroup>
        </Nav>
      </HeaderWrap>

      <DrawerTab $hidden={hidden} $navH={navH} onClick={() => setHidden((p) => !p)} title={hidden ? "Show navigation" : "Hide navigation"}>
        <svg
          width="8" height="8" viewBox="0 0 8 8" fill={colors.pink}
          style={{ transform: hidden ? "rotate(180deg)" : "none", transition: "transform 0.3s" }}
        >
          <path d="M4 2L7.5 6.5H0.5L4 2Z" />
        </svg>
        <span>{hidden ? "TGV Office" : "Hide"}</span>
        <svg
          width="8" height="8" viewBox="0 0 8 8" fill={colors.pink}
          style={{ transform: hidden ? "rotate(180deg)" : "none", transition: "transform 0.3s" }}
        >
          <path d="M4 2L7.5 6.5H0.5L4 2Z" />
        </svg>
      </DrawerTab>

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
