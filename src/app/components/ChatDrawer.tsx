"use client";

import {
  Fragment,
  useState,
  useEffect,
  useRef,
  useCallback,
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import styled from "styled-components";
import { colors, rgb } from "../theme";
import {
  DrawerBackdrop,
  DrawerPanel,
  DrawerHeader,
  DrawerTab,
  DrawerTabLabel,
  DrawerResizeHandle,
  PanelIconBtn,
  Input,
} from "../styled";
import ChatSettingsModal, { UserAvatar, resolveTimezone, type MemberProfile, type ChatSettings as ModalChatSettings } from "./ChatSettingsModal";
import MediaConverterModal from "./MediaConverterModal";
import ChatPicker from "./ChatPicker";
import {
  ChatIcon,
  MembersIcon,
  TrashIcon,
  FileIcon,
  PhotosIcon,
  ContactIcon,
  PollIcon,
  EventIcon,
  ConvertImageIcon,
  ConvertVideoIcon,
} from "./icons";

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  from: string;
  content: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  createdAt: string;
  editedAt?: string;
};

type DmMessage = {
  id: string;
  from: string;
  to: string;
  content: string;
  createdAt: string;
  editedAt?: string;
};

type Profile = MemberProfile;
type ChatSettings = ModalChatSettings;

type GroupChat = {
  id: string;
  name: string;
  memberIds: string[];
};

type Selection =
  | { type: "tgv" }
  | { type: "dm"; peer: Profile }
  | { type: "group"; groupId: string };

type SidebarTab = "users" | "groups";

const DEFAULT_SETTINGS: ChatSettings = {
  showTimestamps: true,
  timestampFormat: "time",
  timezone: "auto",
  fontSize: "sm",
  myFont: "sans",
};

const SETTINGS_KEY    = "tgv_chat_settings";
const TAB_STORAGE_KEY = "tgv-drawer-tab-chat-y";
const DRAWER_EVENT    = "tgv-right-drawer";
const MIN_W           = 420;
const SIDEBAR_MIN     = 120;
const SIDEBAR_DEFAULT = 150;
const SIDEBAR_MAX     = 280;

function getDefaultDrawerWidth() {
  if (typeof window === "undefined") return 800;
  return Math.max(MIN_W, Math.round(window.innerWidth * 0.5));
}
function getMaxDrawerWidth() {
  if (typeof window === "undefined") return 1400;
  return Math.round(window.innerWidth * 0.9);
}

const VIOLET = colors.violet;

function getDefaultTabY() {
  if (typeof window === "undefined") return 360;
  return Math.round(window.innerHeight * 0.4);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function fmtTimestamp(iso: string, format: ChatSettings["timestampFormat"], timezone?: string): string {
  const d = new Date(iso);
  const tz = resolveTimezone(timezone ?? "auto");
  if (format === "relative") {
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
  if (format === "time") {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: tz });
  }
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });
}

// Returns e.g. "Sunday · April 19, 2026" in the user's selected timezone.
// Used by the day divider that separates messages from different days.
function fmtDayDivider(iso: string, timezone?: string): string {
  const d = new Date(iso);
  const tz = resolveTimezone(timezone ?? "auto");
  return d.toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });
}

// Group key in the user's timezone — two timestamps are "same day" iff this
// returns the same string. ISO 8601 date (YYYY-MM-DD) scoped by timezone.
function dayKey(iso: string, timezone?: string): string {
  const d = new Date(iso);
  const tz = resolveTimezone(timezone ?? "auto");
  return d.toLocaleDateString("en-CA", { timeZone: tz }); // en-CA → YYYY-MM-DD
}

function isImage(mime?: string) { return mime?.startsWith("image/") ?? false; }

function hexToRgb(hex: string): string {
  const c = hex.replace("#", "");
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}

function loadSettings(): ChatSettings {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(SETTINGS_KEY) : null;
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

// ── Styled: shared across sub-components ──────────────────────────────────────

const SideTab = styled(DrawerTab).attrs({ $side: "left", $accent: "green" })`
  left: 0;
  z-index: 63;
  border-left: none;
`;

const UnreadBadge = styled.span`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 7px;
  font-weight: 700;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  top: -6px;
  right: -6px;
  background: ${colors.cyan};
  color: #060810;
`;

const Backdrop = styled(DrawerBackdrop)`
  z-index: 58;
  backdrop-filter: blur(1px);
`;

const Panel = styled(DrawerPanel)`
  left: 0;
  z-index: 62;
  max-width: 85vw;
  border-right: 1px solid rgba(${rgb.green}, 0.18);

  [data-theme="light"] & {
    border-right-color: rgba(${rgb.green}, 0.1);
  }
`;

const Header = styled(DrawerHeader)`
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
`;

const ControlBtn = styled(PanelIconBtn)`
  width: 2.125rem;
  height: 2.125rem;
  border-radius: 0.5rem;
  font-size: 1.0625rem;
  font-weight: 800;
  line-height: 1;
  background: rgba(${rgb.green}, 0.14);
  border: 1px solid rgba(${rgb.green}, 0.45);
  color: #4ade80;
  text-shadow: 0 0 6px rgba(${rgb.green}, 0.7);
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  &:hover:not(:disabled) {
    background: rgba(${rgb.green}, 0.28);
    box-shadow: 0 0 10px rgba(${rgb.green}, 0.5);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  [data-theme="light"] & { text-shadow: none; }

  svg { width: 14px; height: 14px; }
`;

const TitleWrap = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const TitleText = styled.span<{ $color?: string }>`
  font-size: 0.875rem;
  font-weight: 700;
  color: ${(p) => p.$color || colors.green};
  ${(p) => !p.$color ? `text-shadow: 0 0 8px rgba(${rgb.green}, 0.9), 0 0 20px rgba(${rgb.green}, 0.55);` : ""}

  [data-theme="light"] & {
    text-shadow: none;
  }
`;

const TitleChatIcon = styled(ChatIcon)`
  color: ${colors.green};
  filter: drop-shadow(0 0 6px rgba(${rgb.green}, 0.8));

  [data-theme="light"] & {
    filter: none;
  }
`;

const DmTag = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textGhost);
`;

const AvatarChips = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  position: relative;
`;

const OnlineOverflowBtn = styled.button<{ $open?: boolean }>`
  height: 1.5rem;
  padding: 0 0.5rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.625rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  background: ${(p) => (p.$open ? `rgba(${rgb.green}, 0.25)` : "var(--t-inputBg)")};
  border: 1px solid rgba(${rgb.green}, 0.4);
  color: ${colors.green};

  &:hover { background: rgba(${rgb.green}, 0.18); }
`;

const OnlineOverflowMenu = styled.div`
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border-radius: 0.75rem;
  padding: 0.5rem;
  background: var(--t-surface);
  border: 1px solid var(--t-border);
  box-shadow: 0 6px 22px rgba(0,0,0,0.38);
  z-index: 220;
  min-width: 180px;
`;

const OnlineOverflowItem = styled.button<{ $accent?: string }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  cursor: pointer;
  font-size: 0.6875rem;
  color: var(--t-text);
  text-align: left;
  transition: background 0.12s, color 0.12s;

  &:hover {
    background: ${(p) => (p.$accent ? `${p.$accent}18` : `rgba(${rgb.green}, 0.12)`)};
    color: ${(p) => p.$accent ?? colors.green};
  }
`;

const OnlinePresenceDot = styled.span<{ $online?: boolean }>`
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1.5px solid var(--t-surface);
  background: ${(p) => (p.$online ? colors.green : "var(--t-textGhost)")};
  box-shadow: ${(p) => (p.$online ? `0 0 4px ${colors.green}` : "none")};
`;

const Resize = styled(DrawerResizeHandle).attrs({ $accent: "green" })``;

const MsgScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  scrollbar-width: thin;
  scrollbar-color: rgba(${rgb.green}, 0.45) transparent;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(${rgb.green}, 0.35);
    border-radius: 4px;
    box-shadow: 0 0 6px rgba(${rgb.green}, 0.4) inset;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(${rgb.green}, 0.6);
    box-shadow: 0 0 10px rgba(${rgb.green}, 0.6) inset;
  }

  [data-theme="light"] & {
    scrollbar-color: rgba(${rgb.green}, 0.55) transparent;

    &::-webkit-scrollbar-thumb {
      background: rgba(${rgb.green}, 0.5);
      box-shadow: none;
    }
    &::-webkit-scrollbar-thumb:hover {
      background: rgba(${rgb.green}, 0.7);
      box-shadow: none;
    }
  }
`;

