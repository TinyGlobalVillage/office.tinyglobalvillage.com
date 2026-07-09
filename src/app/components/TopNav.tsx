"use client";
// Office TopNav — now a thin host wrapper around the canonical library TgvNav
// (@tgv/module-component-library/domains/navigation/components/TgvNav), which
// was lifted FROM this file (worktree-tgv-nav, 2026-07-08). Office-specific
// concerns stay here: the office BalloonSVG identity, the pink accent, the
// nav/tool menu items, the presence-chip roster, LDM, sign-out, and the
// ProfileModal. Layout, the balloon menu, back/forward history (built-in,
// ⌘R/⌘U), and the "Hide Menu"/"Show Menu" tab are the library's.

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styled from "styled-components";
import TgvNav, {
  type TgvNavSection,
} from "@tgv/module-component-library/domains/navigation/components/TgvNav";
import ProfileModal, { type Profile, type Memo, type Ping } from "./ProfileModal";
import { UserAvatar } from "./ChatSettingsModal";
import { signOut } from "next-auth/react";
import { clearAllDrawerState } from "../lib/drawerPersist";
import LDM from "./LDM";
import { colors, rgb } from "@/app/theme";
import { MembersIcon } from "./icons";

const navLinks = [
  { label: "Dashboard", href: "/dashboard" },
];

type ModalLink = { label: string; glow: keyof typeof colors; event?: string; drawer?: string; href?: string };

const modalLinks: ModalLink[] = [
  { label: "Alerts", drawer: "alerts", glow: "gold" },
  { label: "Chats", drawer: "chat", glow: "green" },
  { label: "Claude", event: "open-claude", glow: "orange" },
  { label: "Database", href: "/dashboard/database", glow: "gold" },
  { label: "Deploy", href: "/dashboard/deploy", glow: "pink" },
  { label: "Editor", href: "/dashboard/editor", glow: "gold" },
  { label: "Inbox", drawer: "inbox", glow: "cyan" },
  { label: "Library", event: "open-library", glow: "violet" },
  { label: "Logs", event: "open-activity", glow: "cyan" },
  { label: "Processes", href: "/dashboard/processes", glow: "cyan" },
  { label: "Sandbox", event: "open-sandbox", glow: "pink" },
  { label: "Sessions", drawer: "sessions", glow: "pink" },
  { label: "Storage", href: "/dashboard/storage", glow: "pink" },
  { label: "Utils", href: "/dashboard/utils", glow: "cyan" },
  { label: "Suggest", event: "open-suggestion", glow: "pink" },
];

export function BalloonSVG({ size = 30 }: { size?: number }) {
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

/* ── Styled (office-local bar-end widgets) ─────────────────────── */

const NAV_BTN_HEIGHT = "2rem";

const DesktopOnly = styled.span`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  @media (max-width: 560px) { display: none; }
`;

const ChipBtn = styled.button<{ $accent: string; $isMe?: boolean }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${NAV_BTN_HEIGHT};
  height: ${NAV_BTN_HEIGHT};
  padding: 0;
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
  height: ${NAV_BTN_HEIGHT};
  padding: 0 0.625rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.3125rem;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  background: ${(p) => (p.$open ? `rgba(${rgb.pink}, 0.25)` : `rgba(${rgb.pink}, 0.08)`)};
  border: 1px solid rgba(${rgb.pink}, 0.4);
  color: ${colors.pink};

  &:hover {
    background: rgba(${rgb.pink}, 0.22);
  }
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
  justify-content: center;
  gap: 0.375rem;
  height: ${NAV_BTN_HEIGHT};
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0 0.75rem;
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

/* ── Component ─────────────────────────────────────────────────── */

function TopNavInner() {
  const searchParams = useSearchParams();
  const embedded = searchParams?.get("embedded") === "1";
  const popout = searchParams?.get("popout") === "1";

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

  const myProfile = profiles.find((p) => p.username === currentUser);

  const sorted = [...profiles].sort((a, b) => {
    const pa = presence.find((pr) => pr.sysUser === a.username);
    const pb = presence.find((pr) => pr.sysUser === b.username);
    if (pa?.online && !pb?.online) return -1;
    if (!pa?.online && pb?.online) return 1;
    return (pa?.onlineSinceMs ?? 0) - (pb?.onlineSinceMs ?? 0);
  });

  const onlineProfiles = sorted.filter((p) => {
    const pres = presence.find((pr) => pr.sysUser === p.username);
    return pres?.online ?? false;
  });
  const showOverflow = onlineProfiles.length > 2;
  const visibleChips = showOverflow ? [] : onlineProfiles;
  const overflowUsers = showOverflow ? onlineProfiles : [];

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
          <UserAvatar profile={p} size={26} />
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

  // Menu content: the Dashboard link, then every office tool (former modalLinks)
  // — drawers/modals dispatch their window events, pages navigate.
  const sections: TgvNavSection[] = [
    {
      key: "nav",
      items: navLinks.map((l) => ({ label: l.label, href: l.href })),
    },
    {
      key: "tools",
      items: modalLinks.map((ml) => ({
        label: ml.label,
        href: ml.href,
        accent: colors[ml.glow],
        onSelect: ml.href
          ? undefined
          : () => {
              if (ml.drawer) {
                window.dispatchEvent(new CustomEvent("tgv-drawer-open", { detail: ml.drawer }));
              } else if (ml.event) {
                window.dispatchEvent(new CustomEvent(ml.event));
              }
            },
      })),
    },
  ];

  return (
    <>
      <TgvNav
        context="dashboard"
        balloon={BalloonSVG}
        sections={sections}
        accent={colors.pink}
        accentRgb={rgb.pink}
        maxWidth="80rem"
        suppress={embedded || popout}
        rightSlot={
          <>
            {visibleChips.map(renderChip)}
            {showOverflow && (
              <div ref={overflowRef} style={{ position: "relative" }}>
                <OverflowBtn
                  $open={overflowOpen}
                  onClick={() => setOverflowOpen((p) => !p)}
                  title={`${overflowUsers.length} user${overflowUsers.length !== 1 ? "s" : ""} online`}
                >
                  <MembersIcon size={12} />
                  <span>{overflowUsers.length}</span>
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
            <LDM size={32} />
            <SignOutBtn onClick={() => { clearAllDrawerState(); signOut({ callbackUrl: "/login" }); }} title="Sign out of TGV Office">
              <span>⏏</span>
              <DesktopOnly>Sign out</DesktopOnly>
            </SignOutBtn>
          </>
        }
      />

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

export default function TopNav() {
  return (
    <Suspense fallback={null}>
      <TopNavInner />
    </Suspense>
  );
}
