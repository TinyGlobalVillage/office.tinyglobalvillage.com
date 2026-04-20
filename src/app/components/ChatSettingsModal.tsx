"use client";

import { useState, useEffect, useRef, useCallback, ChangeEvent, ReactNode } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import { ModalBackdrop, CloseBtn, PillButton } from "@/app/styled";
import NeonX from "./NeonX";
import { hexToRgb } from "./ProfileModal";
import { useTheme } from "./ThemeProvider";
import { TrashIcon } from "./icons";
import { signOut } from "next-auth/react";
import { useModalLifecycle, getAutoHide, setAutoHide } from "@/app/lib/drawerKnobs";

/* ── Types ─────────────────────────────────────────────────────── */

export type UserRole = "admin" | "employee";

export type MemberProfile = {
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
  accentColor: string;
  darkAccent?: string;
  lightAccent?: string;
  title: string;
  bio?: string;
};

export type ChatSettings = {
  showTimestamps: boolean;
  timestampFormat: "relative" | "time" | "datetime";
  timezone: string;
  fontSize: "xs" | "sm" | "base";
  myFont: string;
  whisperModel?: "tiny.en" | "base.en" | "small.en" | "medium.en" | "large-v3-turbo";
  // Notifications
  soundOnMessage?: boolean;
  desktopNotifications?: boolean;
  mentionsOnly?: boolean;
  // Privacy
  sendReadReceipts?: boolean;
  showOnlineStatus?: boolean;
  sendTypingIndicators?: boolean;
};

export const WHISPER_MODELS: { label: string; value: NonNullable<ChatSettings["whisperModel"]>; note?: string }[] = [
  { label: "Tiny.en",       value: "tiny.en",          note: "fastest" },
  { label: "Base.en",       value: "base.en",          note: "balanced" },
  { label: "Small.en",      value: "small.en",         note: "more accurate" },
  { label: "Medium.en",     value: "medium.en" },
  { label: "Large v3 turbo", value: "large-v3-turbo",  note: "highest quality" },
];

const TS_FORMATS: { label: string; value: ChatSettings["timestampFormat"] }[] = [
  { label: "Relative (just now)", value: "relative" },
  { label: "Time (3:42 PM)", value: "time" },
  { label: "Full (Apr 15, 3:42)", value: "datetime" },
];

// Common IANA zones + "auto" (resolves to the browser's local zone).
export const TIMEZONES: { label: string; value: string }[] = [
  { label: "Auto (device)", value: "auto" },
  { label: "UTC", value: "UTC" },
  { label: "Eastern · New York", value: "America/New_York" },
  { label: "Central · Chicago", value: "America/Chicago" },
  { label: "Mountain · Denver", value: "America/Denver" },
  { label: "Pacific · Los Angeles", value: "America/Los_Angeles" },
  { label: "Alaska · Anchorage", value: "America/Anchorage" },
  { label: "Hawaii · Honolulu", value: "Pacific/Honolulu" },
  { label: "São Paulo", value: "America/Sao_Paulo" },
  { label: "London", value: "Europe/London" },
  { label: "Paris / Berlin", value: "Europe/Paris" },
  { label: "Athens", value: "Europe/Athens" },
  { label: "Cairo", value: "Africa/Cairo" },
  { label: "Dubai", value: "Asia/Dubai" },
  { label: "Mumbai", value: "Asia/Kolkata" },
  { label: "Bangkok", value: "Asia/Bangkok" },
  { label: "Singapore", value: "Asia/Singapore" },
  { label: "Shanghai / Beijing", value: "Asia/Shanghai" },
  { label: "Tokyo", value: "Asia/Tokyo" },
  { label: "Sydney", value: "Australia/Sydney" },
];

export function resolveTimezone(tz: string): string | undefined {
  if (!tz || tz === "auto") return undefined; // let Intl fall back to system
  return tz;
}
const FONT_SIZES: { label: string; value: ChatSettings["fontSize"] }[] = [
  { label: "Small", value: "xs" },
  { label: "Normal", value: "sm" },
  { label: "Large", value: "base" },
];
const FONTS = [
  { label: "Sans", value: "sans", css: "sans-serif" },
  { label: "Mono", value: "mono", css: "monospace" },
  { label: "Serif", value: "serif", css: "serif" },
];

const MEMBERS_PER_PAGE = 5;

const NEON_DARK = [
  colors.pink,      // hot magenta
  colors.cyan,      // electric cyan
  colors.gold,      // neon gold
  colors.orange,    // neon orange
  colors.violet,    // neon violet
  colors.green,     // neon green
  colors.red,       // neon red
  "#ff00aa",        // fuchsia
  "#00ffcc",        // mint / aqua
  "#d4ff00",        // chartreuse / lime
  "#00d4ff",        // sky cyan
  "#ff6b6b",        // coral
  "#a855f7",        // amethyst
  "#38bdf8",        // neon sky blue
];
const NEON_LIGHT = [
  "#d6336c",        // hot pink
  "#1971c2",        // blue
  "#c08400",        // gold
  "#c04820",        // orange
  "#7048e8",        // violet
  "#2b8a3e",        // green
  "#c92a2a",        // red
  "#b0006e",        // fuchsia
  "#007a6b",        // teal
  "#a09000",        // chartreuse
  "#0077aa",        // sky
  "#b43030",        // coral
  "#7e22ce",        // amethyst
  "#0284c7",        // sky blue
];

/* ── Styled ────────────────────────────────────────────────────── */

const Backdrop = styled(ModalBackdrop)`
  z-index: 80;
  padding: 0;
`;