const EmptyChat = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.75rem;
  color: var(--t-textGhost);
`;

const EmptyIcon = styled.span`
  font-size: 2.5rem;
`;

const EmptyText = styled.p`
  font-size: 0.75rem;
`;

const DayDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.25rem;
  margin: 0.25rem 0;

  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--t-border);
  }
`;

const DayDividerLabel = styled.span`
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--t-textMuted);
  background: rgba(${rgb.green}, 0.06);
  padding: 0.2rem 0.625rem;
  border-radius: 999px;
  border: 1px solid rgba(${rgb.green}, 0.18);
  white-space: nowrap;
`;

const InputArea = styled.div`
  flex-shrink: 0;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid var(--t-border);
`;

const FilePreview = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.75rem;
  background: rgba(${rgb.cyan}, 0.08);
  border: 1px solid rgba(${rgb.cyan}, 0.25);

  [data-theme="light"] & {
    background: rgba(${rgb.cyan}, 0.04);
    border-color: rgba(${rgb.cyan}, 0.15);
  }
`;

const FilePreviewName = styled.span`
  font-size: 0.75rem;
  color: ${colors.cyan};
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FilePreviewSize = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textGhost);
`;

const FilePreviewClose = styled.button`
  font-size: 0.5625rem;
  background: none;
  border: none;
  color: var(--t-textGhost);
  cursor: pointer;
  &:hover { color: #f87171; }
`;

const CloseBtn = styled.button`
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.5rem;
  background: rgba(${rgb.green}, 0.08);
  border: 1px solid rgba(${rgb.green}, 0.2);
  color: ${colors.green};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    background: rgba(${rgb.green}, 0.15);
    box-shadow: 0 0 14px rgba(${rgb.green}, 0.6);
  }
`;

const ThumbPreview = styled.div`
  position: relative;
  display: inline-flex;
  align-items: flex-start;
`;

const ThumbImg = styled.img`
  width: 60px;
  height: 45px;
  object-fit: cover;
  border-radius: 0.5rem;
  border: 1px solid rgba(${rgb.cyan}, 0.3);
  cursor: pointer;
`;

const ThumbRemove = styled.button`
  position: absolute;
  top: -5px;
  right: -5px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #1a1a2e;
  border: 1px solid rgba(255,255,255,0.2);
  color: #f87171;
  font-size: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  line-height: 1;

  &:hover { background: #2a1a1a; }
`;

// ── FileLightbox ──────────────────────────────────────────────────────────────

const LightboxOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 11000;
  background: rgba(0,0,0,0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 0.75rem;
`;

const LightboxImg = styled.img<{ $scale: number }>`
  max-width: 90vw;
  max-height: 80vh;
  object-fit: contain;
  transform: scale(${(p) => p.$scale});
  transform-origin: center;
  transition: transform 0.15s;
  border-radius: 0.5rem;
`;

const LightboxControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const LightboxBtn = styled.button`
  padding: 0.375rem 0.875rem;
  border-radius: 0.5rem;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff;
  font-size: 0.75rem;
  cursor: pointer;
  &:hover { background: rgba(255,255,255,0.18); }
`;

const LightboxScaleText = styled.span`
  font-size: 0.6875rem;
  color: rgba(255,255,255,0.6);
  min-width: 3rem;
  text-align: center;
`;

function FileLightbox({ file, onClose }: { file: File; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const url = URL.createObjectURL(file);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); URL.revokeObjectURL(url); };
  }, [onClose, url]);

  const isVideo = file.type.startsWith("video/");

  return (
    <LightboxOverlay onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
        {isVideo ? (
          <video
            src={url}
            controls
            autoPlay
            style={{ maxWidth: "90vw", maxHeight: "80vh", borderRadius: "0.5rem" }}
          />
        ) : (
          <LightboxImg src={url} alt={file.name} $scale={scale} />
        )}
        {!isVideo && (
          <LightboxControls>
            <LightboxBtn onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}>−</LightboxBtn>
            <LightboxScaleText>{Math.round(scale * 100)}%</LightboxScaleText>
            <LightboxBtn onClick={() => setScale((s) => Math.min(5, s + 0.25))}>+</LightboxBtn>
            <LightboxBtn onClick={() => setScale(1)}>Reset</LightboxBtn>
          </LightboxControls>
        )}
        <LightboxBtn onClick={onClose}>Close</LightboxBtn>
      </div>
    </LightboxOverlay>
  );
}

const TypingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0 0.25rem;
  min-height: 16px;
`;

const TypingDot = styled.span<{ $delay: number }>`
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--t-textFaint);
  animation: typingBounce 1.2s ease-in-out ${(p) => p.$delay}s infinite;

  @keyframes typingBounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-3px); }
  }
`;

const TypingText = styled.span`
  font-size: 0.625rem;
  color: var(--t-textGhost);
`;

const InputRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
`;

const AttachBtn = styled.button`
  width: 2rem;
  height: 2rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(${rgb.cyan}, 0.08);
  border: 1px solid rgba(${rgb.cyan}, 0.3);
  color: ${colors.cyan};
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(${rgb.cyan}, 0.14);
  }

  [data-theme="light"] & {
    background: rgba(${rgb.cyan}, 0.05);
    border-color: rgba(${rgb.cyan}, 0.2);
  }
`;

const AttachMenuAnchor = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const PickerAnchor = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const PickerBtn = styled.button`
  width: 2rem;
  height: 2rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(${rgb.green}, 0.08);
  border: 1px solid rgba(${rgb.green}, 0.3);
  color: ${colors.green};
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.15s;

  &:hover { background: rgba(${rgb.green}, 0.14); }
`;

const AttachMenuPopup = styled.div`
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 220;
  min-width: 210px;
  padding: 0.3rem 0;
  border-radius: 10px;
  background: var(--t-surface);
  border: 1px solid var(--t-border);
  box-shadow: 0 10px 28px rgba(0,0,0,0.42);
`;

const AttachMenuItem = styled.button<{ $disabled?: boolean }>`
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 0.5rem 0.8rem;
  font-size: 0.75rem;
  color: var(--t-text);
  cursor: ${(p) => (p.$disabled ? "default" : "pointer")};
  opacity: ${(p) => (p.$disabled ? 0.5 : 1)};
  display: flex;
  align-items: center;
  gap: 0.6rem;
  white-space: nowrap;
  &:hover {
    background: ${(p) => (p.$disabled ? "transparent" : `rgba(${rgb.cyan}, 0.12)`)};
    color: ${(p) => (p.$disabled ? "var(--t-text)" : colors.cyan)};
  }
`;

const AttachMenuIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${colors.green};
`;

const AttachMenuSoon = styled.span`
  font-size: 0.5rem;
  margin-left: auto;
  padding: 0.1rem 0.35rem;
  border-radius: 999px;
  background: var(--t-inputBg);
  color: var(--t-textGhost);
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const ChatTextarea = styled.textarea<{ $accent?: string }>`
  flex: 1;
  background: transparent;
  outline: none;
  color: var(--t-text);
  opacity: 0.8;
  resize: none;
  border-radius: 0.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid ${(p) => p.$accent ? `${p.$accent}44` : "var(--t-borderStrong)"};
  max-height: 80px;

  &::placeholder {
    color: var(--t-textGhost);
  }
`;

const SendBtn = styled.button<{ $color?: string }>`
  width: 2rem;
  height: 2rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.15s;
  background: ${(p) => p.$color ? `${p.$color}22` : `rgba(${rgb.cyan}, 0.2)`};
  border: 1px solid ${(p) => p.$color ? `${p.$color}55` : `rgba(${rgb.cyan}, 0.4)`};
  color: ${(p) => p.$color || colors.cyan};

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

// ── Styled: Bubble ────────────────────────────────────────────────────────────

const BubbleRow = styled.div<{ $isMe?: boolean }>`
  display: flex;
  gap: 0.5rem;
  flex-direction: ${(p) => (p.$isMe ? "row-reverse" : "row")};
