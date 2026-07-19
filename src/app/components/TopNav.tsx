"use client";
// Office TopNav — now a thin host wrapper around the canonical library TgvNav
// (@tgv/module-component-library/domains/navigation/components/TgvNav), which
// was lifted FROM this file (worktree-tgv-nav, 2026-07-08). Office-specific
// concerns stay here: the pink accent, the
// nav/tool menu items, back/forward history arrows, the presence-chip roster,
// LDM, sign-out, and the ProfileModal. Layout, the balloon menu, and the
// "Hide Menu"/"Show Menu" tab are the library's.

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styled from "styled-components";
import TgvNav, {
  type TgvNavSection,
} from "@tgv/module-component-library/domains/navigation/components/TgvNav";
import ProfileModal, { type Profile, type Memo, type Ping } from "./ProfileModal";
import { UserAvatar } from "./ChatSettingsModal";
import { signOut } from "next-auth/react";
import { useNavHistory } from "./useNavHistory";
import { clearAllDrawerState } from "../lib/drawerPersist";
import LDM from "./LDM";
import { colors, rgb } from "@/app/theme";
import { MembersIcon } from "./icons";
import { OFFICE_TILES, dispatchTileAction, tileHref } from "./dashboardTiles";

const navLinks = [
  { label: "Dashboard", href: "/dashboard" },
];

// The "tools" Menu section is DERIVED from the dashboard tile registry —
// add a tile in dashboardTiles.tsx and it shows up here automatically.
// Alphabetical, Suggest pinned last (mirrors the tile grid's sort).
const menuTools = OFFICE_TILES.filter((t) => t.inMenu !== false)
  .slice()
  .sort((a, b) => {
    if (a.key === "Suggest") return 1;
    if (b.key === "Suggest") return -1;
    return (a.menuLabel ?? a.title).localeCompare(b.menuLabel ?? b.title);
  });

// The office BalloonSVG that used to live here IS the canon TgvBalloon as of
// 2026-07-19 — same artwork, now with a neon-tinted basket + ropes and the
// idle wiggle. TgvNav's default mark is that component, so Office stopped
// passing a `balloon` override rather than keeping a second copy in drift.
// (public/favicon.svg still carries its own inline copy — static asset.)

/* ── Styled (office-local bar-end widgets) ─────────────────────── */

const NAV_BTN_HEIGHT = "2rem";

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

  // Menu content: the Dashboard link, then every office tool straight from
  // the tile registry — drawers/modals dispatch their window events, pages navigate.
  const sections: TgvNavSection[] = [
    {
      key: "nav",
      items: navLinks.map((l) => ({ label: l.label, href: l.href })),
    },
    {
      key: "tools",
      items: menuTools.map((t) => {
        const href = tileHref(t.action);
        return {
          label: t.menuLabel ?? t.title,
          href,
          accent: colors[t.glow],
          onSelect: href ? undefined : () => dispatchTileAction(t.action),
        };
      }),
    },
  ];

  return (
    <>
      <TgvNav
        context="dashboard"
        sections={sections}
        accent={colors.pink}
        accentRgb={rgb.pink}
        maxWidth="80rem"
        suppress={embedded || popout}
        leftSlot={
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <ArrowBtn onClick={back} disabled={!canBack} title="Back (⌘[ / Alt+←)">‹</ArrowBtn>
            <ArrowBtn onClick={forward} disabled={!canForward} title="Forward (⌘] / Alt+→)">›</ArrowBtn>
          </div>
        }
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