const Modal = styled.div`
  position: fixed;
  z-index: 81;
  display: flex;
  flex-direction: column;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(96vw, 520px);
  max-height: 85vh;
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.pink}, 0.2);
  border-radius: 20px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.85), 0 0 40px rgba(${rgb.pink}, 0.08);

  [data-theme="light"] & {
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.12), 0 0 40px rgba(${rgb.pink}, 0.04);
  }

  @media (max-width: 768px) {
    top: 0;
    left: 0;
    transform: none;
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--t-border);
`;

const TabGroup = styled.div`
  display: flex;
  align-items: center;
  border-radius: 9999px;
  padding: 0.125rem;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);
`;

const TabBtn = styled.button<{ $active?: boolean }>`
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.pink}, 0.4)` : "transparent")};
  background: ${(p) => (p.$active ? `rgba(${rgb.pink}, 0.2)` : "transparent")};
  color: ${(p) => (p.$active ? colors.pink : "var(--t-textFaint)")};
  cursor: pointer;
  transition: all 0.15s;
`;

const CountBadge = styled.span`
  font-size: 0.5625rem;
  font-weight: 700;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background: rgba(${rgb.pink}, 0.12);
  border: 1px solid rgba(${rgb.pink}, 0.3);
  color: ${colors.pink};
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  scrollbar-width: thin;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const SectionLabel = styled.p`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--t-textFaint);
  margin: 0 0 0.75rem;
`;

const Divider = styled.div`
  width: 100%;
  height: 1px;
  background: var(--t-border);
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
`;

const ToggleLabel = styled.span`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
`;

const Toggle = styled.button<{ $on?: boolean }>`
  position: relative;
  display: inline-block;
  width: 28px;
  height: 14px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.pink}, 0.7)` : "var(--t-borderStrong)")};
  background: ${(p) => (p.$on ? `rgba(${rgb.pink}, 0.2)` : "var(--t-inputBg)")};
  box-shadow: ${(p) => (p.$on ? `0 0 8px rgba(${rgb.pink}, 0.45)` : "none")};
  cursor: pointer;
  transition: all 0.18s;
  flex-shrink: 0;
`;

const ToggleThumb = styled.span<{ $on?: boolean }>`
  position: absolute;
  top: 1px;
  left: ${(p) => (p.$on ? "15px" : "1px")};
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(p) => (p.$on ? colors.pink : "var(--t-textFaint)")};
  box-shadow: ${(p) =>
    p.$on
      ? `0 0 8px rgba(${rgb.pink}, 0.85), 0 0 2px rgba(${rgb.pink}, 1)`
      : "0 1px 2px rgba(0,0,0,0.3)"};
  transition: all 0.18s;
`;

const RadioBtn = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.6875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  border: none;
  transition: all 0.15s;
  text-align: left;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.pink}, 0.1)` : "transparent")};
  color: ${(p) => (p.$active ? colors.pink : "var(--t-textFaint)")};
`;

const RadioCircle = styled.span<{ $active?: boolean }>`
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 1px solid ${(p) => (p.$active ? colors.pink : "var(--t-textGhost)")};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const RadioDot = styled.span`
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background: ${colors.pink};
`;

const OptionGrid = styled.div`
  display: flex;
  gap: 0.25rem;
`;

const OptionBtn = styled.button<{ $active?: boolean }>`
  flex: 1;
  padding: 0.25rem;
  border-radius: 0.5rem;
  font-size: 0.625rem;
  transition: all 0.15s;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.pink}, 0.15)` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.pink}, 0.5)` : "var(--t-borderStrong)")};
  color: ${(p) => (p.$active ? colors.pink : "var(--t-textFaint)")};
`;

const SubLabel = styled.p`
  font-size: 0.625rem;
  color: var(--t-textFaint);
  margin: 0 0 0.25rem;
`;

/* ── Tile card + per-subsetting ECL ────────────────────────────── */

const TileRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
`;

const Tile = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  border-radius: 8px;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);
`;

const TileHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const TileLabel = styled.span`
  flex: 1;
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--t-textFaint);
`;

const TileBody = styled.div<{ $open: boolean }>`
  display: ${(p) => (p.$open ? "flex" : "none")};
  flex-direction: column;
  gap: 0.25rem;
`;

const TzSelect = styled.select`
  width: 100%;
  padding: 0.375rem 0.5rem;
  font-size: 0.6875rem;
  border-radius: 0.5rem;
  background: var(--t-surface, rgba(255,255,255,0.03));
  border: 1px solid var(--t-borderStrong);
  color: var(--t-text);
  outline: none;
  cursor: pointer;

  &:focus { border-color: rgba(${rgb.pink}, 0.5); }
`;

const EclSwitchTrack = styled.span<{ $on: boolean }>`
  position: relative;
  display: inline-block;
  width: 28px;
  height: 14px;
  border-radius: 999px;
  background: ${(p) => (p.$on ? `rgba(${rgb.pink}, 0.2)` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.pink}, 0.7)` : "var(--t-borderStrong)")};
  box-shadow: ${(p) => (p.$on ? `0 0 8px rgba(${rgb.pink}, 0.45)` : "none")};
  transition: all 0.18s;
  flex-shrink: 0;
`;

const EclSwitchThumb = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 1px;
  left: ${(p) => (p.$on ? "15px" : "1px")};
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(p) => (p.$on ? colors.pink : "var(--t-textFaint)")};
  box-shadow: ${(p) =>
    p.$on
      ? `0 0 8px rgba(${rgb.pink}, 0.85), 0 0 2px rgba(${rgb.pink}, 1)`
      : "0 1px 2px rgba(0,0,0,0.3)"};
  transition: all 0.18s;
`;