`;

const BubbleCol = styled.div<{ $isMe?: boolean }>`
  display: flex;
  flex-direction: column;
  max-width: 75%;
  align-items: ${(p) => (p.$isMe ? "flex-end" : "flex-start")};
`;

const BubbleMeta = styled.div<{ $isMe?: boolean }>`
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.125rem;
  flex-direction: ${(p) => (p.$isMe ? "row-reverse" : "row")};
`;

const BubbleName = styled.span<{ $color?: string }>`
  font-size: 0.625rem;
  font-weight: 700;
  color: ${(p) => p.$color || colors.pink};
`;

const BubbleTime = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textGhost);
`;

const BubbleCard = styled.div<{ $isMe?: boolean; $accent?: string }>`
  position: relative;
  border-radius: ${(p) => (p.$isMe ? "18px 4px 18px 18px" : "4px 18px 18px 18px")};
  padding: 0.5rem 0.75rem;
  background: ${(p) =>
    p.$isMe
      ? `rgba(${p.$accent ? hexToRgb(p.$accent) : rgb.pink}, 0.18)`
      : "var(--t-inputBg)"};
  border: 1px solid
    ${(p) =>
      p.$isMe
        ? `${p.$accent || colors.pink}44`
        : "var(--t-borderStrong)"};
  color: ${(p) => (p.$isMe ? "#fff" : "var(--t-text)")};
  opacity: ${(p) => (p.$isMe ? 1 : 0.8)};

  [data-theme="light"] & {
    background: ${(p) =>
      p.$isMe
        ? `rgba(${p.$accent ? hexToRgb(p.$accent) : rgb.pink}, 0.1)`
        : "rgba(0, 0, 0, 0.03)"};
    color: var(--t-text);
  }
`;

const BubbleActions = styled.div<{ $isMe?: boolean }>`
  position: absolute;
  top: 0;
  ${(p) => (p.$isMe ? "left: 0; transform: translateX(-100%); padding-right: 0.25rem;" : "right: 0; transform: translateX(100%); padding-left: 0.25rem;")}
  display: flex;
  gap: 0.125rem;
  opacity: 0;
  transition: opacity 0.15s;

  ${BubbleRow}:hover & {
    opacity: 1;
  }
`;

const BubbleActionBtn = styled.button<{ $danger?: boolean }>`
  font-size: 0.5625rem;
  padding: 0 0.25rem;
  background: none;
  border: none;
  color: var(--t-textGhost);
  cursor: pointer;
  transition: color 0.15s;

  &:hover {
    color: ${(p) => (p.$danger ? "#f87171" : "var(--t-textMuted)")};
  }
`;

const EditInput = styled.input`
  flex: 1;
  background: transparent;
  outline: none;
  color: inherit;
  border: none;
`;

const EditSave = styled.button`
  font-size: 0.5625rem;
  background: none;
  border: none;
  color: var(--t-textMuted);
  cursor: pointer;
  &:hover { color: var(--t-text); }
`;

const EditCancel = styled.button`
  font-size: 0.5625rem;
  background: none;
  border: none;
  color: var(--t-textGhost);
  cursor: pointer;
`;

// ── Styled: inline GIF embed (auto-loops by default as `<img>`) ──────────────

const InlineGif = styled.img`
  display: block;
  max-width: min(220px, 70%);
  max-height: 200px;
  border-radius: 0.5rem;
  border: 1px solid var(--t-border);
  margin-top: 0.35rem;
`;

const GifPreviewStrip = styled.div`
  display: flex;
  gap: 0.35rem;
  padding: 0.3rem 0.4rem;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--t-border);
`;

const GifPreviewItem = styled.div`
  position: relative;
  width: 70px;
  height: 70px;
  border-radius: 0.4rem;
  overflow: hidden;
  border: 1px solid var(--t-border);

  img { width: 100%; height: 100%; object-fit: cover; display: block; }
`;

const GifPreviewRemove = styled.button`
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 9px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover { background: rgba(0, 0, 0, 0.85); }
`;

// Matches Giphy media URLs (we only auto-embed trusted hosts so random
// .gif links in pasted messages don't auto-play content we didn't vet).
const GIF_URL_RE = /https?:\/\/(?:media\d*\.giphy\.com|giphy\.com|i\.giphy\.com)\/media\/[^\s]+\.gif\b/gi;

function extractGifUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(GIF_URL_RE);
  return matches ? Array.from(new Set(matches)) : [];
}

function stripGifUrls(text: string): string {
  return text.replace(GIF_URL_RE, "").replace(/\s+/g, " ").trim();
}

// ── Styled: File attachment ───────────────────────────────────────────────────

const AttachImage = styled.img`
  max-width: 180px;
  max-height: 140px;
  border-radius: 0.75rem;
  object-fit: cover;
  border: 1px solid var(--t-borderStrong);
  margin-top: 0.375rem;
  display: block;
`;

const AttachFile = styled.a`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.375rem;
  border-radius: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);
  text-decoration: none;
  transition: background 0.15s;

  &:hover {
    background: var(--t-border);
  }
`;

const AttachIcon = styled.span`
  font-size: 1rem;
  flex-shrink: 0;
`;

const AttachName = styled.span`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
`;

const AttachSize = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textGhost);
`;

const AttachDl = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textGhost);
  flex-shrink: 0;
  margin-left: auto;
`;

// ── Styled: Members panel ─────────────────────────────────────────────────────

/* ── Two-column body + sidebar ─────────────────────────────────── */

const Body = styled.div`
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
`;

const Sidebar = styled.div<{ $width: number }>`
  width: ${(p) => p.$width}px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--t-border);
  background: rgba(${rgb.green}, 0.02);
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.5rem 0.375rem;
  flex-shrink: 0;
`;

const SidebarTabSwitch = styled.div`
  display: flex;
  align-items: center;
  border-radius: 9999px;
  padding: 0.125rem;
  flex: 1;
  background: var(--t-inputBg);
  border: 1px solid rgba(${rgb.green}, 0.18);
`;

const SidebarTabBtn = styled.button<{ $active?: boolean }>`
  flex: 1;
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.25rem 0.375rem;
  border-radius: 9999px;
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.green}, 0.4)` : "transparent")};
  background: ${(p) => (p.$active ? `rgba(${rgb.green}, 0.18)` : "transparent")};
  color: ${(p) => (p.$active ? colors.green : "var(--t-textFaint)")};
  cursor: pointer;
  transition: all 0.15s;
`;

const SidebarPlusBtn = styled.button`
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  background: rgba(${rgb.green}, 0.12);
  border: 1px solid rgba(${rgb.green}, 0.4);
  color: ${colors.green};
  transition: all 0.15s;

  &:hover {
    background: rgba(${rgb.green}, 0.22);
  }
`;

const SidebarList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem 0.375rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(${rgb.green}, 0.4) transparent;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: rgba(${rgb.green}, 0.4); border-radius: 3px; }
  &::-webkit-scrollbar-track { background: transparent; }

  [data-theme="light"] & {
    scrollbar-color: rgba(${rgb.green}, 0.55) transparent;
    &::-webkit-scrollbar-thumb { background: rgba(${rgb.green}, 0.55); }
  }
`;

const SidebarRowWrap = styled.div<{ $active?: boolean }>`
  position: relative;
  display: flex;
  align-items: stretch;
  border-radius: 8px;
  transition: all 0.12s;
  background: ${(p) => (p.$active ? `rgba(${rgb.green}, 0.14)` : "transparent")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.green}, 0.35)` : "transparent")};

  &:hover { background: rgba(${rgb.green}, 0.08); }
`;

const SidebarRow = styled.button<{ $active?: boolean; $accent?: string }>`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: ${(p) => (p.$active ? colors.green : "var(--t-textMuted)")};
  min-width: 0;
`;

const SidebarRowName = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SidebarRowPresence = styled.span<{ $online?: boolean }>`
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(p) => (p.$online ? colors.green : "var(--t-textGhost)")};
  box-shadow: ${(p) => (p.$online ? `0 0 4px ${colors.green}` : "none")};
`;

const RowHoverMenuBtn = styled.button<{ $open?: boolean }>`
  width: 1.25rem;
  align-self: stretch;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--t-textGhost);
  cursor: pointer;
  opacity: ${(p) => (p.$open ? 1 : 0)};
  transition: opacity 0.15s, color 0.15s, background 0.15s;
  border-radius: 0 7px 7px 0;
  display: flex;
  align-items: center;
  justify-content: center;

  ${SidebarRowWrap}:hover & { opacity: 1; }
  &:hover { color: ${colors.green}; background: rgba(${rgb.green}, 0.14); }
`;

const RowHoverMenu = styled.div`
  position: absolute;
  top: calc(100% + 2px);
  right: 0;
  z-index: 200;
  min-width: 170px;
  padding: 0.25rem 0;
  border-radius: 8px;
  background: var(--t-surface);
  border: 1px solid var(--t-border);
  box-shadow: 0 6px 22px rgba(0,0,0,0.38);
`;

const RowHoverMenuItem = styled.button`
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 0.4rem 0.75rem;
  font-size: 0.6875rem;
  color: var(--t-text);
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  &:hover { background: rgba(${rgb.green}, 0.12); color: ${colors.green}; }
`;

const PinBadge = styled.span`
  font-size: 0.5rem;
  color: ${colors.green};
  flex-shrink: 0;
  opacity: 0.7;
`;

const DashedCreateCard = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem;
  margin-top: 0.375rem;
  border-radius: 8px;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  background: transparent;
  border: 1px dashed rgba(${rgb.green}, 0.45);
  color: ${colors.green};
  transition: all 0.15s;

  &:hover {
    background: rgba(${rgb.green}, 0.08);
    border-color: rgba(${rgb.green}, 0.7);
  }
`;

const SidebarResizer = styled.div`
  width: 4px;
  cursor: ew-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;

  &:hover {
    background: rgba(${rgb.green}, 0.35);
  }
`;

const DTogTab = styled.button<{ $collapsed: boolean }>`
  position: absolute;
  top: 50%;
  left: ${(p) => (p.$collapsed ? "0" : "auto")};
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 36px;
  padding: 0;
  border-radius: 0 6px 6px 0;
  border: 1px solid rgba(${rgb.green}, 0.35);
  border-left: none;
  background: rgba(${rgb.green}, 0.12);
  color: ${colors.green};
  cursor: pointer;
  z-index: 2;
  transition: background 0.15s;

  &:hover { background: rgba(${rgb.green}, 0.22); }
`;

const ConvPane = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
`;

const CreateGroupBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CreateGroupCard = styled.div`
  width: min(90vw, 360px);
  padding: 1.25rem;
  border-radius: 16px;
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.green}, 0.3);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const CreateGroupTitle = styled.h3`
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: ${colors.green};
`;

const CreateGroupText = styled.p`
  margin: 0;
  font-size: 0.75rem;
  color: var(--t-textMuted);
  line-height: 1.5;
`;

const CreateGroupCloseBtn = styled.button`
  align-self: flex-end;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(${rgb.green}, 0.4);
  background: rgba(${rgb.green}, 0.12);
  color: ${colors.green};
  cursor: pointer;
`;

// ── File attachment ────────────────────────────────────────────────────────────

function FileAttachment({ url, name, size, mime }: { url: string; name?: string; size?: number; mime?: string }) {
  if (isImage(mime)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <AttachImage src={url} alt={name ?? "image"} />
      </a>
    );
  }
  return (
    <AttachFile href={url} target="_blank" rel="noreferrer" download={name}>
      <AttachIcon>
        {mime?.startsWith("video/") ? "🎥" : mime?.startsWith("audio/") ? "🎵" : "📎"}
      </AttachIcon>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <AttachName>{name ?? "file"}</AttachName>
        {size && <AttachSize>{fmtBytes(size)}</AttachSize>}
      </div>
      <AttachDl>↓</AttachDl>
    </AttachFile>
  );
}

// ── Message bubble (shared by chat + DM) ─────────────────────────────────────

function MessageBubble({
  id, from, content, fileUrl, fileName, fileSize, fileMime, createdAt, editedAt,
  profile, isMe, settings, canDelete,
  onDelete, onEdit,
}: {
  id: string; from: string; content: string;
  fileUrl?: string; fileName?: string; fileSize?: number; fileMime?: string;
  createdAt: string; editedAt?: string;
  profile?: Profile; isMe: boolean;
  settings: ChatSettings; canDelete: boolean;
  onDelete: () => void; onEdit: (content: string) => void;
}) {
  const accent = profile?.accentColor ?? "#4ade80";
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(content);

  const saveEdit = () => {
    if (editVal.trim()) onEdit(editVal.trim());
    setEditing(false);
  };

  return (
    <BubbleRow $isMe={isMe}>
      <UserAvatar
        profile={profile ?? { displayName: from, accentColor: "#4ade80", avatarUrl: "" }}
        size={28}
      />
      <BubbleCol $isMe={isMe}>
        <BubbleMeta $isMe={isMe}>
          <BubbleName $color={accent}>
            {isMe ? "You" : (profile?.displayName ?? from)}
          </BubbleName>
          {settings.showTimestamps && (
            <BubbleTime>
              {fmtTimestamp(createdAt, settings.timestampFormat, settings.timezone)}
              {editedAt && " · edited"}
            </BubbleTime>
          )}
        </BubbleMeta>
        <BubbleCard $isMe={isMe} $accent={accent}>
          {editing ? (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <EditInput value={editVal} onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setEditing(false);
                }}
                autoFocus />
              <EditSave onClick={saveEdit}>Save</EditSave>
              <EditCancel onClick={() => setEditing(false)}>✕</EditCancel>
            </div>
          ) : (() => {
            const gifs = extractGifUrls(content);
            const plain = gifs.length ? stripGifUrls(content) : content;
            return (
              <>
                {plain && <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{plain}</p>}
                {gifs.map((url) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <InlineGif key={url} src={url} alt="gif" loading="lazy" />
                ))}
                {fileUrl && <FileAttachment url={fileUrl} name={fileName} size={fileSize} mime={fileMime} />}
              </>
            );
          })()}
          {!editing && (
            <BubbleActions $isMe={isMe}>
              {isMe && (
                <BubbleActionBtn onClick={() => { setEditing(true); setEditVal(content); }} title="Edit">✎</BubbleActionBtn>
              )}
              {canDelete && (
                <BubbleActionBtn $danger onClick={onDelete} title="Delete">✕</BubbleActionBtn>
              )}
            </BubbleActions>
          )}
        </BubbleCard>
      </BubbleCol>
    </BubbleRow>
  );
}

// ── Main ChatDrawer ───────────────────────────────────────────────────────────