const EclLabel = styled.span`
  font-size: 0.5rem;
  color: var(--t-textGhost);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

function Ecl({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={on ? "Collapse" : "Expand"}
      aria-expanded={on}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      <EclLabel>{on ? "Collapse" : "Expand"}</EclLabel>
      <EclSwitchTrack $on={on}>
        <EclSwitchThumb $on={on} />
      </EclSwitchTrack>
    </button>
  );
}

const AvatarWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const AvatarOverlay = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  opacity: 0;
  transition: opacity 0.15s;

  ${AvatarWrap}:hover & {
    opacity: 1;
  }
`;

const ProfileInput = styled.input<{ $accent?: string }>`
  background: transparent;
  outline: none;
  font-size: 0.75rem;
  color: var(--t-text);
  border-radius: 0.5rem;
  padding: 0.375rem 0.75rem;
  width: 100%;
  border: 1px solid ${(p) => (p.$accent ? `${p.$accent}44` : "var(--t-borderStrong)")};
`;

const ProfileTextarea = styled.textarea`
  background: transparent;
  outline: none;
  font-size: 0.75rem;
  color: var(--t-textMuted);
  border-radius: 0.5rem;
  padding: 0.375rem 0.75rem;
  width: 100%;
  resize: none;
  border: 1px solid var(--t-borderStrong);
`;

const SaveBtn = styled.button<{ $accent: string; $dirty?: boolean }>`
  font-size: 0.625rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  transition: all 0.15s;
  cursor: ${(p) => (p.$dirty ? "pointer" : "default")};
  background: ${(p) => (p.$dirty ? `rgba(${hexToRgb(p.$accent)}, 0.22)` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$dirty ? `${p.$accent}88` : "var(--t-border)")};
  color: ${(p) => (p.$dirty ? p.$accent : "var(--t-textFaint)")};
  box-shadow: ${(p) => (p.$dirty ? `0 0 8px ${p.$accent}44` : "none")};

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const StorageBar = styled.div`
  width: 100%;
  height: 0.375rem;
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 0.75rem;
  background: var(--t-inputBg);
`;

const StorageFill = styled.div<{ $pct: number }>`
  height: 100%;
  border-radius: 9999px;
  transition: all 0.3s;
  width: ${(p) => Math.min(100, p.$pct)}%;
  background: ${(p) => (p.$pct > 80 ? colors.red : p.$pct > 60 ? colors.gold : colors.green)};
`;

const ClearBtn = styled.button`
  width: 100%;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.375rem;
  border-radius: 0.5rem;
  transition: all 0.15s;
  cursor: pointer;
  background: rgba(${rgb.red}, 0.1);
  border: 1px solid rgba(${rgb.red}, 0.3);
  color: ${colors.red};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
`;

const SignOutRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.75rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--t-border);
`;

const SignOutBtn = styled.button`
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.375rem 0.875rem;
  border-radius: 0.5rem;
  transition: all 0.15s;
  cursor: pointer;
  background: rgba(${rgb.red}, 0.12);
  border: 1px solid rgba(${rgb.red}, 0.4);
  color: ${colors.red};
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;

  &:hover {
    background: rgba(${rgb.red}, 0.2);
    border-color: rgba(${rgb.red}, 0.55);
  }
`;

const SearchWrap = styled.div`
  position: relative;
`;

const SearchIcon = styled.span`
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  color: var(--t-textGhost);
`;

const SearchInput = styled.input`
  width: 100%;
  background: transparent;
  outline: none;
  font-size: 0.75rem;
  color: var(--t-textMuted);
  border-radius: 0.75rem;
  padding: 0.5rem 0.75rem 0.5rem 2rem;
  border: 1px solid var(--t-borderStrong);
`;

const SearchClear = styled.button`
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  color: var(--t-textGhost);
  border: none;
  background: none;
  cursor: pointer;

  &:hover {
    color: var(--t-textMuted);
  }
`;

const MemberCard = styled.div<{ $accent?: string; $self?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  background: ${(p) =>
    p.$self ? `rgba(${hexToRgb(p.$accent || colors.pink)}, 0.08)` : "var(--t-inputBg)"};
  border: 1px solid ${(p) => (p.$self ? `${p.$accent || colors.pink}33` : "var(--t-border)")};
`;

const MemberName = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--t-text);
  line-height: 1.2;
`;

const MemberYou = styled.span`
  font-size: 0.5rem;
  color: var(--t-textFaint);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
`;

const MemberEmail = styled.p`
  font-size: 0.625rem;
  color: var(--t-textFaint);
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0.125rem 0 0;
`;

const RoleBadge = styled.span<{ $admin?: boolean }>`
  font-size: 0.5rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  background: ${(p) => (p.$admin ? `rgba(${rgb.gold}, 0.15)` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$admin ? `rgba(${rgb.gold}, 0.4)` : "var(--t-borderStrong)")};
  color: ${(p) => (p.$admin ? colors.gold : "var(--t-textFaint)")};
`;

const RoleSelect = styled.select`
  font-size: 0.625rem;
  border-radius: 0.5rem;
  padding: 0.25rem 0.5rem;
  outline: none;
  cursor: pointer;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);
  color: var(--t-textMuted);
`;

const PagerRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.25rem;
`;

const PagerBtn = styled.button`
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  transition: all 0.15s;
  cursor: pointer;
  background: rgba(${rgb.pink}, 0.1);
  border: 1px solid rgba(${rgb.pink}, 0.3);
  color: ${colors.pink};

  &:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }
`;

const PagerInfo = styled.span`
  font-size: 0.625rem;
  color: var(--t-textFaint);
  font-variant-numeric: tabular-nums;
`;

const ErrorText = styled.p`
  font-size: 0.5625rem;
  color: ${colors.red};
  margin: 0;
`;

const HintText = styled.p`
  font-size: 0.625rem;
  color: var(--t-textGhost);
  margin: 0;
`;

const SavingText = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textFaint);
`;

/* ── Avatar component ──────────────────────────────────────────── */

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

/* ── ADL section (Accordion + Lightswitch) ─────────────────────── */

const ADLWrap = styled.div`
  display: flex;
  flex-direction: column;
`;

const MasterEclRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.25rem 0.625rem 0.5rem;
  margin-bottom: -0.5rem;
`;

const MasterEclLabel = styled.span`
  font-size: 0.5rem;
  color: var(--t-textGhost);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
`;

const ADLHeader = styled.button<{ $open: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.625rem;
  background: ${(p) => (p.$open ? `rgba(${rgb.pink}, 0.05)` : "transparent")};
  border: 1px solid ${(p) => (p.$open ? `rgba(${rgb.pink}, 0.22)` : "var(--t-border)")};
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  color: ${(p) => (p.$open ? colors.pink : "var(--t-textFaint)")};
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  &:hover {
    background: rgba(${rgb.pink}, 0.08);
    border-color: rgba(${rgb.pink}, 0.35);
    color: ${colors.pink};
  }
`;

const ADLLabel = styled.span`
  flex: 1;
`;

const ADLCount = styled.span`
  font-size: 0.5625rem;
  color: rgba(${rgb.pink}, 0.55);
  font-weight: 600;
`;

const ADLSwitchTrack = styled.span<{ $on: boolean }>`
  position: relative;
  display: inline-block;
  width: 28px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.pink}, 0.7)` : "var(--t-borderStrong)")};
  background: ${(p) => (p.$on ? `rgba(${rgb.pink}, 0.2)` : "var(--t-inputBg)")};
  box-shadow: ${(p) => (p.$on ? `0 0 8px rgba(${rgb.pink}, 0.45)` : "none")};
  transition: all 0.18s;
  flex-shrink: 0;
`;

const ADLSwitchThumb = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 1px;
  left: ${(p) => (p.$on ? "15px" : "1px")};
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(p) => (p.$on ? colors.pink : "var(--t-textFaint)")};
  box-shadow: ${(p) =>
    p.$on
      ? `0 0 8px rgba(${rgb.pink}, 0.85), 0 0 2px rgba(${rgb.pink}, 1)`
      : "0 1px 2px rgba(0,0,0,0.3)"};
  transition: all 0.18s;
`;

const ADLBody = styled.div<{ $open: boolean }>`
  display: ${(p) => (p.$open ? "block" : "none")};
  padding: 0.75rem 0 0.25rem;
`;

function ADLSection({
  label,
  count,
  defaultOpen = true,
  saved = false,
  open: openProp,
  onOpenChange,
  children,
}: {
  label: string;
  count?: number;
  defaultOpen?: boolean;
  saved?: boolean;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  children: ReactNode;
}) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const toggle = () => {
    const next = !open;
    if (onOpenChange) onOpenChange(next);
    else setOpenState(next);
  };
  return (
    <ADLWrap>
      <ADLHeader $open={open} aria-expanded={open} onClick={toggle}>
        <ADLLabel>{label}</ADLLabel>
        <PreviewSaved data-visible={saved}>Saved</PreviewSaved>
        {typeof count === "number" && <ADLCount>{count}</ADLCount>}
        <ADLSwitchTrack $on={open} aria-hidden="true">
          <ADLSwitchThumb $on={open} />
        </ADLSwitchTrack>
      </ADLHeader>
      <ADLBody $open={open}>{children}</ADLBody>
    </ADLWrap>
  );
}

/* ── Color palette ─────────────────────────────────────────────── */

const PaletteGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 0.5rem;
`;

const PaletteCol = styled.div<{ $bg: "dark" | "light" }>`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.5rem;
  border-radius: 8px;
  background: ${(p) => (p.$bg === "dark" ? "#0a0a12" : "#f8f6f3")};
  border: 1px solid ${(p) => (p.$bg === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)")};
`;

const PaletteColLabel = styled.span<{ $bg: "dark" | "light" }>`
  font-size: 0.5rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${(p) => (p.$bg === "dark" ? "rgba(255,255,255,0.55)" : "rgba(26,26,46,0.55)")};
`;

const SwatchRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
`;

const Swatch = styled.button<{ $color: string; $selected: boolean }>`
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.12s;
  background: ${(p) => p.$color};
  border: 2px solid
    ${(p) => (p.$selected ? "#ffffff" : "transparent")};
  box-shadow: ${(p) =>
    p.$selected
      ? `0 0 0 1px ${p.$color}, 0 0 8px ${p.$color}`
      : "0 1px 2px rgba(0,0,0,0.4)"};

  &:hover {
    transform: scale(1.12);
  }
`;

const PreviewGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 0.75rem;
`;

const PREVIEW_SIZE_PX: Record<ChatSettings["fontSize"], { name: string; bubble: string }> = {
  xs:   { name: "0.5625rem", bubble: "0.5rem"    },
  sm:   { name: "0.625rem",  bubble: "0.5625rem" },
  base: { name: "0.6875rem", bubble: "0.625rem"  },
};

const FONT_FAMILY_CSS: Record<string, string> = {
  sans: "sans-serif",
  mono: "monospace",
  serif: "serif",
};

const PreviewCard = styled.div<{ $bg: "dark" | "light"; $accent: string; $font?: string }>`
  padding: 0.625rem;
  border-radius: 8px;
  background: ${(p) => (p.$bg === "dark" ? "#0a0a12" : "#f8f6f3")};
  border: 1px solid ${(p) => p.$accent}44;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  font-family: ${(p) => FONT_FAMILY_CSS[p.$font ?? "sans"] ?? "sans-serif"};
`;

const PreviewName = styled.span<{ $accent: string; $size?: ChatSettings["fontSize"] }>`
  font-size: ${(p) => PREVIEW_SIZE_PX[p.$size ?? "sm"].name};
  font-weight: 700;
  color: ${(p) => p.$accent};
`;

const PreviewBubble = styled.div<{ $bg: "dark" | "light"; $accent: string; $size?: ChatSettings["fontSize"] }>`
  align-self: flex-end;
  max-width: 80%;
  padding: 0.25rem 0.5rem;
  font-size: ${(p) => PREVIEW_SIZE_PX[p.$size ?? "sm"].bubble};
  border-radius: 10px 10px 2px 10px;
  background: ${(p) => `${p.$accent}22`};
  border: 1px solid ${(p) => `${p.$accent}55`};
  color: ${(p) => (p.$bg === "dark" ? "rgba(255,255,255,0.85)" : "rgba(26,26,46,0.85)")};
`;

const PreviewSaved = styled.span`
  font-size: 0.5rem;
  color: rgba(74, 222, 128, 0.8);
  opacity: 0;
  transition: opacity 0.2s;

  &[data-visible="true"] {
    opacity: 1;
  }
`;

/* ── Settings tab ──────────────────────────────────────────────── */

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

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const [editName, setEditName] = useState(myProfile?.displayName ?? "");
  const [editEmail, setEditEmail] = useState(myProfile?.email ?? "");
  const [editTitle, setEditTitle] = useState(myProfile?.title ?? "");
  const [editBio, setEditBio] = useState(myProfile?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Per-subsetting ECL open-state
  const [formatOpen, setFormatOpen] = useState(true);
  const [tzOpen, setTzOpen] = useState(true);
  const [fontSizeOpen, setFontSizeOpen] = useState(true);
  const [fontFamilyOpen, setFontFamilyOpen] = useState(true);
  const [accentOpen, setAccentOpen] = useState(true);
  const [storageOpen, setStorageOpen] = useState(true);
  // ADL open-state (controlled, so the master ECL can batch-toggle)
  const ADL_KEYS = ["bio", "appearance", "chatprefs", "interface", "storage", "notifications", "privacy", "talk"] as const;
  type ADLKey = typeof ADL_KEYS[number];
  const [adlOpen, setAdlOpen] = useState<Record<ADLKey, boolean>>({
    bio: true,
    appearance: false,
    chatprefs: false,
    interface: false,
    storage: false,
    notifications: false,
    privacy: false,
    talk: false,
  });
  const [drawerKnobsAutoHide, setDrawerKnobsAutoHide] = useState(false);
  useEffect(() => { setDrawerKnobsAutoHide(getAutoHide()); }, []);
  const setOne = (k: ADLKey) => (next: boolean) => setAdlOpen((s) => ({ ...s, [k]: next }));
  const allOpen = ADL_KEYS.every((k) => adlOpen[k]);
  const toggleAll = () => {
    const next = !allOpen;
    setAdlOpen(ADL_KEYS.reduce((acc, k) => ({ ...acc, [k]: next }), {} as Record<ADLKey, boolean>));
  };

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
      else { onProfileRefresh(); flashSaved("identity"); }
    } finally {
      setSaving(false);
    }
  };

  const accent = myProfile?.accentColor ?? colors.pink;
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const darkAccent = myProfile?.darkAccent ?? (isDark ? accent : NEON_DARK[0]);
  const lightAccent = myProfile?.lightAccent ?? (isDark ? NEON_LIGHT[0] : accent);

  const [savedKey, setSavedKey] = useState<string | null>(null);
  const savedPipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSaved = (key: string) => {
    setSavedKey(key);
    if (savedPipTimer.current) clearTimeout(savedPipTimer.current);
    savedPipTimer.current = setTimeout(() => setSavedKey(null), 1200);
  };

  const setAndFlash = (patch: Partial<ChatSettings>, key: string) => {
    onChange({ ...settings, ...patch });
    flashSaved(key);
  };

  const saveAccent = async (mode: "dark" | "light", color: string) => {
    const body: Record<string, string> = mode === "dark" ? { darkAccent: color } : { lightAccent: color };
    if ((mode === "dark" && isDark) || (mode === "light" && !isDark)) {
      body.accentColor = color;
    }
    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onProfileRefresh();
        flashSaved("appearance");
      }
    } catch { /* ignore */ }
  };

  useEffect(() => () => {
    if (savedPipTimer.current) clearTimeout(savedPipTimer.current);
  }, []);

  const isProfileDirty =
    editName.trim() !== (myProfile?.displayName ?? "") ||
    editEmail.trim() !== (myProfile?.email ?? "") ||
    editTitle.trim() !== (myProfile?.title ?? "") ||
    editBio.trim() !== (myProfile?.bio ?? "");

  return (
    <Section>
      <MasterEclRow>
        <MasterEclLabel>{allOpen ? "Collapse all" : "Expand all"}</MasterEclLabel>
        <button
          type="button"
          onClick={toggleAll}
          aria-label={allOpen ? "Collapse all sections" : "Expand all sections"}
          aria-expanded={allOpen}
          style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center" }}
        >
          <ADLSwitchTrack $on={allOpen} aria-hidden="true">
            <ADLSwitchThumb $on={allOpen} />
          </ADLSwitchTrack>
        </button>
      </MasterEclRow>

      <ADLSection
        label="Bio"
        saved={savedKey === "identity"}
        open={adlOpen.bio}
        onOpenChange={setOne("bio")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <AvatarWrap>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              style={{ border: "none", background: "none", cursor: "pointer", position: "relative" }}
              title="Click to change avatar"
            >
              {myProfile && <UserAvatar profile={myProfile} size={56} />}
              <AvatarOverlay>
                <span style={{ color: "#fff", fontSize: "0.75rem" }}>📷</span>
              </AvatarOverlay>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />
            {uploadingAvatar && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.6)",
                }}
              >
                <span style={{ fontSize: "0.5625rem", color: "#fff" }}>…</span>
              </div>
            )}
          </AvatarWrap>

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <ProfileInput
              $accent={accent}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Display name"
              style={{ fontWeight: 700, fontSize: "0.875rem" }}
            />
            <ProfileInput
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="Email address"
              type="email"
            />
            <ProfileInput
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title / role"
            />
            <ProfileTextarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="Bio…"
              rows={2}
            />
            {avatarError && <ErrorText>{avatarError}</ErrorText>}
            {saveError && <ErrorText>{saveError}</ErrorText>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <HintText>Click avatar to change photo</HintText>
              <SaveBtn
                $accent={accent}
                $dirty={isProfileDirty}
                onClick={saveProfile}
                disabled={saving || !isProfileDirty}
              >
                {saving ? "Saving…" : "Save"}
              </SaveBtn>
            </div>
          </div>
        </div>
      </ADLSection>

      <ADLSection
        label="Appearance"
        saved={savedKey === "appearance"}
        open={adlOpen.appearance}
        onOpenChange={setOne("appearance")}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <TileRow>
            <Tile>
              <TileHeader>
                <TileLabel>Font size</TileLabel>
                <Ecl on={fontSizeOpen} onToggle={() => setFontSizeOpen((v) => !v)} />
              </TileHeader>
              <TileBody $open={fontSizeOpen}>
                <OptionGrid>
                  {FONT_SIZES.map((f) => (
                    <OptionBtn
                      key={f.value}
                      $active={settings.fontSize === f.value}
                      onClick={() => setAndFlash({ fontSize: f.value }, "appearance")}
                    >
                      {f.label}
                    </OptionBtn>
                  ))}
                </OptionGrid>
              </TileBody>
            </Tile>
            <Tile>
              <TileHeader>
                <TileLabel>Font family</TileLabel>
                <Ecl on={fontFamilyOpen} onToggle={() => setFontFamilyOpen((v) => !v)} />
              </TileHeader>
              <TileBody $open={fontFamilyOpen}>
                <OptionGrid>
                  {FONTS.map((f) => (
                    <OptionBtn
                      key={f.value}
                      $active={settings.myFont === f.value}
                      onClick={() => setAndFlash({ myFont: f.value }, "appearance")}
                      style={{ fontFamily: f.css }}
                    >
                      {f.label}
                    </OptionBtn>
                  ))}
                </OptionGrid>
              </TileBody>
            </Tile>
          </TileRow>

          <Tile>
            <TileHeader>
              <TileLabel>Accent color</TileLabel>
              <PreviewSaved data-visible={savedKey === "appearance"}>Saved</PreviewSaved>
              <Ecl on={accentOpen} onToggle={() => setAccentOpen((v) => !v)} />
            </TileHeader>
            <TileBody $open={accentOpen}>
              <PaletteGrid>
                <PaletteCol $bg="dark">
                  <PaletteColLabel $bg="dark">Dark mode</PaletteColLabel>
                  <SwatchRow>
                    {NEON_DARK.map((c) => (
                      <Swatch
                        key={c}
                        $color={c}
                        $selected={darkAccent === c}
                        onClick={() => saveAccent("dark", c)}
                        title={c}
                      />
                    ))}
                  </SwatchRow>
                </PaletteCol>
                <PaletteCol $bg="light">
                  <PaletteColLabel $bg="light">Light mode</PaletteColLabel>
                  <SwatchRow>
                    {NEON_LIGHT.map((c) => (
                      <Swatch
                        key={c}
                        $color={c}
                        $selected={lightAccent === c}
                        onClick={() => saveAccent("light", c)}
                        title={c}
                      />
                    ))}
                  </SwatchRow>
                </PaletteCol>
              </PaletteGrid>
              <PreviewGrid>
                <PreviewCard $bg="dark" $accent={darkAccent} $font={settings.myFont}>
                  <PreviewName $accent={darkAccent} $size={settings.fontSize}>
                    {myProfile?.displayName ?? "You"}
                  </PreviewName>
                  <PreviewBubble $bg="dark" $accent={darkAccent} $size={settings.fontSize}>
                    Hello from the dark side
                  </PreviewBubble>
                </PreviewCard>
                <PreviewCard $bg="light" $accent={lightAccent} $font={settings.myFont}>
                  <PreviewName $accent={lightAccent} $size={settings.fontSize}>
                    {myProfile?.displayName ?? "You"}
                  </PreviewName>
                  <PreviewBubble $bg="light" $accent={lightAccent} $size={settings.fontSize}>
                    Hello from the light side
                  </PreviewBubble>
                </PreviewCard>
              </PreviewGrid>
            </TileBody>
          </Tile>
        </div>
      </ADLSection>

      <ADLSection
        label="Chat Preferences"
        saved={savedKey === "chatprefs"}
        open={adlOpen.chatprefs}
        onOpenChange={setOne("chatprefs")}
      >
        <ToggleRow>
          <ToggleLabel>Show timestamps</ToggleLabel>
          <Toggle $on={settings.showTimestamps} onClick={() => setAndFlash({ showTimestamps: !settings.showTimestamps }, "chatprefs")}>
            <ToggleThumb $on={settings.showTimestamps} />
          </Toggle>
        </ToggleRow>
        {settings.showTimestamps && (
          <TileRow>
            <Tile>
              <TileHeader>
                <TileLabel>Format</TileLabel>
                <Ecl on={formatOpen} onToggle={() => setFormatOpen((v) => !v)} />
              </TileHeader>
              <TileBody $open={formatOpen}>
                {TS_FORMATS.map((f) => (
                  <RadioBtn
                    key={f.value}
                    $active={settings.timestampFormat === f.value}
                    onClick={() => setAndFlash({ timestampFormat: f.value }, "chatprefs")}
                  >
                    <RadioCircle $active={settings.timestampFormat === f.value}>
                      {settings.timestampFormat === f.value && <RadioDot />}
                    </RadioCircle>
                    {f.label}
                  </RadioBtn>
                ))}
              </TileBody>
            </Tile>
            <Tile>
              <TileHeader>
                <TileLabel>Timezone</TileLabel>
                <Ecl on={tzOpen} onToggle={() => setTzOpen((v) => !v)} />
              </TileHeader>
              <TileBody $open={tzOpen}>
                <TzSelect
                  value={settings.timezone}
                  onChange={(e) => setAndFlash({ timezone: e.target.value }, "chatprefs")}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </TzSelect>
              </TileBody>
            </Tile>
          </TileRow>
        )}
      </ADLSection>

      {isAdmin && (
        <ADLSection
          label={`Chat storage · ${storagePercent}%`}
          open={adlOpen.storage}
          onOpenChange={setOne("storage")}
        >
          <Tile>
            <TileHeader>
              <TileLabel>Usage &amp; cleanup</TileLabel>
              <Ecl on={storageOpen} onToggle={() => setStorageOpen((v) => !v)} />
            </TileHeader>
            <TileBody $open={storageOpen}>
              <StorageBar>
                <StorageFill $pct={storagePercent} />
              </StorageBar>
              <ClearBtn onClick={onClearChat}><TrashIcon size={14} /> Clear All Chat &amp; Files</ClearBtn>
            </TileBody>
          </Tile>
        </ADLSection>
      )}

      <ADLSection
        label="Notifications"
        saved={savedKey === "notifications"}
        open={adlOpen.notifications}
        onOpenChange={setOne("notifications")}
      >
        <ToggleRow>
          <ToggleLabel>Sound on new message</ToggleLabel>
          <Toggle $on={!!settings.soundOnMessage} onClick={() => setAndFlash({ soundOnMessage: !settings.soundOnMessage }, "notifications")}>
            <ToggleThumb $on={!!settings.soundOnMessage} />
          </Toggle>
        </ToggleRow>
        <ToggleRow>
          <ToggleLabel>Desktop notifications</ToggleLabel>
          <Toggle $on={!!settings.desktopNotifications} onClick={() => setAndFlash({ desktopNotifications: !settings.desktopNotifications }, "notifications")}>
            <ToggleThumb $on={!!settings.desktopNotifications} />
          </Toggle>
        </ToggleRow>
        <ToggleRow>
          <ToggleLabel>Mentions only</ToggleLabel>
          <Toggle $on={!!settings.mentionsOnly} onClick={() => setAndFlash({ mentionsOnly: !settings.mentionsOnly }, "notifications")}>
            <ToggleThumb $on={!!settings.mentionsOnly} />
          </Toggle>
        </ToggleRow>
      </ADLSection>

      <ADLSection
        label="Privacy"
        saved={savedKey === "privacy"}
        open={adlOpen.privacy}
        onOpenChange={setOne("privacy")}
      >
        <ToggleRow>
          <ToggleLabel>Send read receipts</ToggleLabel>
          <Toggle $on={settings.sendReadReceipts !== false} onClick={() => setAndFlash({ sendReadReceipts: !(settings.sendReadReceipts !== false) }, "privacy")}>
            <ToggleThumb $on={settings.sendReadReceipts !== false} />
          </Toggle>
        </ToggleRow>
        <ToggleRow>
          <ToggleLabel>Show online status</ToggleLabel>
          <Toggle $on={settings.showOnlineStatus !== false} onClick={() => setAndFlash({ showOnlineStatus: !(settings.showOnlineStatus !== false) }, "privacy")}>
            <ToggleThumb $on={settings.showOnlineStatus !== false} />
          </Toggle>
        </ToggleRow>
        <ToggleRow>
          <ToggleLabel>Send typing indicators</ToggleLabel>
          <Toggle $on={settings.sendTypingIndicators !== false} onClick={() => setAndFlash({ sendTypingIndicators: !(settings.sendTypingIndicators !== false) }, "privacy")}>
            <ToggleThumb $on={settings.sendTypingIndicators !== false} />
          </Toggle>
        </ToggleRow>
      </ADLSection>

      <ADLSection
        label="Interface Controls"
        saved={savedKey === "interface"}
        open={adlOpen.interface}
        onOpenChange={setOne("interface")}
      >
        <ToggleRow>
          <ToggleLabel>
            Auto-hide drawer knobs
            <div style={{ fontSize: "0.625rem", color: "var(--t-textGhost)", marginTop: "0.25rem", fontWeight: 400 }}>
              When on, side drawer knobs (and the Legend knob) stay hidden. Move the mouse, scroll, or press a key to reveal them; they hide again after 3 seconds.
            </div>
          </ToggleLabel>
          <Toggle
            $on={drawerKnobsAutoHide}
            onClick={() => {
              const next = !drawerKnobsAutoHide;
              setDrawerKnobsAutoHide(next);
              setAutoHide(next);
              flashSaved("interface");
            }}
          >
            <ToggleThumb $on={drawerKnobsAutoHide} />
          </Toggle>
        </ToggleRow>
      </ADLSection>

      {isAdmin && (
        <ADLSection
          label="Talk-to-text"
          open={adlOpen.talk}
          onOpenChange={setOne("talk")}
        >
          <Tile>
            <TileHeader>
              <TileLabel>Model size</TileLabel>
            </TileHeader>
            <TileBody $open={true}>
              <TzSelect
                value={settings.whisperModel ?? "base.en"}
                onChange={(e) => set({ whisperModel: e.target.value as NonNullable<ChatSettings["whisperModel"]> })}
              >
                {WHISPER_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}{m.note ? ` — ${m.note}` : ""}
                  </option>
                ))}
              </TzSelect>
              <div style={{ fontSize: "0.625rem", color: "var(--t-textGhost)", marginTop: "0.35rem" }}>
                Bigger models are more accurate but slower. Missing models must be downloaded via
                {" "}<code>bash models/download-ggml-model.sh &lt;name&gt;</code> in the whisper.cpp dir.
              </div>
            </TileBody>
          </Tile>
        </ADLSection>
      )}

      <SignOutRow>
        <HintText>Signed in as <strong>{currentUser}</strong></HintText>
        <SignOutBtn onClick={() => signOut({ callbackUrl: "/login" })}>
          <span>⏏</span> Sign out
        </SignOutBtn>
      </SignOutRow>
    </Section>
  );
}

/* ── Members tab ───────────────────────────────────────────────── */

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

  useEffect(() => {
    setPage(0);
  }, [query]);

  const handleRoleChange = async (username: string, role: UserRole) => {
    setChanging(username);
    await onRoleChange(username, role);
    setChanging(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <SearchWrap>
        <SearchIcon>🔍</SearchIcon>
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members…"
        />
        {query && <SearchClear onClick={() => setQuery("")}>✕</SearchClear>}
      </SearchWrap>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {pageItems.length === 0 ? (
          <p style={{ fontSize: "0.75rem", color: "var(--t-textGhost)", textAlign: "center", padding: "1.5rem 0" }}>
            No members found.
          </p>
        ) : (
          pageItems.map((p) => {
            const isSelf = p.username === currentUser;
            const canChangeRole = isAdmin && !isSelf;
            return (
              <MemberCard key={p.username} $accent={p.accentColor} $self={isSelf}>
                <UserAvatar profile={p} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <MemberName>{p.displayName}</MemberName>
                    {isSelf && <MemberYou>(you)</MemberYou>}
                    <RoleBadge $admin={p.role === "admin"}>{p.role}</RoleBadge>
                  </div>
                  <MemberEmail>{p.email}</MemberEmail>
                </div>
                {canChangeRole ? (
                  <div style={{ flexShrink: 0 }}>
                    {changing === p.username ? (
                      <SavingText>Saving…</SavingText>
                    ) : (
                      <RoleSelect
                        value={p.role}
                        onChange={(e) => handleRoleChange(p.username, e.target.value as UserRole)}
                      >
                        <option value="admin">Admin</option>
                        <option value="employee">Employee</option>
                      </RoleSelect>
                    )}
                  </div>
                ) : (
                  <div style={{ flexShrink: 0, width: 72 }} />
                )}
              </MemberCard>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <PagerRow>
          <PagerBtn disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            ←
          </PagerBtn>
          <PagerInfo>
            {page + 1} / {totalPages}
            <span style={{ color: "var(--t-textGhost)", marginLeft: "0.375rem" }}>
              ({filtered.length} member{filtered.length !== 1 ? "s" : ""})
            </span>
          </PagerInfo>
          <PagerBtn
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            →
          </PagerBtn>
        </PagerRow>
      )}
    </div>
  );
}

/* ── Main modal ────────────────────────────────────────────────── */

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
  useModalLifecycle();
  const [tab, setTab] = useState<ModalTab>("settings");

  const myProfile = profiles.find((p) => p.username === currentUser);
  const isAdmin = myProfile?.role === "admin";

  const handleRoleChange = useCallback(
    async (username: string, role: UserRole) => {
      await fetch("/api/users/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, role }),
      });
      onProfileRefresh();
    },
    [onProfileRefresh]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose]);

  return (
    <>
      <Backdrop onClick={onClose} />
      <Modal>
        <Header>
          <TabGroup>
            {(
              [
                { id: "settings", label: "⚙ Settings" },
                { id: "members", label: "👥 Members" },
              ] as { id: ModalTab; label: string }[]
            ).map((t) => (
              <TabBtn key={t.id} $active={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </TabBtn>
            ))}
          </TabGroup>
          {tab === "members" && <CountBadge>{profiles.length}</CountBadge>}
          <div style={{ marginLeft: "auto" }}>
            <NeonX accent="pink" onClick={onClose} title="Close" />
          </div>
        </Header>

        <Body>
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
        </Body>
      </Modal>
    </>
  );
}