export default function ChatDrawer() {
  const [open, setOpen]           = useState(false);
  const [width, setWidth]         = useState(800);
  const [maxW, setMaxW]           = useState(1400);
  const [tabY, setTabY]           = useState<number>(480);
  const [selection, setSelection] = useState<Selection>({ type: "tgv" });
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("users");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [rowHoverMenu, setRowHoverMenu] = useState<string | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [onlineOverflowOpen, setOnlineOverflowOpen] = useState(false);

  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [profiles, setProfiles]   = useState<Profile[]>([]);
  const [presence, setPresence]   = useState<{ sysUser: string; online: boolean }[]>([]);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [input, setInput]         = useState("");
  const [sending, setSending]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [storagePercent, setStoragePercent] = useState(0);
  const [unread, setUnread]       = useState(0);
  const [settings, setSettings]   = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [converterType, setConverterType] = useState<"image" | "video" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  const [dmMessages, setDmMessages] = useState<DmMessage[]>([]);
  const [dmInput, setDmInput]     = useState("");
  const [dmSending, setDmSending] = useState(false);

  const [typers, setTypers]       = useState<string[]>([]);
  const lastTypingSentRef         = useRef(0);

  const fileRef     = useRef<HTMLInputElement>(null);
  const photoRef    = useRef<HTMLInputElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const dmBottomRef = useRef<HTMLDivElement>(null);
  const seenCount   = useRef(0);
  const lastSeenId  = useRef<string>("");
  const resizing    = useRef(false);
  const startX      = useRef(0);
  const startW      = useRef(0);
  const startTabY   = useRef(0);
  const startTabPos = useRef(0);
  const didDrag     = useRef(false);

  const isAdmin = profiles.find((p) => p.username === currentUser)?.role === "admin";

  // Generate thumbnail for upload file preview
  useEffect(() => {
    if (!uploadFile) { setThumbUrl(null); return; }
    if (uploadFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(uploadFile);
      setThumbUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    if (uploadFile.type.startsWith("video/")) {
      const url = URL.createObjectURL(uploadFile);
      const vid = document.createElement("video");
      vid.src = url;
      vid.muted = true;
      vid.currentTime = 0.15;
      vid.onloadeddata = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 120;
        canvas.height = 90;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(vid, 0, 0, 120, 90);
        setThumbUrl(canvas.toDataURL());
        URL.revokeObjectURL(url);
      };
      vid.onerror = () => URL.revokeObjectURL(url);
      return;
    }
    setThumbUrl(null);
  }, [uploadFile]);

  useEffect(() => {
    setSettings(loadSettings());
    setTabY(getDefaultTabY());
    const initialMax = getMaxDrawerWidth();
    setMaxW(initialMax);
    const savedW = sessionStorage.getItem("chat-drawer-width");
    setWidth(savedW ? Math.min(initialMax, parseInt(savedW, 10)) : getDefaultDrawerWidth());
    const savedLastSeen = localStorage.getItem("tgv_chat_last_seen_id");
    if (savedLastSeen) lastSeenId.current = savedLastSeen;
    const onResize = () => setMaxW(getMaxDrawerWidth());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail !== "chat") setOpen(false);
    };
    window.addEventListener(DRAWER_EVENT, handler);
    return () => window.removeEventListener(DRAWER_EVENT, handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const loadProfiles = useCallback(async () => {
    const [profRes, presRes] = await Promise.all([
      fetch("/api/users/profile").then((r) => r.json()).catch(() => ({ profiles: [] })),
      fetch("/api/presence").then((r) => r.json()).catch(() => []),
    ]);
    setProfiles(profRes.profiles ?? []);
    setPresence(Array.isArray(presRes) ? presRes : []);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/users/me").then((r) => r.json()).catch(() => null),
      fetch("/api/users/profile").then((r) => r.json()).catch(() => ({ profiles: [] })),
      fetch("/api/presence").then((r) => r.json()).catch(() => []),
    ]).then(([meRes, profRes, presRes]) => {
      setCurrentUser(meRes?.username ?? "admin");
      setProfiles(profRes.profiles ?? []);
      setPresence(Array.isArray(presRes) ? presRes : []);
    });
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const d = await fetch("/api/chat/group").then((r) => r.json());
      setGroups(Array.isArray(d?.groups) ? d.groups : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!rowHoverMenu) return;
    const onClick = () => setRowHoverMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setRowHoverMenu(null); };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [rowHoverMenu]);

  useEffect(() => {
    if (!onlineOverflowOpen) return;
    const onClick = () => setOnlineOverflowOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOnlineOverflowOpen(false); };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [onlineOverflowOpen]);

  useEffect(() => {
    if (!attachMenuOpen) return;
    const onClick = () => setAttachMenuOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAttachMenuOpen(false); };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [attachMenuOpen]);

  useEffect(() => {
    loadGroups();
    const id = setInterval(loadGroups, 15_000);
    return () => clearInterval(id);
  }, [loadGroups]);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/chat?limit=100");
      if (!res.ok) return;
      const d = await res.json();
      const msgs: ChatMessage[] = d.messages ?? [];
      setMessages(msgs);
      setStoragePercent(d.storagePercent ?? 0);
      if (!open && lastSeenId.current) {
        const idx = msgs.findIndex((m) => m.id === lastSeenId.current);
        const newCount = idx === -1 ? msgs.length : msgs.length - idx - 1;
        setUnread(newCount > 0 ? newCount : 0);
      } else if (!open && msgs.length > seenCount.current) {
        setUnread(msgs.length - seenCount.current);
      }
    } catch { /* ignore */ }
  }, [open]);

  useEffect(() => {
    loadMessages();
    const id = setInterval(loadMessages, 10_000);
    return () => clearInterval(id);
  }, [loadMessages]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      seenCount.current = messages.length;
      const latest = messages[messages.length - 1];
      if (latest) {
        lastSeenId.current = latest.id;
        try { localStorage.setItem("tgv_chat_last_seen_id", latest.id); } catch { /* ignore */ }
      }
      setUnread(0);
    }
  }, [messages, open]);

  const loadDmMessages = useCallback(async (peerUsername: string) => {
    const res = await fetch(`/api/chat/dm?with=${peerUsername}`).then((r) => r.json()).catch(() => ({ messages: [] }));
    setDmMessages(res.messages ?? []);
  }, []);

  useEffect(() => {
    if (selection.type !== "dm") return;
    const peerUsername = selection.peer.username;
    loadDmMessages(peerUsername);
    const id = setInterval(() => loadDmMessages(peerUsername), 10_000);
    return () => clearInterval(id);
  }, [selection, loadDmMessages]);

  useEffect(() => {
    if (selection.type === "dm") {
      dmBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [dmMessages, selection]);

  useEffect(() => {
    if (!open || selection.type === "group") return;
    const context = selection.type === "dm"
      ? `dm:${selection.peer.username}`
      : "chat";
    const poll = () => {
      fetch(`/api/chat/typing?context=${encodeURIComponent(context)}`)
        .then((r) => r.json())
        .then((d) => setTypers(d.typers ?? []))
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [open, selection]);

  const signalTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    const context = selection.type === "dm"
      ? `dm:${selection.peer.username}`
      : "chat";
    fetch("/api/chat/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context }),
    }).catch(() => {});
  }, [selection]);

  const saveSettings = (s: ChatSettings) => {
    setSettings(s);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  };

  const onTabMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startTabY.current = e.clientY;
    startTabPos.current = tabY;
    didDrag.current = false;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startTabY.current;
      if (Math.abs(delta) > 4) didDrag.current = true;
      if (didDrag.current) {
        const next = Math.max(40, Math.min(window.innerHeight - 100, startTabPos.current + delta));
        setTabY(next);
      }
    };
    const onUp = () => {
      if (!didDrag.current) {
        setOpen((p) => {
          const next = !p;
          if (next) window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: "chat" }));
          return next;
        });
      }
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.body.style.cursor = "ns-resize";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [tabY]);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    resizing.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = ev.clientX - startX.current;
      const newW = Math.min(maxW, Math.max(MIN_W, startW.current + delta));
      setWidth(newW);
      sessionStorage.setItem("chat-drawer-width", String(newW));
    };
    const onUp = () => {
      resizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [width, maxW]);

  const onSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startPx = e.clientX;
    const startWpx = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWpx + (ev.clientX - startPx)));
      setSidebarWidth(next);
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  const sendMessage = async () => {
    if ((!input.trim() && !uploadFile) || sending) return;
    setSending(true);
    try {
      if (uploadFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append("file", uploadFile);
        fd.append("chatId", "group");
        if (input.trim()) fd.append("content", input.trim());
        const res = await fetch("/api/chat/upload", { method: "POST", body: fd });
        if (res.ok) { setInput(""); setUploadFile(null); await loadMessages(); }
        setUploading(false);
      } else {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: input.trim() }),
        });
        if (res.ok) { setInput(""); await loadMessages(); }
      }
    } finally { setSending(false); }
  };

  const deleteMessage = async (id: string) => {
    await fetch(`/api/chat?id=${id}`, { method: "DELETE" });
    await loadMessages();
  };

  const editMessage = async (id: string, content: string) => {
    await fetch("/api/chat", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, content }) });
    await loadMessages();
  };

  const clearChat = async () => {
    if (!confirm("Clear all chat messages and files? This cannot be undone.")) return;
    await fetch("/api/chat/clear", { method: "POST" });
    await loadMessages();
  };

  const sendDm = async () => {
    if (!dmInput.trim() || dmSending || selection.type !== "dm") return;
    const peer = selection.peer;
    setDmSending(true);
    try {
      await fetch("/api/chat/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: peer.username, content: dmInput.trim() }),
      });
      setDmInput("");
      await loadDmMessages(peer.username);
    } finally { setDmSending(false); }
  };

  const deleteDm = async (id: string) => {
    if (selection.type !== "dm") return;
    const peer = selection.peer;
    await fetch(`/api/chat/dm?id=${id}&with=${peer.username}`, { method: "DELETE" });
    await loadDmMessages(peer.username);
  };

  const editDm = async (id: string, content: string) => {
    if (selection.type !== "dm") return;
    const peer = selection.peer;
    await fetch("/api/chat/dm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, with: peer.username, content }),
    });
    await loadDmMessages(peer.username);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setUploadFile(f);
    e.target.value = "";
  };

  const peer = selection.type === "dm" ? selection.peer : null;
  const isTGV = selection.type === "tgv";

  return (
    <>
      {/* ── Side tab pill ────────────────────────────────────────────── */}
      <SideTab
        onMouseDown={onTabMouseDown}
        title={open ? "Close chat" : "Open chat"}
        style={{
          top: tabY,
          background: open
            ? `rgba(${rgb.green}, 0.25)`
            : unread > 0
            ? `rgba(${rgb.green}, 0.22)`
            : `rgba(${rgb.green}, 0.12)`,
          boxShadow: unread > 0
            ? `2px 0 14px rgba(${rgb.green}, 0.35)`
            : `2px 0 10px rgba(${rgb.green}, 0.18)`,
        }}
      >
        <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {open ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M1 1h12v9H8l-3 3V10H1V1z" stroke="#4ade80" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="4.5" cy="5.5" r="0.8" fill="#4ade80"/>
              <circle cx="7" cy="5.5" r="0.8" fill="#4ade80"/>
              <circle cx="9.5" cy="5.5" r="0.8" fill="#4ade80"/>
            </svg>
          )}
          {unread > 0 && !open && (
            <UnreadBadge>{unread > 9 ? "9+" : unread}</UnreadBadge>
          )}
        </span>
        <DrawerTabLabel>Chat</DrawerTabLabel>
      </SideTab>

      {/* ── Backdrop ──────────────────────────────────────────────── */}
      {open && <Backdrop onClick={() => setOpen(false)} />}

      {/* ── Drawer ────────────────────────────────────────────────── */}
      <Panel
        style={{
          width,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: resizing.current ? "none" : "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: open ? "12px 0 60px rgba(0,0,0,0.7)" : "none",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <Header>
          <TitleWrap>
            {isTGV && (
              <>
                <TitleChatIcon size={14} />
                <TitleText>TGV Chat</TitleText>
              </>
            )}
            {selection.type === "dm" && peer && (
              <>
                <UserAvatar profile={peer} size={20} />
                <TitleText $color={peer.accentColor} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {peer.displayName}
                </TitleText>
                <DmTag>DM</DmTag>
              </>
            )}
            {selection.type === "group" && (
              <TitleText $color={VIOLET}>
                {groups.find((g) => g.id === selection.groupId)?.name ?? "Group"}
              </TitleText>
            )}
          </TitleWrap>

          {isTGV && (() => {
            const onlineProfiles = profiles
              .filter((p) => {
                if (p.username === currentUser) return false;
                return presence.find((pr) => pr.sysUser === p.username)?.online ?? false;
              })
              .sort((a, b) => a.displayName.localeCompare(b.displayName));
            const showOverflow = onlineProfiles.length > 2;
            const visibleChips = showOverflow ? [] : onlineProfiles;
            const overflowUsers = showOverflow ? onlineProfiles : [];
            return (
              <AvatarChips onClick={(e) => e.stopPropagation()}>
                {visibleChips.map((p) => (
                  <span
                    key={p.username}
                    title={p.displayName}
                    style={{ flexShrink: 0, cursor: "pointer" }}
                    onClick={() => { setSelection({ type: "dm", peer: p }); setDmMessages([]); }}
                  >
                    <UserAvatar profile={p} size={20} />
                  </span>
                ))}
                {showOverflow && (
                  <div style={{ position: "relative" }}>
                    <OnlineOverflowBtn
                      $open={onlineOverflowOpen}
                      onClick={() => setOnlineOverflowOpen((p) => !p)}
                      title={`${overflowUsers.length} online`}
                    >
                      <MembersIcon size={12} />
                      <span>{overflowUsers.length}</span>
                    </OnlineOverflowBtn>
                    {onlineOverflowOpen && (
                      <OnlineOverflowMenu onClick={(e) => e.stopPropagation()}>
                        {overflowUsers.map((p) => (
                          <OnlineOverflowItem
                            key={p.username}
                            $accent={p.accentColor}
                            onClick={() => {
                              setSelection({ type: "dm", peer: p });
                              setDmMessages([]);
                              setOnlineOverflowOpen(false);
                            }}
                          >
                            <span style={{ position: "relative", display: "block", flexShrink: 0 }}>
                              <UserAvatar profile={p} size={22} />
                              <OnlinePresenceDot $online />
                            </span>
                            <span>{p.displayName}</span>
                          </OnlineOverflowItem>
                        ))}
                      </OnlineOverflowMenu>
                    )}
                  </div>
                )}
              </AvatarChips>
            );
          })()}

          {isTGV && (
            <ControlBtn onClick={clearChat} title="Clear all messages">
              <TrashIcon size={14} />
            </ControlBtn>
          )}

          <ControlBtn onClick={() => setShowSettingsModal(true)} title="Settings">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 10.5A2.5 2.5 0 1 1 8 5.5a2.5 2.5 0 0 1 0 5zm5.29-2.77a5.07 5.07 0 0 0 .04-.73 5 5 0 0 0-.04-.73l1.57-1.23a.38.38 0 0 0 .09-.48l-1.49-2.57a.37.37 0 0 0-.45-.16l-1.85.74a5.4 5.4 0 0 0-1.26-.73L9.67.37A.36.36 0 0 0 9.31 0H6.69a.36.36 0 0 0-.36.37l-.27 1.97a5.4 5.4 0 0 0-1.26.73l-1.85-.74a.37.37 0 0 0-.45.16L1.05 4.86a.37.37 0 0 0 .09.48l1.57 1.23c-.03.24-.04.48-.04.73s.01.49.04.73L1.14 9.26a.37.37 0 0 0-.09.48l1.49 2.57c.09.16.28.22.45.16l1.85-.74c.39.28.82.52 1.26.73l.27 1.97c.05.2.24.37.45.37H9.3c.21 0 .4-.17.45-.37l.27-1.97a5.4 5.4 0 0 0 1.26-.73l1.85.74c.17.06.36 0 .45-.16l1.49-2.57a.37.37 0 0 0-.09-.48l-1.69-1.27z"/>
            </svg>
          </ControlBtn>

          <ControlBtn
            onClick={() => {
              const w = window.screen.width * 0.8;
              const h = window.screen.height * 0.85;
              const left = (window.screen.width - w) / 2;
              const top  = (window.screen.height - h) / 2;
              window.open("/dashboard/chat?popout=1", "tgv-chat-drawer", `width=${w},height=${h},left=${left},top=${top}`);
            }}
            title="Open in new window"
          >
            ⧉
          </ControlBtn>

          <ControlBtn onClick={() => setOpen(false)} title="Close (Esc)">
            ✕
          </ControlBtn>
        </Header>

        <Body>
          {/* ── Sidebar ──────────────────────────────────────────── */}
          {!sidebarCollapsed && (
            <>
              <Sidebar $width={sidebarWidth}>
                <SidebarHeader>
                  <SidebarTabSwitch>
                    <SidebarTabBtn
                      $active={sidebarTab === "users"}
                      onClick={() => setSidebarTab("users")}
                      title="Show direct-message users"
                    >
                      Users
                    </SidebarTabBtn>
                    <SidebarTabBtn
                      $active={sidebarTab === "groups"}
                      onClick={() => setSidebarTab("groups")}
                      title="Show group chats"
                    >
                      Groups
                    </SidebarTabBtn>
                  </SidebarTabSwitch>
                  <SidebarPlusBtn
                    onClick={() => setShowCreateGroup(true)}
                    title="New group chat"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M5 1v8M1 5h8"/>
                    </svg>
                  </SidebarPlusBtn>
                </SidebarHeader>

                <SidebarList>
                  <SidebarRowWrap $active={isTGV}>
                    <SidebarRow
                      $active={isTGV}
                      onClick={() => setSelection({ type: "tgv" })}
                      title="TGV Chat"
                    >
                      <TitleChatIcon size={12} />
                      <SidebarRowName>TGV Chat</SidebarRowName>
                      <PinBadge title="Pinned">★</PinBadge>
                    </SidebarRow>
                  </SidebarRowWrap>

                  {sidebarTab === "users" && profiles
                    .filter((p) => p.username !== currentUser)
                    .slice()
                    .sort((a, b) => {
                      const aOn = presence.find((pr) => pr.sysUser === a.username)?.online ?? false;
                      const bOn = presence.find((pr) => pr.sysUser === b.username)?.online ?? false;
                      if (aOn !== bOn) return aOn ? -1 : 1;
                      return a.displayName.localeCompare(b.displayName);
                    })
                    .map((p) => {
                      const online = presence.find((pr) => pr.sysUser === p.username)?.online ?? false;
                      const isActive = selection.type === "dm" && selection.peer.username === p.username;
                      const rowKey = `u:${p.username}`;
                      const menuOpen = rowHoverMenu === rowKey;
                      return (
                        <SidebarRowWrap key={p.username} $active={isActive}>
                          <SidebarRow
                            $active={isActive}
                            $accent={p.accentColor}
                            onClick={() => {
                              setSelection({ type: "dm", peer: p });
                              setDmMessages([]);
                            }}
                            title={p.displayName}
                          >
                            <UserAvatar profile={p} size={18} />
                            <SidebarRowName>{p.displayName}</SidebarRowName>
                            <SidebarRowPresence $online={online} />
                          </SidebarRow>
                          <RowHoverMenuBtn
                            $open={menuOpen}
                            onClick={(e) => { e.stopPropagation(); setRowHoverMenu(menuOpen ? null : rowKey); }}
                            title="More"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                              <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </RowHoverMenuBtn>
                          {menuOpen && (
                            <RowHoverMenu onClick={(e) => e.stopPropagation()}>
                              <RowHoverMenuItem onClick={() => {
                                setSelection({ type: "dm", peer: p });
                                setDmMessages([]);
                                setRowHoverMenu(null);
                              }}>
                                💬 Open DM
                              </RowHoverMenuItem>
                              <RowHoverMenuItem onClick={() => {
                                const text = `Continuing my conversation with ${p.displayName} from TGV Office`;
                                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
                                setRowHoverMenu(null);
                              }}>
                                🟢 Continue in WhatsApp
                              </RowHoverMenuItem>
                            </RowHoverMenu>
                          )}
                        </SidebarRowWrap>
                      );
                    })}

                  {sidebarTab === "groups" && (
                    <>
                      {groups.map((g) => {
                        const isActive = selection.type === "group" && selection.groupId === g.id;
                        const rowKey = `g:${g.id}`;
                        const menuOpen = rowHoverMenu === rowKey;
                        return (
                          <SidebarRowWrap key={g.id} $active={isActive}>
                            <SidebarRow
                              $active={isActive}
                              onClick={() => setSelection({ type: "group", groupId: g.id })}
                              title={g.name}
                            >
                              <MembersIcon size={14} />
                              <SidebarRowName>{g.name}</SidebarRowName>
                            </SidebarRow>
                            <RowHoverMenuBtn
                              $open={menuOpen}
                              onClick={(e) => { e.stopPropagation(); setRowHoverMenu(menuOpen ? null : rowKey); }}
                              title="More"
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                                <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </RowHoverMenuBtn>
                            {menuOpen && (
                              <RowHoverMenu onClick={(e) => e.stopPropagation()}>
                                <RowHoverMenuItem onClick={() => {
                                  setSelection({ type: "group", groupId: g.id });
                                  setRowHoverMenu(null);
                                }}>
                                  👥 Open group
                                </RowHoverMenuItem>
                                <RowHoverMenuItem onClick={() => setRowHoverMenu(null)}>
                                  🔕 Mute (soon)
                                </RowHoverMenuItem>
                              </RowHoverMenu>
                            )}
                          </SidebarRowWrap>
                        );
                      })}
                      <DashedCreateCard onClick={() => setShowCreateGroup(true)}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                          <path d="M5 1v8M1 5h8"/>
                        </svg>
                        Create a group chat
                      </DashedCreateCard>
                    </>
                  )}
                </SidebarList>
              </Sidebar>

              <SidebarResizer onMouseDown={onSidebarResizeStart} title="Drag to resize" />
            </>
          )}

          <ConvPane>
            <DTogTab
              $collapsed={sidebarCollapsed}
              onClick={() => setSidebarCollapsed((p) => !p)}
              title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              {sidebarCollapsed ? "›" : "‹"}
            </DTogTab>

            {/* ── Chat messages ────────────────────────────────── */}
            {isTGV && (
              <MsgScroll>
                {messages.length === 0 ? (
                  <EmptyChat>
                    <EmptyIcon>💬</EmptyIcon>
                    <EmptyText>No messages yet. Say hi!</EmptyText>
                  </EmptyChat>
                ) : (() => {
                  let lastKey = "";
                  return messages.map((msg) => {
                    const profile = profiles.find((p) => p.username === msg.from);
                    const k = dayKey(msg.createdAt, settings.timezone);
                    const showDivider = k !== lastKey;
                    lastKey = k;
                    return (
                      <Fragment key={msg.id}>
                        {showDivider && (
                          <DayDivider>
                            <DayDividerLabel>{fmtDayDivider(msg.createdAt, settings.timezone)}</DayDividerLabel>
                          </DayDivider>
                        )}
                        <MessageBubble
                          id={msg.id} from={msg.from} content={msg.content}
                          fileUrl={msg.fileUrl} fileName={msg.fileName} fileSize={msg.fileSize} fileMime={msg.fileMime}
                          createdAt={msg.createdAt} editedAt={msg.editedAt}
                          profile={profile} isMe={msg.from === currentUser}
                          settings={settings} canDelete={msg.from === currentUser || isAdmin}
                          onDelete={() => deleteMessage(msg.id)}
                          onEdit={(content) => editMessage(msg.id, content)}
                        />
                      </Fragment>
                    );
                  });
                })()}
                <div ref={bottomRef} />
              </MsgScroll>
            )}

            {/* ── DM thread ────────────────────────────────────── */}
            {selection.type === "dm" && peer && (
              <MsgScroll>
                {dmMessages.length === 0 ? (
                  <EmptyChat>
                    <UserAvatar profile={peer} size={40} />
                    <EmptyText style={{ marginTop: "0.25rem" }}>Start a conversation with {peer.displayName}</EmptyText>
                  </EmptyChat>
                ) : (() => {
                  let lastKey = "";
                  return dmMessages.map((msg) => {
                    const profile = profiles.find((p) => p.username === msg.from);
                    const k = dayKey(msg.createdAt, settings.timezone);
                    const showDivider = k !== lastKey;
                    lastKey = k;
                    return (
                      <Fragment key={msg.id}>
                        {showDivider && (
                          <DayDivider>
                            <DayDividerLabel>{fmtDayDivider(msg.createdAt, settings.timezone)}</DayDividerLabel>
                          </DayDivider>
                        )}
                        <MessageBubble
                          id={msg.id} from={msg.from} content={msg.content}
                          createdAt={msg.createdAt} editedAt={msg.editedAt}
                          profile={profile} isMe={msg.from === currentUser}
                          settings={settings} canDelete={msg.from === currentUser}
                          onDelete={() => deleteDm(msg.id)}
                          onEdit={(content) => editDm(msg.id, content)}
                        />
                      </Fragment>
                    );
                  });
                })()}
                <div ref={dmBottomRef} />
              </MsgScroll>
            )}

            {/* ── Group placeholder (1c wires real data) ──────── */}
            {selection.type === "group" && (
              <MsgScroll>
                <EmptyChat>
                  <EmptyIcon>👥</EmptyIcon>
                  <EmptyText>Group chat data model arrives in the next step.</EmptyText>
                </EmptyChat>
              </MsgScroll>
            )}

            {/* ── Input (TGV + DM) ─────────────────────────────── */}
            {(isTGV || selection.type === "dm") && (
              <InputArea>
                {isTGV && uploadFile && (
                  (thumbUrl && (uploadFile.type.startsWith("image/") || uploadFile.type.startsWith("video/"))) ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <ThumbPreview>
                        <ThumbImg
                          src={thumbUrl}
                          alt="preview"
                          onClick={() => setPreviewOpen(true)}
                          title="Click to preview"
                        />
                        {uploadFile.type.startsWith("video/") && (
                          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                            <span style={{ fontSize: "1rem", opacity: 0.8 }}>▶</span>
                          </span>
                        )}
                        <ThumbRemove onClick={() => setUploadFile(null)} title="Remove attachment">✕</ThumbRemove>
                      </ThumbPreview>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <FilePreviewName style={{ display: "block" }}>{uploadFile.name}</FilePreviewName>
                        <FilePreviewSize>{fmtBytes(uploadFile.size)}</FilePreviewSize>
                      </div>
                    </div>
                  ) : (
                    <FilePreview>
                      <FilePreviewName>📎 {uploadFile.name}</FilePreviewName>
                      <FilePreviewSize>{fmtBytes(uploadFile.size)}</FilePreviewSize>
                      <FilePreviewClose onClick={() => setUploadFile(null)} title="Remove attachment">✕</FilePreviewClose>
                    </FilePreview>
                  )
                )}

                {(() => {
                  const composer = selection.type === "dm" ? dmInput : input;
                  const gifs = extractGifUrls(composer);
                  if (!gifs.length) return null;
                  const removeGif = (url: string) => {
                    const stripped = composer.replace(url, "").replace(/\s+/g, " ").trim();
                    if (selection.type === "dm") setDmInput(stripped);
                    else setInput(stripped);
                  };
                  return (
                    <GifPreviewStrip>
                      {gifs.map((url) => (
                        <GifPreviewItem key={url}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="gif preview" />
                          <GifPreviewRemove onClick={() => removeGif(url)} title="Remove GIF">✕</GifPreviewRemove>
                        </GifPreviewItem>
                      ))}
                    </GifPreviewStrip>
                  );
                })()}

                {typers.length > 0 && (
                  <TypingRow>
                    <span style={{ display: "flex", gap: "2px", alignItems: "flex-end" }}>
                      {[0, 1, 2].map((i) => (
                        <TypingDot key={i} $delay={i * 0.2} />
                      ))}
                    </span>
                    <TypingText>
                      {typers.length === 1
                        ? `${typers[0]} is typing…`
                        : typers.length === 2
                        ? `${typers[0]} and ${typers[1]} are typing…`
                        : "Several people are typing…"}
                    </TypingText>
                  </TypingRow>
                )}

                <InputRow>
                  {isTGV && (
                    <>
                      <AttachMenuAnchor onClick={(e) => e.stopPropagation()}>
                        <AttachBtn onClick={() => setAttachMenuOpen((p) => !p)} title="Attach">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                          </svg>
                        </AttachBtn>
                        {attachMenuOpen && (
                          <AttachMenuPopup>
                            <AttachMenuItem onClick={() => { setAttachMenuOpen(false); fileRef.current?.click(); }}>
                              <AttachMenuIcon><FileIcon size={16} /></AttachMenuIcon> File
                            </AttachMenuItem>
                            <AttachMenuItem onClick={() => { setAttachMenuOpen(false); photoRef.current?.click(); }}>
                              <AttachMenuIcon><PhotosIcon size={16} /></AttachMenuIcon> Photos &amp; videos
                            </AttachMenuItem>
                            <AttachMenuItem $disabled onClick={() => setAttachMenuOpen(false)}>
                              <AttachMenuIcon><ContactIcon size={16} /></AttachMenuIcon> Contact
                              <AttachMenuSoon>soon</AttachMenuSoon>
                            </AttachMenuItem>
                            <AttachMenuItem $disabled onClick={() => setAttachMenuOpen(false)}>
                              <AttachMenuIcon><PollIcon size={16} /></AttachMenuIcon> Poll
                              <AttachMenuSoon>soon</AttachMenuSoon>
                            </AttachMenuItem>
                            <AttachMenuItem $disabled onClick={() => setAttachMenuOpen(false)}>
                              <AttachMenuIcon><EventIcon size={16} /></AttachMenuIcon> Event
                              <AttachMenuSoon>soon</AttachMenuSoon>
                            </AttachMenuItem>
                            <AttachMenuItem onClick={() => { setAttachMenuOpen(false); setConverterType("image"); }}>
                              <AttachMenuIcon><ConvertImageIcon size={16} /></AttachMenuIcon> Convert image
                            </AttachMenuItem>
                            <AttachMenuItem onClick={() => { setAttachMenuOpen(false); setConverterType("video"); }}>
                              <AttachMenuIcon><ConvertVideoIcon size={16} /></AttachMenuIcon> Convert video
                            </AttachMenuItem>
                          </AttachMenuPopup>
                        )}
                      </AttachMenuAnchor>
                      <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileChange} />
                      <input ref={photoRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFileChange} />
                    </>
                  )}

                  <PickerAnchor onClick={(e) => e.stopPropagation()}>
                    <PickerBtn onClick={() => setPickerOpen((p) => !p)} title="Emoji · GIFs · Stickers">
                      😊
                    </PickerBtn>
                    {pickerOpen && (
                      <ChatPicker
                        onClose={() => setPickerOpen(false)}
                        onEmoji={(e) => {
                          if (selection.type === "dm") setDmInput((prev) => prev + e);
                          else setInput((prev) => prev + e);
                        }}
                        onGif={(url) => {
                          if (selection.type === "dm") setDmInput((prev) => (prev ? `${prev} ${url}` : url));
                          else setInput((prev) => (prev ? `${prev} ${url}` : url));
                        }}
                        onSticker={(url) => {
                          if (selection.type === "dm") setDmInput((prev) => (prev ? `${prev} ${url}` : url));
                          else setInput((prev) => (prev ? `${prev} ${url}` : url));
                        }}
                      />
                    )}
                  </PickerAnchor>

                  <ChatTextarea
                    value={selection.type === "dm" ? dmInput : input}
                    onChange={(e) => {
                      if (selection.type === "dm") setDmInput(e.target.value);
                      else setInput(e.target.value);
                      if (e.target.value.trim()) signalTyping();
                    }}
                    onKeyDown={(e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        selection.type === "dm" ? sendDm() : sendMessage();
                      }
                    }}
                    placeholder={selection.type === "dm" && peer ? `Message ${peer.displayName}…` : "Enter to send · Shift+Enter for newline"}
                    rows={1}
                    $accent={selection.type === "dm" ? (peer?.accentColor ?? VIOLET) : undefined}
                    style={{
                      fontSize: settings.fontSize === "xs" ? 11 : settings.fontSize === "sm" ? 13 : 15,
                    }}
                  />

                  <SendBtn
                    onClick={selection.type === "dm" ? sendDm : sendMessage}
                    disabled={selection.type === "dm" ? (!dmInput.trim() || dmSending) : ((sending || uploading) || (!input.trim() && !uploadFile))}
                    $color={selection.type === "dm" ? (peer?.accentColor ?? VIOLET) : undefined}
                    title="Send (Enter)"
                  >
                    {(sending || uploading || dmSending) ? (
                      <span style={{ fontSize: "0.5625rem" }}>…</span>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M0 12L12 6 0 0v4.5l8.57 1.5L0 7.5z"/>
                      </svg>
                    )}
                  </SendBtn>
                </InputRow>
              </InputArea>
            )}
          </ConvPane>
        </Body>

        <Resize onMouseDown={onResizeStart} />
      </Panel>

      {showSettingsModal && (
        <ChatSettingsModal
          settings={settings}
          onSettingsChange={saveSettings}
          profiles={profiles}
          currentUser={currentUser}
          storagePercent={storagePercent}
          onClearChat={clearChat}
          onClose={() => setShowSettingsModal(false)}
          onProfileRefresh={loadProfiles}
        />
      )}

      {converterType && (
        <MediaConverterModal
          defaultTab={converterType}
          onClose={() => setConverterType(null)}
          onFileConverted={(file) => { setUploadFile(file); setConverterType(null); }}
        />
      )}

      {previewOpen && uploadFile && (
        <FileLightbox file={uploadFile} onClose={() => setPreviewOpen(false)} />
      )}

      {showCreateGroup && (
        <CreateGroupBackdrop onClick={() => setShowCreateGroup(false)}>
          <CreateGroupCard onClick={(e) => e.stopPropagation()}>
            <CreateGroupTitle>Create a group chat</CreateGroupTitle>
            <CreateGroupText>Group chat creation arrives in the next step (1c — data model + endpoints).</CreateGroupText>
            <CreateGroupCloseBtn onClick={() => setShowCreateGroup(false)}>Close</CreateGroupCloseBtn>
          </CreateGroupCard>
        </CreateGroupBackdrop>
      )}
    </>
  );
}
