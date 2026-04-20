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
import { createPortal } from "react-dom";
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
import VoiceRecorder from "./VoiceRecorder";
import VoicePlayer from "./VoicePlayer";
import TalkToText from "./TalkToText";
import CreateGroupModal from "./CreateGroupModal";
import GroupAdminModal from "./GroupAdminModal";
import Tooltip from "./ui/Tooltip";
import NeonX from "./NeonX";
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
  EditIcon,
  CancelIcon,
  SmileIcon,
  AttachIcon,
  SendIcon,
  ReplyIcon,
  MicIcon,
  WaveformIcon,
  VideoIcon,
  PhoneIcon,
  DTogExpandIcon,
  DrawerChatsIcon,
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
  readBy?: string[];
  replyTo?: { id: string; from: string; excerpt: string };
  reactions?: Record<string, string[]>;
};

type DmMessage = {
  id: string;
  from: string;
  to: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  readBy?: string[];
  replyTo?: { id: string; from: string; excerpt: string };
  reactions?: Record<string, string[]>;
};

type Profile = MemberProfile;
type ChatSettings = ModalChatSettings;

type GroupChat = {
  id: string;
  name: string;
  createdBy?: string;
  memberIds: string[];
  admins?: string[];
  visibility?: "open" | "restricted" | "invisible";
  isMember?: boolean;
  isAdmin?: boolean;
};

type GroupMessage = {
  id: string;
  groupId: string;
  from: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  readBy?: string[];
  replyTo?: { id: string; from: string; excerpt: string };
  reactions?: Record<string, string[]>;
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
  whisperModel: "base.en",
};

const SETTINGS_KEY    = "tgv_chat_settings";
const TAB_STORAGE_KEY = "tgv-drawer-tab-chat-y";
const DRAWER_EVENT    = "tgv-right-drawer";
const MIN_W           = 420;
const SIDEBAR_MIN     = 96;
const SIDEBAR_NARROW  = 172;
const SIDEBAR_COLLAPSE_AT = 96;
const SIDEBAR_DEFAULT = 172;
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

const SideTab = styled(DrawerTab).attrs({ $side: "left", $accent: "green" })<{ $openLeft: string; $open: boolean }>`
  left: ${(p) => p.$openLeft};
  z-index: 71;
  border-left: none;
  transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s, box-shadow 0.2s;
  backdrop-filter: ${(p) => (p.$open ? "none" : "blur(8px)")};

  @media (max-width: 768px) {
    left: ${(p) => (p.$openLeft === "0" ? "0" : "calc(100vw - 28px)")};
  }
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
  z-index: 69;
  backdrop-filter: blur(1px);
`;

const Panel = styled(DrawerPanel)`
  left: 0;
  z-index: 70;
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

const GroupManageBtn = styled.button`
  display: inline-flex; align-items: center; gap: 0.2rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: rgba(${rgb.green}, 0.12);
  border: 1px solid rgba(${rgb.green}, 0.35);
  color: ${colors.green};
  font-size: 0.625rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: rgba(${rgb.green}, 0.22); box-shadow: 0 0 6px rgba(${rgb.green}, 0.3); }
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
  gap: 0.5rem;
  padding: 0 0.25rem 0.25rem;
  justify-content: flex-start;
`;

const TypingBubble = styled.span`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 7px 11px;
  border-radius: 14px 14px 14px 4px;
  background: var(--t-surface);
  border: 1px solid var(--t-border);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);

  &::before {
    content: "";
    position: absolute;
    bottom: -1px;
    left: -5px;
    width: 9px;
    height: 9px;
    background: var(--t-surface);
    border-left: 1px solid var(--t-border);
    border-bottom: 1px solid var(--t-border);
    border-bottom-left-radius: 3px;
    clip-path: polygon(0 0, 100% 100%, 100% 0);
  }
`;

const TypingDot = styled.span<{ $delay: number }>`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--t-textMuted);
  animation: typingBounce 1.2s ease-in-out ${(p) => p.$delay}s infinite;

  @keyframes typingBounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
    40% { transform: translateY(-3px); opacity: 1; }
  }
`;

const TypingText = styled.span`
  font-size: 0.6875rem;
  color: var(--t-textGhost);
  font-style: italic;
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
  background: rgba(${rgb.green}, 0.08);
  border: 1px solid rgba(${rgb.green}, 0.3);
  color: ${colors.green};
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(${rgb.green}, 0.14);
    box-shadow: 0 0 8px rgba(${rgb.green}, 0.3);
  }

  [data-theme="light"] & {
    background: rgba(${rgb.green}, 0.05);
    border-color: rgba(${rgb.green}, 0.2);
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

  &:hover {
    background: rgba(${rgb.green}, 0.14);
    box-shadow: 0 0 8px rgba(${rgb.green}, 0.35);
  }
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
  flex: 1 1 0;
  min-width: 100px;
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

const ComposerMoreBtn = styled.button<{ $open?: boolean }>`
  width: 2rem;
  height: 2rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(${rgb.green}, ${(p) => (p.$open ? 0.18 : 0.08)});
  border: 1px solid rgba(${rgb.green}, ${(p) => (p.$open ? 0.55 : 0.3)});
  color: ${colors.green};
  cursor: pointer;
  transition: all 0.15s;
  font-size: 1rem;
  line-height: 1;

  &:hover {
    background: rgba(${rgb.green}, 0.18);
    box-shadow: 0 0 8px rgba(${rgb.green}, 0.35);
  }
`;

const ComposerMoreAnchor = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const ComposerMorePopup = styled.div`
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 220;
  min-width: 180px;
  padding: 0.3rem 0;
  border-radius: 10px;
  background: var(--t-surface);
  border: 1px solid var(--t-border);
  box-shadow: 0 10px 28px rgba(0,0,0,0.42);
  display: flex;
  flex-direction: column;
`;

const ComposerMoreItem = styled.button`
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 0.5rem 0.8rem;
  font-size: 0.75rem;
  color: var(--t-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  white-space: nowrap;
  &:hover {
    background: rgba(${rgb.green}, 0.1);
    color: ${colors.green};
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
  background: ${(p) => p.$color ? `${p.$color}22` : `rgba(${rgb.green}, 0.15)`};
  border: 1px solid ${(p) => p.$color ? `${p.$color}55` : `rgba(${rgb.green}, 0.4)`};
  color: ${(p) => p.$color || colors.green};

  &:hover:not(:disabled) {
    box-shadow: 0 0 10px ${(p) => p.$color ? `${p.$color}55` : `rgba(${rgb.green}, 0.4)`};
  }

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

  /* WhatsApp-style tail jutting from the outer top corner */
  &::before {
    content: "";
    position: absolute;
    top: -1px;
    ${(p) => (p.$isMe ? "right: -7px;" : "left: -7px;")}
    width: 0;
    height: 0;
    border-style: solid;
    ${(p) =>
      p.$isMe
        ? `border-width: 0 0 8px 8px;
           border-color: transparent transparent transparent ${p.$accent ? `rgba(${hexToRgb(p.$accent)}, 0.18)` : `rgba(${rgb.pink}, 0.18)`};`
        : `border-width: 0 8px 8px 0;
           border-color: transparent var(--t-inputBg) transparent transparent;`}
    filter: drop-shadow(${(p) => (p.$isMe ? "1px 0" : "-1px 0")} 0 ${(p) => (p.$isMe ? `${p.$accent || colors.pink}44` : "var(--t-borderStrong)")});
  }

  [data-theme="light"] & {
    background: ${(p) =>
      p.$isMe
        ? `rgba(${p.$accent ? hexToRgb(p.$accent) : rgb.pink}, 0.1)`
        : "rgba(0, 0, 0, 0.03)"};
    color: var(--t-text);

    &::before {
      ${(p) =>
        p.$isMe
          ? `border-color: transparent transparent transparent rgba(${p.$accent ? hexToRgb(p.$accent) : rgb.pink}, 0.1);`
          : `border-color: transparent rgba(0,0,0,0.03) transparent transparent;`}
    }
  }
`;

const BubbleActions = styled.div<{ $isMe?: boolean }>`
  position: absolute;
  top: 0;
  ${(p) => (p.$isMe ? "left: 0; transform: translateX(-100%); padding-right: 0.35rem;" : "right: 0; transform: translateX(100%); padding-left: 0.35rem;")}
  display: flex;
  align-items: center;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.15s;

  ${BubbleRow}:hover & {
    opacity: 1;
  }
`;

const BubbleActionBtn = styled.button<{ $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  color: ${colors.green};
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s, color 0.15s, transform 0.1s;

  &:hover {
    background: rgba(${rgb.green}, 0.12);
    border-color: rgba(${rgb.green}, 0.45);
    box-shadow: 0 0 8px rgba(${rgb.green}, 0.35);
    color: ${(p) => (p.$danger ? colors.red : colors.green)};
    transform: scale(1.06);
  }

  &:active { transform: scale(0.96); }
`;

const BubbleChevron = styled.button<{ $isMe: boolean; $accent: string }>`
  position: absolute;
  top: 4px;
  ${(p) => (p.$isMe ? "right: 4px;" : "right: 4px;")}
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 9999px;
  background: ${(p) => `linear-gradient(to bottom, transparent, ${p.$isMe ? `rgba(${rgb.green}, 0.18)` : "rgba(0,0,0,0.18)"})`};
  color: ${(p) => (p.$isMe ? colors.green : "var(--t-textMuted)")};
  cursor: pointer;
  opacity: 0;
  transform: translateY(-2px);
  transition: opacity 0.15s, background 0.15s, color 0.15s;

  ${BubbleRow}:hover & {
    opacity: 1;
  }

  &:hover,
  &[data-open="true"] {
    opacity: 1;
    background: rgba(${rgb.green}, 0.22);
    color: ${colors.green};
  }

  svg {
    display: block;
  }
`;

const BubbleMenuPopup = styled.div<{ $accent: string }>`
  position: fixed;
  z-index: 10050;
  min-width: 184px;
  border-radius: 10px;
  padding: 6px 0;
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.green}, 0.25);
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.45),
    0 0 18px rgba(${rgb.green}, 0.18);
  font-size: 0.8125rem;
  animation: bm-in 0.12s ease-out;

  @keyframes bm-in {
    from { opacity: 0; transform: translateY(-3px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  [data-theme="light"] & {
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
  }
`;

const BubbleMenuItem = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.5rem 0.9rem;
  background: none;
  border: none;
  text-align: left;
  color: ${(p) => (p.$danger ? colors.red : colors.green)};
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: ${(p) => (p.$danger ? `rgba(${rgb.red}, 0.14)` : `rgba(${rgb.green}, 0.14)`)};
  }
`;

const BubbleMenuGlyph = styled.span`
  display: inline-flex;
  width: 16px;
  font-size: 0.875rem;
  color: currentColor;
  justify-content: center;
`;

const BubbleMenuDivider = styled.div`
  height: 1px;
  margin: 4px 0;
  background: var(--t-border);
`;

const ReactEmojiBtn = styled.button<{ $isMe: boolean; $accent: string }>`
  position: absolute;
  bottom: -8px;
  ${(p) => (p.$isMe ? "left: -10px;" : "right: -10px;")}
  width: 26px;
  height: 26px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.green}, 0.35);
  color: ${(p) => p.$accent};
  cursor: pointer;
  font-size: 0.875rem;
  line-height: 1;
  opacity: 0;
  transform: scale(0.9);
  transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s, background 0.15s;

  ${BubbleRow}:hover & {
    opacity: 1;
    transform: scale(1);
  }

  &:hover {
    opacity: 1;
    box-shadow: 0 0 8px rgba(${rgb.green}, 0.45);
    background: rgba(${rgb.green}, 0.12);
  }
`;

const ReactionTray = styled.div<{ $accent: string }>`
  position: fixed;
  z-index: 10060;
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.3rem 0.4rem;
  border-radius: 9999px;
  background: #0a0f14;
  border: 1px solid color-mix(in srgb, ${(p) => p.$accent} 45%, transparent);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5), 0 0 14px color-mix(in srgb, ${(p) => p.$accent} 35%, transparent);
  animation: rt-in 0.12s ease-out;

  [data-theme="light"] & {
    background: #ffffff;
  }

  @keyframes rt-in {
    from { opacity: 0; transform: translateY(-3px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

const ReactionTrayBtn = styled.button<{ $accent: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 9999px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  transition: background 0.12s, transform 0.1s;

  &:hover {
    background: color-mix(in srgb, ${(p) => p.$accent} 18%, transparent);
    transform: scale(1.15);
  }
`;

const ReactionRow = styled.div<{ $isMe: boolean }>`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.3rem;
  ${(p) => (p.$isMe ? "justify-content: flex-end;" : "")}
`;

const ReactionChip = styled.button<{ $accent: string; $mine: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.45rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  line-height: 1.2;
  cursor: pointer;
  background: ${(p) => p.$mine
    ? `color-mix(in srgb, ${p.$accent} 20%, transparent)`
    : "color-mix(in srgb, var(--t-text) 8%, transparent)"};
  border: 1px solid ${(p) => p.$mine
    ? `color-mix(in srgb, ${p.$accent} 55%, transparent)`
    : "color-mix(in srgb, var(--t-text) 18%, transparent)"};
  color: var(--t-text);
  transition: background 0.12s, border-color 0.12s, transform 0.08s;

  &:hover {
    background: color-mix(in srgb, ${(p) => p.$accent} 14%, transparent);
  }
  &:active { transform: scale(0.94); }
`;

const ReactionChipCount = styled.span`
  font-weight: 600;
  opacity: 0.85;
`;

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const MsgScrollWrap = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const ScrollToBottomBtn = styled.button<{ $visible: boolean }>`
  position: absolute;
  right: 1rem;
  bottom: 1rem;
  width: 36px;
  height: 36px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(${rgb.green}, 0.6);
  background: #0a0f14;
  color: ${colors.green};
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5), 0 0 14px rgba(${rgb.green}, 0.35);
  z-index: 30;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  pointer-events: ${(p) => (p.$visible ? "auto" : "none")};
  transform: ${(p) => (p.$visible ? "translateY(0)" : "translateY(6px)")};
  transition: opacity 0.18s, transform 0.18s, box-shadow 0.15s, background 0.15s;

  [data-theme="light"] & {
    background: #ffffff;
  }

  &:hover {
    background: #111820;
    box-shadow: 0 6px 22px rgba(0, 0, 0, 0.55), 0 0 20px rgba(${rgb.green}, 0.6);
  }
  [data-theme="light"] &:hover {
    background: #f4f6f8;
  }

  svg { display: block; }
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

// ── Styled: reply quote (inside incoming bubble) ─────────────────────────────

const QuotedReply = styled.button<{ $accent: string }>`
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 8px 6px 10px;
  margin: 0 0 6px 0;
  border: none;
  border-left: 3px solid ${(p) => p.$accent};
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: rgba(255, 255, 255, 0.08); }
`;

const QuotedFrom = styled.div<{ $accent: string }>`
  font-size: 0.6875rem;
  font-weight: 600;
  color: ${(p) => p.$accent};
  margin-bottom: 2px;
`;

const QuotedExcerpt = styled.div<{ $expanded?: boolean }>`
  font-size: 0.75rem;
  color: var(--t-textMuted);
  ${(p) => p.$expanded
    ? "white-space: pre-wrap; word-break: break-word;"
    : "overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;"}
`;

const MoreBtn = styled.span`
  display: inline-block;
  margin-top: 2px;
  font-size: 0.6875rem;
  color: ${colors.green};
  cursor: pointer;

  &:hover { text-decoration: underline; }
`;

// ── Styled: composer reply chip ──────────────────────────────────────────────

const ReplyChipRow = styled.div<{ $accent: string }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 6px 10px;
  margin-bottom: 0.25rem;
  border-radius: 8px 8px 0 0;
  background: var(--t-surface);
  border: 1px solid var(--t-border);
  border-left: 3px solid ${(p) => p.$accent};
`;

const ReplyChipCol = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

const ReplyChipFrom = styled.div<{ $accent: string }>`
  font-size: 0.6875rem;
  font-weight: 600;
  color: ${(p) => p.$accent};
`;

const ReplyChipExcerpt = styled.div`
  font-size: 0.75rem;
  color: var(--t-textMuted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ReplyChipClose = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--t-textMuted);
  cursor: pointer;
  border-radius: 4px;

  &:hover { background: rgba(255, 255, 255, 0.06); color: var(--t-text); }
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

const URL_RE = /https?:\/\/[^\s<>"')]+/gi;
function extractFirstUrl(text: string): string | null {
  if (!text) return null;
  const matches = text.match(URL_RE);
  if (!matches) return null;
  for (const u of matches) {
    if (GIF_URL_RE.test(u)) { GIF_URL_RE.lastIndex = 0; continue; }
    GIF_URL_RE.lastIndex = 0;
    return u;
  }
  return null;
}

function makeExcerpt(content: string, fileName?: string): string {
  const source = (content?.trim() || "") || (fileName ? `📎 ${fileName}` : "");
  const max = 118;
  const single = source.replace(/\s+/g, " ").trim();
  if (single.length <= max) return single;
  return single.slice(0, max).trimEnd() + "…";
}

type OgMeta = { url: string; title?: string; description?: string; image?: string; siteName?: string };
const OG_CACHE = new Map<string, OgMeta | null>();
function fetchOg(url: string): Promise<OgMeta | null> {
  if (OG_CACHE.has(url)) return Promise.resolve(OG_CACHE.get(url) ?? null);
  return fetch(`/api/chat/og?url=${encodeURIComponent(url)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((meta) => {
      const m = meta && typeof meta === "object" ? meta as OgMeta : null;
      OG_CACHE.set(url, m);
      return m;
    })
    .catch(() => { OG_CACHE.set(url, null); return null; });
}

const OgCard = styled.a`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.375rem;
  padding: 0.5rem;
  border-radius: 0.625rem;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);
  text-decoration: none;
  color: inherit;
  max-width: 320px;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover {
    border-color: rgba(${rgb.green}, 0.45);
    box-shadow: 0 0 10px rgba(${rgb.green}, 0.2);
  }
`;
const OgThumb = styled.img`
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 0.5rem;
  flex-shrink: 0;
  background: var(--t-surface);
`;
const OgCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  flex: 1;
`;
const OgSite = styled.span`
  font-size: 0.5rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${colors.green};
`;
const OgTitle = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--t-text);
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;
const OgDesc = styled.span`
  font-size: 0.625rem;
  color: var(--t-textFaint);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

function OgPreview({ url }: { url: string }) {
  const [meta, setMeta] = useState<OgMeta | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchOg(url).then((m) => { if (alive) { setMeta(m); setLoaded(true); } });
    return () => { alive = false; };
  }, [url]);
  if (!loaded || !meta || (!meta.title && !meta.description && !meta.image)) return null;
  return (
    <OgCard href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
      {meta.image && <OgThumb src={meta.image} alt="" loading="lazy" />}
      <OgCol>
        {meta.siteName && <OgSite>{meta.siteName}</OgSite>}
        {meta.title && <OgTitle>{meta.title}</OgTitle>}
        {meta.description && <OgDesc>{meta.description}</OgDesc>}
      </OgCol>
    </OgCard>
  );
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

const AttachGlyph = styled.span`
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
  min-width: 0;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--t-border);
  background: rgba(${rgb.green}, 0.02);
  overflow: hidden;

  @media (max-width: 768px) {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 4;
    background: rgba(7, 9, 13, 0.99);
    border-right: 1px solid rgba(${rgb.green}, 0.35);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.6);

    [data-theme="light"] & {
      background: var(--t-surface);
    }
  }
`;

// ── Mobile WhatsApp-style list view ───────────────────────────────────────────

const MobileList = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--t-surface, rgba(7, 9, 13, 0.99));
  overflow: hidden;
`;

const MobileListHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem 0.5rem;
  flex-shrink: 0;
`;

const MobileTitle = styled.h2`
  flex: 1;
  font-size: 1.25rem;
  font-weight: 700;
  color: ${colors.green};
  margin: 0;
  letter-spacing: -0.01em;
`;

const MobileHeaderBtn = styled.button<{ $primary?: boolean }>`
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${(p) => (p.$primary ? `rgba(${rgb.green}, 0.25)` : "rgba(255,255,255,0.05)")};
  border: 1px solid rgba(${rgb.green}, ${(p) => (p.$primary ? 0.55 : 0.18)});
  color: ${colors.green};
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: rgba(${rgb.green}, ${(p) => (p.$primary ? 0.35 : 0.14)}); }
`;

const MobileSearchWrap = styled.div`
  padding: 0 0.875rem 0.5rem;
  flex-shrink: 0;
`;

const MobileSearchInput = styled.input`
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2rem;
  border-radius: 999px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(${rgb.green}, 0.18);
  color: var(--t-text);
  font-size: 0.8125rem;
  outline: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%2300ff87' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><circle cx='7' cy='7' r='5'/><path d='M11 11l3.5 3.5'/></svg>");
  background-repeat: no-repeat;
  background-position: 0.625rem center;
  background-size: 14px 14px;

  &:focus { border-color: rgba(${rgb.green}, 0.4); }
  &::placeholder { color: var(--t-textGhost); }
`;

const MobilePillRow = styled.div`
  display: flex;
  gap: 0.375rem;
  padding: 0 0.875rem 0.625rem;
  overflow-x: auto;
  flex-shrink: 0;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const MobilePill = styled.button<{ $active?: boolean }>`
  padding: 0.3125rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid rgba(${rgb.green}, ${(p) => (p.$active ? 0.55 : 0.2)});
  background: ${(p) => (p.$active ? `rgba(${rgb.green}, 0.2)` : "transparent")};
  color: ${(p) => (p.$active ? colors.green : "var(--t-textMuted)")};
  transition: all 0.15s;
  &:hover { background: rgba(${rgb.green}, ${(p) => (p.$active ? 0.28 : 0.08)}); }
`;

const MobileScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const MobileArchivedBar = styled.button`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.625rem 0.875rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(${rgb.green}, 0.1);
  color: var(--t-textMuted);
  font-size: 0.8125rem;
  cursor: pointer;
  text-align: left;
  &:hover { background: rgba(${rgb.green}, 0.04); }
`;

const MobileArchivedIcon = styled.span`
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(${rgb.green}, 0.12);
  color: ${colors.green};
  flex-shrink: 0;
`;

const MobileRowWrap = styled.div<{ $active?: boolean }>`
  position: relative;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
`;

const MobileRow = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.625rem 0.875rem;
  background: ${(p) => (p.$active ? `rgba(${rgb.green}, 0.06)` : "transparent")};
  border: none;
  border-bottom: 1px solid rgba(${rgb.green}, 0.08);
  color: var(--t-text);
  cursor: pointer;
  text-align: left;
  &:hover { background: rgba(${rgb.green}, 0.05); }
`;

const MobileMoreBtn = styled.button<{ $open?: boolean }>`
  position: absolute;
  top: 50%;
  right: 0.25rem;
  transform: translateY(-50%);
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  border: none;
  background: ${(p) => (p.$open ? `rgba(${rgb.green}, 0.18)` : "transparent")};
  color: ${(p) => (p.$open ? colors.green : "var(--t-textGhost)")};
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  opacity: ${(p) => (p.$open ? 1 : 0)};
  transition: opacity 0.15s, background 0.15s, color 0.15s;
  z-index: 3;
  @media (hover: hover) {
    display: inline-flex;
    ${MobileRowWrap}:hover & { opacity: 1; }
  }
  &:hover { color: ${colors.green}; background: rgba(${rgb.green}, 0.14); }
`;

const MobileRowMenu = styled.div`
  position: absolute;
  top: calc(100% - 6px);
  right: 0.5rem;
  z-index: 200;
  min-width: 200px;
  padding: 0.25rem 0;
  border-radius: 10px;
  background: var(--t-surface);
  border: 1px solid var(--t-border);
  box-shadow: 0 10px 32px rgba(0,0,0,0.5);
`;

const MobileRowAvatar = styled.span`
  position: relative;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const MobileRowBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;

const MobileRowName = styled.span<{ $accent?: string }>`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${(p) => p.$accent ?? "var(--t-text)"};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MobileRowSub = styled.span`
  font-size: 0.75rem;
  color: var(--t-textMuted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const MobileRowMeta = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  flex-shrink: 0;
  min-width: 0;
`;

const MobileRowDot = styled.span<{ $online?: boolean }>`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: ${(p) => (p.$online ? colors.green : "var(--t-textGhost)")};
  box-shadow: ${(p) => (p.$online ? `0 0 6px rgba(${rgb.green}, 0.6)` : "none")};
`;

const MobileRowBadge = styled.span`
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  border-radius: 999px;
  background: ${colors.green};
  color: #060810;
  font-size: 0.6875rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const MobileRowEmpty = styled.div`
  padding: 1.5rem 0.875rem;
  text-align: center;
  color: var(--t-textGhost);
  font-size: 0.75rem;
`;

const MobileBackBtn = styled.button`
  display: none;
  @media (max-width: 768px) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    margin-right: 0.25rem;
    border-radius: 50%;
    background: rgba(${rgb.green}, 0.12);
    border: 1px solid rgba(${rgb.green}, 0.3);
    color: ${colors.green};
    cursor: pointer;
    flex-shrink: 0;
  }
`;

const SidebarMobileCollapse = styled.button`
  display: none;

  @media (max-width: 768px) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    border-radius: 8px;
    cursor: pointer;
    border: 1px solid rgba(${rgb.green}, 0.35);
    background: rgba(${rgb.green}, 0.12);
    color: ${colors.green};
    box-shadow: 0 0 8px rgba(${rgb.green}, 0.3);
  }
`;

const SidebarBackdrop = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: block;
    position: absolute;
    inset: 0;
    z-index: 3;
    background: rgba(0, 0, 0, 0.45);
  }
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.5rem 0.375rem;
  flex-shrink: 0;
  min-width: 0;
  overflow: hidden;
`;

const SidebarTabSwitch = styled.div`
  display: flex;
  align-items: center;
  border-radius: 9999px;
  padding: 0.125rem;
  flex: 1 1 0;
  min-width: 0;
  background: var(--t-inputBg);
  border: 1px solid rgba(${rgb.green}, 0.18);
`;

const SidebarTabBtn = styled.button<{ $active?: boolean; $narrow?: boolean }>`
  flex: 1 1 0;
  min-width: 0;
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: ${(p) => (p.$narrow ? "0.25rem 0.25rem" : "0.25rem 0.375rem")};
  border-radius: 9999px;
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.green}, 0.4)` : "transparent")};
  background: ${(p) => (p.$active ? `rgba(${rgb.green}, 0.18)` : "transparent")};
  color: ${(p) => (p.$active ? colors.green : "var(--t-textFaint)")};
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  overflow: hidden;

  svg { flex-shrink: 0; }
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

const RowHoverMenuItem = styled.button<{ $danger?: boolean; $highlight?: boolean }>`
  width: 100%;
  text-align: left;
  background: ${(p) => p.$highlight ? `rgba(${rgb.green}, 0.18)` : "none"};
  border: none;
  padding: 0.4rem 0.75rem;
  font-size: 0.6875rem;
  color: ${(p) => p.$danger ? "#e86a6a" : p.$highlight ? colors.green : "var(--t-text)"};
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  position: relative;
  &:hover {
    background: ${(p) => p.$danger ? "rgba(232, 106, 106, 0.12)" : `rgba(${rgb.green}, 0.12)`};
    color: ${(p) => p.$danger ? "#e86a6a" : colors.green};
  }
`;

const RowMenuGlyph = styled.span`
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: currentColor;
`;

const RowMenuCaret = styled.span`
  margin-left: auto;
  font-size: 0.75rem;
  opacity: 0.7;
`;

const RowMenuDivider = styled.div`
  height: 1px;
  background: var(--t-border);
  margin: 0.25rem 0;
`;

const ArchivedToggle = styled.button<{ $open: boolean }>`
  width: 100%;
  margin-top: 0.4rem;
  padding: 0.4rem 0.55rem;
  border-radius: 7px;
  border: 1px solid rgba(${rgb.green}, ${(p) => p.$open ? 0.45 : 0.22});
  background: ${(p) => p.$open ? `rgba(${rgb.green}, 0.14)` : "transparent"};
  color: ${colors.green};
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: background 0.15s, border-color 0.15s;
  &:hover { background: rgba(${rgb.green}, 0.12); }
`;

const MuteSubmenu = styled.div`
  position: absolute;
  top: 0;
  left: 100%;
  margin-left: 4px;
  min-width: 120px;
  padding: 0.25rem 0;
  border-radius: 8px;
  background: var(--t-surface);
  border: 1px solid var(--t-border);
  box-shadow: 0 6px 22px rgba(0,0,0,0.38);
  z-index: 210;
`;

const PinBadge = styled.span`
  font-size: 0.5rem;
  color: ${colors.green};
  flex-shrink: 0;
  opacity: 0.7;
`;

// ── WhatsApp row-menu: per-row meta (client-side, localStorage-backed) ───────

type RowMetaEntry = {
  pinned?: boolean;
  archived?: boolean;
  muteUntil?: number | "always";
  markedUnread?: boolean;
  blocked?: boolean;
  deleted?: boolean;
};

const ROW_META_KEY = "tgv_chat_row_meta";

function loadRowMeta(): Record<string, RowMetaEntry> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(ROW_META_KEY) ?? "{}"); }
  catch { return {}; }
}

function isMuted(entry?: RowMetaEntry): boolean {
  if (!entry?.muteUntil) return false;
  if (entry.muteUntil === "always") return true;
  return entry.muteUntil > Date.now();
}

// WhatsApp-style menu icons — inline SVG, currentColor, 14px
const WA_ICON_SIZE = 14;
const WaX = () => (<svg width={WA_ICON_SIZE} height={WA_ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M6 18L18 6"/></svg>);
const WaPopout = () => (<svg width={WA_ICON_SIZE} height={WA_ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6"/><path d="M20 4L10 14"/><path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"/></svg>);
const WaUnread = () => (<svg width={WA_ICON_SIZE} height={WA_ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>);
const WaArchive = () => (<svg width={WA_ICON_SIZE} height={WA_ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>);
const WaPin = () => (<svg width={WA_ICON_SIZE} height={WA_ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v7M8 9h8l-1 5H9l-1-5zM12 14v8"/></svg>);
const WaBlock = () => (<svg width={WA_ICON_SIZE} height={WA_ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>);
const WaMute = () => (<svg width={WA_ICON_SIZE} height={WA_ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0v5l2 3H4l2-3V8z"/><path d="M10 19a2 2 0 0 0 4 0"/><path d="M3 3l18 18"/></svg>);
const WaInfo = () => (<svg width={WA_ICON_SIZE} height={WA_ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M12 11v5"/></svg>);
const WaExport = () => (<svg width={WA_ICON_SIZE} height={WA_ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12"/><path d="M8 8l4-4 4 4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>);
const WaClear = () => (<svg width={WA_ICON_SIZE} height={WA_ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M8 8l8 8M16 8l-8 8"/></svg>);
const WaTrash = () => (<svg width={WA_ICON_SIZE} height={WA_ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>);
const WaExit = () => (<svg width={WA_ICON_SIZE} height={WA_ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M15 8l4 4-4 4"/><path d="M19 12H9"/></svg>);

const ClearConfirmOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(2px);
  z-index: 410;
  display: flex; align-items: center; justify-content: center;
`;

const ContactInfoOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(2px);
  z-index: 420;
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
`;

const ContactInfoCard = styled.div<{ $accent: string }>`
  width: min(360px, 94vw);
  border-radius: 14px;
  background: var(--t-surface);
  border: 1px solid ${(p) => p.$accent}55;
  box-shadow: 0 24px 64px rgba(0,0,0,0.55);
  display: flex; flex-direction: column;
  overflow: hidden;
  position: relative;
`;

const ContactInfoClose = styled.button`
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  width: 1.4rem;
  height: 1.4rem;
  border: none;
  background: rgba(0,0,0,0.25);
  color: #fff;
  border-radius: 50%;
  font-size: 0.75rem;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  z-index: 2;
  &:hover { background: rgba(0,0,0,0.4); }
`;

const ContactInfoHeader = styled.div<{ $accent: string }>`
  padding: 1.25rem 1rem 1rem;
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  background: linear-gradient(180deg, ${(p) => p.$accent}22 0%, transparent 100%);
  border-bottom: 1px solid var(--t-border);
`;

const ContactInfoName = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: var(--t-text);
  text-align: center;
`;

const ContactInfoTitle = styled.div`
  font-size: 0.75rem;
  color: var(--t-textMuted);
  text-align: center;
`;

const ContactInfoBody = styled.div`
  padding: 0.75rem 1rem 1rem;
  display: flex; flex-direction: column; gap: 0.65rem;
`;

const ContactInfoField = styled.div`
  display: flex; flex-direction: column; gap: 0.15rem;
`;

const ContactInfoLabel = styled.div`
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t-textGhost);
`;

const ContactInfoValue = styled.div`
  font-size: 0.8125rem;
  color: var(--t-text);
  line-height: 1.4;
  word-break: break-word;
`;

const ClearConfirmCard = styled.div`
  width: min(460px, 94vw);
  padding: 1.1rem 1.15rem;
  border-radius: 14px;
  background: var(--t-surface);
  border: 1px solid var(--t-borderStrong);
  box-shadow: 0 24px 64px rgba(0,0,0,0.55);
  display: flex; flex-direction: column; gap: 0.75rem;
`;

const ClearConfirmTitle = styled.h3`
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 700;
  color: ${colors.red};
`;

const ClearConfirmBody = styled.p`
  margin: 0;
  font-size: 0.75rem;
  color: var(--t-textMuted);
  line-height: 1.5;
`;

const ClearConfirmActions = styled.div`
  display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: flex-end;
`;

const GhostBtn = styled.button`
  padding: 0.4rem 0.75rem;
  font-size: 0.6875rem;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--t-border);
  color: var(--t-text);
  cursor: pointer;
  &:hover { background: rgba(255,255,255,0.04); }
`;

const PrimaryBtn = styled.button`
  padding: 0.4rem 0.8rem;
  font-size: 0.6875rem;
  border-radius: 8px;
  background: rgba(${rgb.green}, 0.18);
  border: 1px solid rgba(${rgb.green}, 0.55);
  color: ${colors.green};
  cursor: pointer;
  &:hover { box-shadow: 0 0 8px rgba(${rgb.green}, 0.35); }
`;

const DangerBtn = styled.button`
  padding: 0.4rem 0.8rem;
  font-size: 0.6875rem;
  border-radius: 8px;
  background: rgba(${rgb.red}, 0.12);
  border: 1px solid rgba(${rgb.red}, 0.45);
  color: ${colors.red};
  cursor: pointer;
  &:hover { box-shadow: 0 0 8px rgba(${rgb.red}, 0.35); }
`;

const SidebarDTog = styled.div<{ $dragging?: boolean }>`
  width: 8px;
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  touch-action: none;
  background: ${(p) => p.$dragging ? `rgba(${rgb.green}, 0.2)` : "transparent"};
  transition: background 0.15s, box-shadow 0.15s;

  @media (max-width: 768px) {
    width: 14px;
  }

  /* left hairline */
  &::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 1px;
    background: ${(p) => p.$dragging ? `rgba(${rgb.green}, 0.6)` : "var(--t-border)"};
  }
  /* right hairline (outside, paired with the row divider above) */
  &::after {
    content: "";
    position: absolute;
    inset: 0 0 0 auto;
    width: 1px;
    background: ${(p) => p.$dragging ? `rgba(${rgb.green}, 0.6)` : `rgba(${rgb.green}, 0.35)`};
  }

  > svg {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    color: ${colors.green};
    opacity: 1;
    pointer-events: none;
    ${(p) => p.$dragging && `filter: drop-shadow(0 0 3px rgba(${rgb.green}, 0.55));`}
  }

  [data-theme="light"] & > svg { color: rgba(${rgb.green}, 0.9); }

  &:hover {
    background: rgba(${rgb.green}, 0.1);
    box-shadow: 0 0 10px rgba(${rgb.green}, 0.35), inset 0 0 6px rgba(${rgb.green}, 0.18);
    &::before { background: rgba(${rgb.green}, 0.4); }
    &::after { background: rgba(${rgb.green}, 0.6); }
    > svg { opacity: 1; color: ${colors.green}; filter: drop-shadow(0 0 3px rgba(${rgb.green}, 0.55)); }
  }
`;

const DTogTab = styled.button`
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 40px;
  padding: 0;
  border-radius: 0 8px 8px 0;
  border: 1px solid rgba(${rgb.green}, 0.35);
  border-left: none;
  background: rgba(${rgb.green}, 0.12);
  color: ${colors.green};
  cursor: pointer;
  z-index: 5;
  transition: background 0.15s, box-shadow 0.15s;

  &:hover {
    background: rgba(${rgb.green}, 0.22);
    box-shadow: 0 0 8px rgba(${rgb.green}, 0.35);
  }

  @media (max-width: 768px) {
    width: 28px;
    height: 56px;
    box-shadow: 0 0 10px rgba(${rgb.green}, 0.3);

    > svg {
      width: 18px;
      height: 18px;
    }
  }
`;

function DTogGrip() {
  return (
    <svg width="14" height="30" viewBox="0 0 14 30" fill="currentColor" aria-hidden="true">
      <polygon points="7,0.5 2.5,5 11.5,5" />
      <rect x="1" y="8.5" width="12" height="2" rx="1" />
      <rect x="1" y="13" width="12" height="2" rx="1" />
      <rect x="1" y="17.5" width="12" height="2" rx="1" />
      <polygon points="7,29.5 2.5,25 11.5,25" />
    </svg>
  );
}

const DTOG_CLICK_SLOP = 4;

const ConvPane = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
`;

// ── Chat header row ────────────────────────────────────────────────────────────

const ChatHeaderRow = styled.div<{ $accent: string }>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, ${(p) => p.$accent} 22%, transparent);
  background: color-mix(in srgb, ${(p) => p.$accent} 5%, transparent);
`;

const ChatHeaderLeft = styled.button<{ $accent: string }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  flex: 1;
  background: none;
  border: none;
  padding: 0.25rem 0.4rem;
  border-radius: 8px;
  cursor: pointer;
  color: ${(p) => p.$accent};
  transition: background 0.15s;

  &:hover {
    background: color-mix(in srgb, ${(p) => p.$accent} 14%, transparent);
  }
`;

const ChatHeaderName = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

const ChatHeaderSub = styled.span`
  font-size: 0.6875rem;
  opacity: 0.65;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ChatHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
`;

const ChatHeaderIconBtn = styled.button<{ $accent: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  background: color-mix(in srgb, ${(p) => p.$accent} 10%, transparent);
  border: 1px solid color-mix(in srgb, ${(p) => p.$accent} 40%, transparent);
  color: ${(p) => p.$accent};
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  &:hover {
    background: color-mix(in srgb, ${(p) => p.$accent} 22%, transparent);
    box-shadow: 0 0 8px color-mix(in srgb, ${(p) => p.$accent} 50%, transparent);
  }
  &:active { transform: scale(0.94); }
`;

const ChatHeaderMemberDropdown = styled.div<{ $accent: string }>`
  position: absolute;
  top: 100%;
  left: 0.75rem;
  right: 0.75rem;
  margin-top: 0.25rem;
  z-index: 40;
  background: rgba(8, 8, 16, 0.96);
  border: 1px solid color-mix(in srgb, ${(p) => p.$accent} 45%, transparent);
  border-radius: 10px;
  box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.7),
              0 0 24px -8px color-mix(in srgb, ${(p) => p.$accent} 45%, transparent);
  padding: 0.5rem;
  max-height: 14rem;
  overflow: auto;
`;

const ChatHeaderMemberSearch = styled.input<{ $accent: string }>`
  width: 100%;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid color-mix(in srgb, ${(p) => p.$accent} 30%, transparent);
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
  color: var(--t-text);
  font-size: 0.75rem;
  outline: none;
  margin-bottom: 0.4rem;

  &:focus {
    border-color: ${(p) => p.$accent};
    box-shadow: 0 0 0 2px color-mix(in srgb, ${(p) => p.$accent} 25%, transparent);
  }
`;

const ChatHeaderMemberItem = styled.button<{ $accent: string }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.35rem 0.5rem;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--t-text);
  font-size: 0.75rem;
  text-align: left;

  &:hover {
    background: color-mix(in srgb, ${(p) => p.$accent} 16%, transparent);
  }
`;

// ── File attachment ────────────────────────────────────────────────────────────

function FileAttachment({ url, name, size, mime, accent }: { url: string; name?: string; size?: number; mime?: string; accent?: string }) {
  if (isImage(mime)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <AttachImage src={url} alt={name ?? "image"} />
      </a>
    );
  }
  if (mime?.startsWith("audio/")) {
    return <VoicePlayer url={url} accent={accent} />;
  }
  return (
    <AttachFile href={url} target="_blank" rel="noreferrer" download={name}>
      <AttachGlyph>
        {mime?.startsWith("video/") ? "🎥" : "📎"}
      </AttachGlyph>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <AttachName>{name ?? "file"}</AttachName>
        {size && <AttachSize>{fmtBytes(size)}</AttachSize>}
      </div>
      <AttachDl>↓</AttachDl>
    </AttachFile>
  );
}

// ── Message bubble (shared by chat + DM) ─────────────────────────────────────

function ReadCheck({ state, accent }: { state: "sent" | "read"; accent?: string }) {
  const color = state === "read" ? (accent || colors.cyan) : "var(--t-textGhost)";
  return (
    <span
      title={state === "read" ? "Read" : "Sent"}
      aria-label={state === "read" ? "Read" : "Sent"}
      style={{ display: "inline-flex", alignItems: "center", marginLeft: 4, color }}
    >
      <svg width="14" height="9" viewBox="0 0 14 9" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 4.5 L4 7.5 L10 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        {state === "read" && (
          <path d="M4.5 4.5 L7.5 7.5 L13.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </span>
  );
}

const EDIT_WINDOW_MS = 30 * 60 * 1000;

function MessageBubble({
  id, from, content, fileUrl, fileName, fileSize, fileMime, createdAt, editedAt,
  readBy, peerUsername, replyTo, reactions, currentUser,
  profile, isMe, settings, canDelete,
  onDelete, onEdit, onReply, onJumpToReply, onReact,
}: {
  id: string; from: string; content: string;
  fileUrl?: string; fileName?: string; fileSize?: number; fileMime?: string;
  createdAt: string; editedAt?: string;
  readBy?: string[]; peerUsername?: string;
  replyTo?: { id: string; from: string; excerpt: string };
  reactions?: Record<string, string[]>;
  currentUser?: string;
  profile?: Profile; isMe: boolean;
  settings: ChatSettings; canDelete: boolean;
  onDelete: () => void; onEdit: (content: string) => void;
  onReply?: () => void;
  onJumpToReply?: (id: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
}) {
  const accent = profile?.accentColor ?? "#4ade80";
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(content);
  const [replyExpanded, setReplyExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [reactTrayOpen, setReactTrayOpen] = useState(false);
  const [reactTrayPos, setReactTrayPos] = useState<{ top: number; left: number } | null>(null);
  const chevronRef = useRef<HTMLButtonElement>(null);
  const reactBtnRef = useRef<HTMLButtonElement>(null);

  const ageMs = Date.now() - new Date(createdAt).getTime();
  const canEdit = isMe && ageMs < EDIT_WINDOW_MS;

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!reactTrayOpen) return;
    const close = () => setReactTrayOpen(false);
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [reactTrayOpen]);

  const openReactTray = (e: React.MouseEvent, anchor: HTMLElement | null) => {
    e.stopPropagation();
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const TRAY_WIDTH = 220;
    const TRAY_HEIGHT = 44;
    let left = r.left + r.width / 2 - TRAY_WIDTH / 2;
    if (left < 8) left = 8;
    if (left + TRAY_WIDTH > window.innerWidth - 8) left = window.innerWidth - TRAY_WIDTH - 8;
    const aboveTop = r.top - TRAY_HEIGHT - 8;
    const top = aboveTop >= 8 ? aboveTop : r.bottom + 8;
    setReactTrayPos({ top, left });
    setReactTrayOpen(true);
  };

  const pickReaction = (emoji: string) => {
    setReactTrayOpen(false);
    if (onReact) onReact(id, emoji);
  };

  const openMenuAt = (anchor: HTMLElement | null) => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const MENU_WIDTH = 188;
    const MENU_HEIGHT_EST = 400;
    let left = r.right - MENU_WIDTH;
    if (left < 8) left = 8;
    if (left + MENU_WIDTH > window.innerWidth - 8) left = window.innerWidth - MENU_WIDTH - 8;
    const belowTop = r.bottom + 6;
    const fitsBelow = belowTop + MENU_HEIGHT_EST <= window.innerHeight - 8;
    const top = fitsBelow ? belowTop : Math.max(8, r.top - MENU_HEIGHT_EST - 6);
    setMenuPos({ top, left });
    setMenuOpen(true);
  };

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    openMenuAt(chevronRef.current);
  };

  const closeMenu = () => setMenuOpen(false);

  // Long-press (touch-hold ~500ms) on the bubble → open action menu.
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);
  const longPressStart = useRef<{ x: number; y: number } | null>(null);
  const LONG_PRESS_MS = 500;
  const LONG_PRESS_SLOP = 10;
  const onBubbleTouchStart = (e: React.TouchEvent) => {
    if (editing) return;
    const t = e.touches[0];
    if (!t) return;
    longPressFired.current = false;
    longPressStart.current = { x: t.clientX, y: t.clientY };
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch { /* ignore */ } }
      openMenuAt(chevronRef.current);
    }, LONG_PRESS_MS);
  };
  const onBubbleTouchMove = (e: React.TouchEvent) => {
    if (!longPressStart.current) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - longPressStart.current.x;
    const dy = t.clientY - longPressStart.current.y;
    if (Math.abs(dx) > LONG_PRESS_SLOP || Math.abs(dy) > LONG_PRESS_SLOP) {
      if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }
  };
  const onBubbleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    longPressStart.current = null;
    if (longPressFired.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const onBubbleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openMenuAt(chevronRef.current);
  };

  const saveEdit = () => {
    if (editVal.trim()) onEdit(editVal.trim());
    setEditing(false);
  };

  const copyContent = async () => {
    try { await navigator.clipboard.writeText(content); } catch { /* ignore */ }
  };

  const showInfo = () => {
    const created = new Date(createdAt).toLocaleString();
    const edited = editedAt ? new Date(editedAt).toLocaleString() : null;
    const readers = readBy && readBy.length ? readBy.join(", ") : "—";
    alert(`From: ${profile?.displayName ?? from}\nSent: ${created}${edited ? `\nEdited: ${edited}` : ""}\nRead by: ${readers}`);
  };

  const stub = (what: string) => () => alert(`${what}: coming soon`);

  return (
    <BubbleRow $isMe={isMe} data-msg-id={id}>
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
          {isMe && peerUsername && (
            <ReadCheck
              state={readBy?.includes(peerUsername) ? "read" : "sent"}
              accent={accent}
            />
          )}
        </BubbleMeta>
        <BubbleCard
          $isMe={isMe}
          $accent={accent}
          onTouchStart={onBubbleTouchStart}
          onTouchMove={onBubbleTouchMove}
          onTouchEnd={onBubbleTouchEnd}
          onTouchCancel={onBubbleTouchEnd}
          onContextMenu={onBubbleContextMenu}
        >
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
            const linkUrl = extractFirstUrl(plain);
            const excerptTruncated = replyTo ? replyTo.excerpt.length >= 118 : false;
            return (
              <>
                {replyTo && (
                  <QuotedReply
                    $accent={accent}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onJumpToReply) onJumpToReply(replyTo.id);
                    }}
                    title="Jump to replied message"
                  >
                    <QuotedFrom $accent={accent}>{replyTo.from}</QuotedFrom>
                    <QuotedExcerpt $expanded={replyExpanded}>{replyTo.excerpt}</QuotedExcerpt>
                    {excerptTruncated && (
                      <MoreBtn
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplyExpanded((v) => !v);
                        }}
                      >
                        {replyExpanded ? "Less" : "More"}
                      </MoreBtn>
                    )}
                  </QuotedReply>
                )}
                {plain && <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{plain}</p>}
                {gifs.map((url) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <InlineGif key={url} src={url} alt="gif" loading="lazy" />
                ))}
                {linkUrl && <OgPreview url={linkUrl} />}
                {fileUrl && <FileAttachment url={fileUrl} name={fileName} size={fileSize} mime={fileMime} accent={accent} />}
              </>
            );
          })()}
          {!editing && (
            <>
              <BubbleChevron
                ref={chevronRef}
                $isMe={isMe}
                $accent={accent}
                data-open={menuOpen ? "true" : "false"}
                onClick={openMenu}
                aria-label="Message actions"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 5.25 L7 8.75 L10.5 5.25" />
                </svg>
              </BubbleChevron>
              {onReact && (
                <ReactEmojiBtn
                  ref={reactBtnRef}
                  $isMe={isMe}
                  $accent={accent}
                  onClick={(e) => openReactTray(e, reactBtnRef.current)}
                  aria-label="React"
                >
                  <SmileIcon size={14} />
                </ReactEmojiBtn>
              )}
            </>
          )}
        </BubbleCard>
        {reactions && Object.keys(reactions).length > 0 && (
          <ReactionRow $isMe={isMe}>
            {Object.entries(reactions).map(([emoji, users]) => {
              const mine = !!currentUser && users.includes(currentUser);
              return (
                <ReactionChip
                  key={emoji}
                  $accent={accent}
                  $mine={mine}
                  onClick={() => onReact?.(id, emoji)}
                  title={users.join(", ")}
                >
                  <span>{emoji}</span>
                  <ReactionChipCount>{users.length}</ReactionChipCount>
                </ReactionChip>
              );
            })}
          </ReactionRow>
        )}
      </BubbleCol>
      {menuOpen && menuPos && createPortal(
        <BubbleMenuPopup
          $accent={accent}
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {onReply && (
            <BubbleMenuItem onClick={() => { closeMenu(); onReply(); }}>
              <BubbleMenuGlyph><ReplyIcon size={14} /></BubbleMenuGlyph> Reply
            </BubbleMenuItem>
          )}
          {onReact && (
            <BubbleMenuItem onClick={(e) => {
              closeMenu();
              openReactTray(e, chevronRef.current);
            }}>
              <BubbleMenuGlyph><SmileIcon size={14} /></BubbleMenuGlyph> React
            </BubbleMenuItem>
          )}
          <BubbleMenuItem onClick={() => { closeMenu(); stub("Star")(); }}>
            <BubbleMenuGlyph>☆</BubbleMenuGlyph> Star
          </BubbleMenuItem>
          <BubbleMenuItem onClick={() => { closeMenu(); stub("Pin")(); }}>
            <BubbleMenuGlyph>📌</BubbleMenuGlyph> Pin
          </BubbleMenuItem>
          <BubbleMenuItem onClick={() => { closeMenu(); stub("Forward")(); }}>
            <BubbleMenuGlyph>↪</BubbleMenuGlyph> Forward
          </BubbleMenuItem>
          <BubbleMenuItem onClick={() => { closeMenu(); copyContent(); }}>
            <BubbleMenuGlyph>⧉</BubbleMenuGlyph> Copy
          </BubbleMenuItem>
          {canEdit && (
            <BubbleMenuItem onClick={() => { closeMenu(); setEditing(true); setEditVal(content); }}>
              <BubbleMenuGlyph><EditIcon size={14} /></BubbleMenuGlyph> Edit
            </BubbleMenuItem>
          )}
          {isMe && (
            <BubbleMenuItem onClick={() => { closeMenu(); showInfo(); }}>
              <BubbleMenuGlyph>ⓘ</BubbleMenuGlyph> Info
            </BubbleMenuItem>
          )}
          {!isMe && (
            <BubbleMenuItem onClick={() => { closeMenu(); stub("Report")(); }}>
              <BubbleMenuGlyph>⚠</BubbleMenuGlyph> Report
            </BubbleMenuItem>
          )}
          {canDelete && (
            <>
              <BubbleMenuDivider />
              <BubbleMenuItem $danger onClick={() => { closeMenu(); onDelete(); }}>
                <BubbleMenuGlyph><TrashIcon size={14} /></BubbleMenuGlyph> Delete
              </BubbleMenuItem>
            </>
          )}
          <BubbleMenuDivider />
          <BubbleMenuItem onClick={() => { closeMenu(); stub("Select messages")(); }}>
            <BubbleMenuGlyph>☑</BubbleMenuGlyph> Select messages
          </BubbleMenuItem>
        </BubbleMenuPopup>,
        document.body,
      )}
      {reactTrayOpen && reactTrayPos && createPortal(
        <ReactionTray
          $accent={accent}
          style={{ top: reactTrayPos.top, left: reactTrayPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <ReactionTrayBtn
              key={emoji}
              $accent={accent}
              onClick={() => pickReaction(emoji)}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </ReactionTrayBtn>
          ))}
        </ReactionTray>,
        document.body,
      )}
    </BubbleRow>
  );
}

// ── ScrollableMessages ───────────────────────────────────────────────────────

function ScrollableMessages({ children, innerRef }: { children: React.ReactNode; innerRef?: React.MutableRefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (innerRef) innerRef.current = el;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowJump(dist > 200);
    };
    onScroll();
    el.addEventListener("scroll", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (innerRef) innerRef.current = null;
    };
  }, [innerRef]);

  const jumpToBottom = () => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  return (
    <MsgScrollWrap>
      <MsgScroll ref={ref}>{children}</MsgScroll>
      <ScrollToBottomBtn $visible={showJump} onClick={jumpToBottom} aria-label="Jump to latest">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 5.5 L7 9 L10.5 5.5" />
        </svg>
      </ScrollToBottomBtn>
    </MsgScrollWrap>
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
  const [mobileCompact, setMobileCompact] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => {
      const isMobile = mq.matches;
      setMobileCompact(isMobile);
      setSidebarWidth((prev) => (isMobile ? 100 : prev < SIDEBAR_NARROW ? SIDEBAR_DEFAULT : prev));
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (mobileCompact && !open) setMobileView("list");
  }, [mobileCompact, open]);
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupSending, setGroupSending] = useState(false);
  const [groupInput, setGroupInput] = useState("");
  const groupBottomRef = useRef<HTMLDivElement>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupAdminId, setGroupAdminId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [rowHoverMenu, setRowHoverMenu] = useState<string | null>(null);
  const [muteSubmenuFor, setMuteSubmenuFor] = useState<string | null>(null);
  const [contactInfoFor, setContactInfoFor] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [mobileFilter, setMobileFilter] = useState<"all" | "unread" | "favorites" | "groups">("all");
  const [mobileSearch, setMobileSearch] = useState("");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const startLongPress = useCallback((rowKey: string) => {
    longPressFired.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setRowHoverMenu(rowKey);
      setMuteSubmenuFor(null);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate?.(15); } catch { /* ignore */ }
      }
    }, 450);
  }, []);
  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);
  const [rowMeta, setRowMeta] = useState<Record<string, RowMetaEntry>>({});
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [onlineOverflowOpen, setOnlineOverflowOpen] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [talkActive, setTalkActive] = useState(false);
  const [composerNarrow, setComposerNarrow] = useState(false);
  const [composerMoreOpen, setComposerMoreOpen] = useState(false);
  const [headerMembersOpen, setHeaderMembersOpen] = useState(false);
  const [headerMemberQuery, setHeaderMemberQuery] = useState("");
  const inputRowRef = useRef<HTMLDivElement>(null);
  const talkTriggerRef = useRef<HTMLDivElement>(null);
  const voiceTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = inputRowRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setComposerNarrow(w > 0 && w < 340);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [profiles, setProfiles]   = useState<Profile[]>([]);
  const [presence, setPresence]   = useState<{ sysUser: string; online: boolean }[]>([]);
  const [currentUser, setCurrentUser] = useState<string>("");
  const isExec = currentUser === "admin" || currentUser === "marmar";
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

  const [replyTarget, setReplyTarget] = useState<{
    id: string;
    from: string;
    excerpt: string;
  } | null>(null);

  const scrollToMessage = useCallback((targetId: string) => {
    if (typeof document === "undefined") return;
    const el = document.querySelector<HTMLElement>(`[data-msg-id="${CSS.escape(targetId)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.transition = "background 0.4s";
    el.style.background = "rgba(74, 222, 128, 0.15)";
    setTimeout(() => { el.style.background = ""; }, 900);
  }, []);

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
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === "chat") {
        setOpen(true);
        window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: "chat" }));
      }
    };
    window.addEventListener("tgv-drawer-open", handler);
    return () => window.removeEventListener("tgv-drawer-open", handler);
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

  const loadGroupMessages = useCallback(async (groupId: string) => {
    try {
      const d = await fetch(`/api/chat/group/messages?groupId=${encodeURIComponent(groupId)}`).then((r) => r.json());
      setGroupMessages(Array.isArray(d?.messages) ? d.messages : []);
    } catch { /* ignore */ }
  }, []);

  const sendGroupMessage = async () => {
    if (selection.type !== "group" || !groupInput.trim() || groupSending) return;
    setGroupSending(true);
    try {
      const res = await fetch("/api/chat/group/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: selection.groupId,
          content: groupInput.trim(),
          ...(replyTarget ? { replyTo: replyTarget } : {}),
        }),
      });
      if (res.ok) {
        setGroupInput("");
        setReplyTarget(null);
        await loadGroupMessages(selection.groupId);
      }
    } finally {
      setGroupSending(false);
    }
  };

  const deleteGroupMessage = async (id: string) => {
    if (selection.type !== "group") return;
    await fetch(`/api/chat/group/messages?groupId=${encodeURIComponent(selection.groupId)}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadGroupMessages(selection.groupId);
  };

  const editGroupMessage = async (id: string, content: string) => {
    if (selection.type !== "group") return;
    await fetch("/api/chat/group/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: selection.groupId, id, content }),
    });
    await loadGroupMessages(selection.groupId);
  };

  const joinGroup = async (groupId: string) => {
    const res = await fetch("/api/chat/group/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });
    if (res.ok) { await loadGroups(); setSelection({ type: "group", groupId }); }
    else {
      const d = await res.json().catch(() => ({}));
      alert(d?.error ?? "Could not join");
    }
  };

  const leaveGroup = async (groupId: string) => {
    if (!confirm("Leave this group?")) return;
    await fetch(`/api/chat/group/join?groupId=${encodeURIComponent(groupId)}`, { method: "DELETE" });
    await loadGroups();
    setSelection({ type: "tgv" });
  };

  useEffect(() => {
    if (selection.type !== "group") return;
    loadGroupMessages(selection.groupId);
    const id = setInterval(() => loadGroupMessages(selection.groupId), 10_000);
    return () => clearInterval(id);
  }, [selection, loadGroupMessages]);

  useEffect(() => {
    if (selection.type === "group") {
      groupBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [groupMessages, selection]);

  // hydrate row meta from localStorage once
  useEffect(() => { setRowMeta(loadRowMeta()); }, []);

  // persist row meta on every change
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ROW_META_KEY, JSON.stringify(rowMeta));
  }, [rowMeta]);

  const patchRowMeta = useCallback((key: string, patch: Partial<RowMetaEntry>) => {
    setRowMeta((prev) => {
      const current = prev[key] ?? {};
      const next = { ...current, ...patch };
      // drop empty/falsy defaults so the map stays tidy
      if (!next.pinned) delete next.pinned;
      if (!next.archived) delete next.archived;
      if (!next.markedUnread) delete next.markedUnread;
      if (!next.blocked) delete next.blocked;
      if (!next.deleted) delete next.deleted;
      if (!next.muteUntil || (typeof next.muteUntil === "number" && next.muteUntil <= Date.now())) delete next.muteUntil;
      if (Object.keys(next).length === 0) {
        const out = { ...prev };
        delete out[key];
        return out;
      }
      return { ...prev, [key]: next };
    });
  }, []);

  const exportChannel = useCallback((filename: string, payload: unknown) => {
    try {
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Export failed");
    }
  }, []);

  useEffect(() => {
    if (!rowHoverMenu) return;
    const onClick = () => { setRowHoverMenu(null); setMuteSubmenuFor(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setRowHoverMenu(null); setMuteSubmenuFor(null); } };
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
    window.addEventListener("touchstart", onClick, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("touchstart", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [attachMenuOpen]);

  useEffect(() => {
    if (!composerMoreOpen) return;
    const onClick = () => setComposerMoreOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setComposerMoreOpen(false); };
    window.addEventListener("click", onClick);
    window.addEventListener("touchstart", onClick, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("touchstart", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [composerMoreOpen]);

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
    // Mark incoming messages read automatically while the DM is open
    fetch("/api/chat/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "dm", peer: peerUsername }),
    }).catch(() => {});
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
    if (!open) return;
    const context = selection.type === "dm"
      ? `dm:${selection.peer.username}`
      : selection.type === "group"
        ? `group:${selection.groupId}`
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
      : selection.type === "group"
        ? `group:${selection.groupId}`
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

  const [sidebarDragging, setSidebarDragging] = useState(false);
  const beginSidebarResize = useCallback((startX: number, touch: boolean) => {
    const startWpx = sidebarWidth;
    let moved = false;
    let autoCollapsed = false;
    const commit = (clientX: number) => {
      const dx = clientX - startX;
      if (!moved && Math.abs(dx) < DTOG_CLICK_SLOP) return false;
      if (!moved) {
        moved = true;
        setSidebarDragging(true);
        if (!touch) {
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }
      }
      const raw = startWpx + dx;
      if (raw < SIDEBAR_COLLAPSE_AT) {
        autoCollapsed = true;
        setSidebarCollapsed(true);
        cleanup();
        setSidebarDragging(false);
        return true;
      }
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, raw));
      setSidebarWidth(next);
      return false;
    };
    const onMoveMouse = (ev: MouseEvent) => { commit(ev.clientX); };
    const onMoveTouch = (ev: TouchEvent) => {
      const t = ev.touches[0];
      if (!t) return;
      if (commit(t.clientX) || moved) ev.preventDefault();
    };
    const onUp = () => {
      cleanup();
      setSidebarDragging(false);
      if (!moved && !autoCollapsed) setSidebarCollapsed(true);
    };
    const cleanup = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMoveMouse);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMoveTouch);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
    };
    if (touch) {
      window.addEventListener("touchmove", onMoveTouch, { passive: false });
      window.addEventListener("touchend", onUp);
      window.addEventListener("touchcancel", onUp);
    } else {
      window.addEventListener("mousemove", onMoveMouse);
      window.addEventListener("mouseup", onUp);
    }
  }, [sidebarWidth]);

  const onSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    beginSidebarResize(e.clientX, false);
  }, [beginSidebarResize]);

  const onSidebarResizeTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    beginSidebarResize(t.clientX, true);
  }, [beginSidebarResize]);

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
        if (replyTarget) fd.append("replyTo", JSON.stringify(replyTarget));
        const res = await fetch("/api/chat/upload", { method: "POST", body: fd });
        if (res.ok) { setInput(""); setUploadFile(null); setReplyTarget(null); await loadMessages(); }
        setUploading(false);
      } else {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: input.trim(),
            ...(replyTarget ? { replyTo: replyTarget } : {}),
          }),
        });
        if (res.ok) { setInput(""); setReplyTarget(null); await loadMessages(); }
      }
    } finally { setSending(false); }
  };

  const sendVoice = async (blob: Blob, mime: string, durationMs: number) => {
    if (!isTGV || sending) return;
    const extFromMime = mime.includes("webm") ? "webm" : mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : "webm";
    const file = new File([blob], `voice_${Date.now()}.${extFromMime}`, { type: mime || "audio/webm" });
    setSending(true);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("chatId", "group");
      fd.append("content", `Voice memo · ${Math.round(durationMs / 1000)}s`);
      if (replyTarget) fd.append("replyTo", JSON.stringify(replyTarget));
      const res = await fetch("/api/chat/upload", { method: "POST", body: fd });
      if (res.ok) {
        setReplyTarget(null);
        await loadMessages();
      }
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const deleteMessage = async (id: string) => {
    await fetch(`/api/chat?id=${id}`, { method: "DELETE" });
    await loadMessages();
  };

  const editMessage = async (id: string, content: string) => {
    await fetch("/api/chat", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, content }) });
    await loadMessages();
  };

  const reactTgv = async (messageId: string, emoji: string) => {
    await fetch("/api/chat/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "tgv", messageId, emoji }),
    });
    await loadMessages();
  };

  const reactDm = async (messageId: string, emoji: string, withUser: string) => {
    await fetch("/api/chat/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "dm", messageId, emoji, with: withUser }),
    });
    await loadDmMessages(withUser);
  };

  const reactGroup = async (messageId: string, emoji: string, groupId: string) => {
    await fetch("/api/chat/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "group", messageId, emoji, groupId }),
    });
    await loadGroupMessages(groupId);
  };

  const clearChat = async () => {
    setShowClearConfirm(true);
  };

  const doClearMine = async () => {
    const body: Record<string, string> = {};
    if (selection.type === "dm") { body.scope = "dm"; body.peer = selection.peer.username; }
    else if (selection.type === "group") { body.scope = "group"; body.groupId = selection.groupId; }
    else { body.scope = "tgv"; }
    await fetch("/api/chat/clear-mine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setShowClearConfirm(false);
    if (selection.type === "dm") await loadDmMessages(selection.peer.username);
    else if (selection.type === "group") await loadGroupMessages(selection.groupId);
    else await loadMessages();
  };

  const doClearGlobal = async () => {
    await fetch("/api/chat/clear", { method: "POST" });
    setShowClearConfirm(false);
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
        body: JSON.stringify({
          to: peer.username,
          content: dmInput.trim(),
          ...(replyTarget ? { replyTo: replyTarget } : {}),
        }),
      });
      setDmInput("");
      setReplyTarget(null);
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
      {/* ── Side tab pill — DTog-style handle, floats to drawer's outer edge when open */}
      <SideTab
        onMouseDown={onTabMouseDown}
        title={open ? "Close chat" : "Open chat"}
        $open={open}
        $openLeft={open ? `min(${width}px, 85vw)` : "0"}
        style={{
          top: tabY,
          background: open
            ? `rgba(${rgb.green}, 0.25)`
            : unread > 0
              ? `rgba(${rgb.green}, 0.22)`
              : `rgba(${rgb.green}, 0.12)`,
          boxShadow: open
            ? `2px 0 14px rgba(${rgb.green}, 0.35)`
            : unread > 0
              ? `2px 0 14px rgba(${rgb.green}, 0.35)`
              : `2px 0 10px rgba(${rgb.green}, 0.18)`,
        }}
      >
        <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <DrawerChatsIcon size={16} />
          {!open && unread > 0 && (
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
            {selection.type === "group" && (() => {
              const g = groups.find((gg) => gg.id === selection.groupId);
              return (
                <>
                  <TitleText $color={VIOLET}>{g?.name ?? "Group"}</TitleText>
                  {g && (
                    <GroupManageBtn
                      onClick={() => setGroupAdminId(g.id)}
                      title={g.isAdmin ? "Manage group" : "Group info"}
                    >
                      <MembersIcon size={12} />
                      <span>{g.memberIds.length}</span>
                    </GroupManageBtn>
                  )}
                </>
              );
            })()}
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

          <Tooltip
            accent={colors.green}
            label={
              selection.type === "dm" ? "Clear this DM for me"
              : selection.type === "group" ? "Clear this group for me"
              : "Clear chat"
            }
          >
            <ControlBtn onClick={clearChat}>
              <TrashIcon size={14} />
            </ControlBtn>
          </Tooltip>

          <Tooltip accent={colors.green} label="Settings">
            <ControlBtn onClick={() => setShowSettingsModal(true)}>
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 10.5A2.5 2.5 0 1 1 8 5.5a2.5 2.5 0 0 1 0 5zm5.29-2.77a5.07 5.07 0 0 0 .04-.73 5 5 0 0 0-.04-.73l1.57-1.23a.38.38 0 0 0 .09-.48l-1.49-2.57a.37.37 0 0 0-.45-.16l-1.85.74a5.4 5.4 0 0 0-1.26-.73L9.67.37A.36.36 0 0 0 9.31 0H6.69a.36.36 0 0 0-.36.37l-.27 1.97a5.4 5.4 0 0 0-1.26.73l-1.85-.74a.37.37 0 0 0-.45.16L1.05 4.86a.37.37 0 0 0 .09.48l1.57 1.23c-.03.24-.04.48-.04.73s.01.49.04.73L1.14 9.26a.37.37 0 0 0-.09.48l1.49 2.57c.09.16.28.22.45.16l1.85-.74c.39.28.82.52 1.26.73l.27 1.97c.05.2.24.37.45.37H9.3c.21 0 .4-.17.45-.37l.27-1.97a5.4 5.4 0 0 0 1.26-.73l1.85.74c.17.06.36 0 .45-.16l1.49-2.57a.37.37 0 0 0-.09-.48l-1.69-1.27z"/>
              </svg>
            </ControlBtn>
          </Tooltip>

          <Tooltip accent={colors.green} label="Open in new window">
            <ControlBtn
              onClick={() => {
                const w = window.screen.width * 0.8;
                const h = window.screen.height * 0.85;
                const left = (window.screen.width - w) / 2;
                const top  = (window.screen.height - h) / 2;
                window.open("/dashboard/chat?popout=1", "tgv-chat-drawer", `width=${w},height=${h},left=${left},top=${top}`);
              }}
            >
              ⧉
            </ControlBtn>
          </Tooltip>

          <Tooltip accent={colors.green} label="Close (Esc)">
            <NeonX accent="green" onClick={() => setOpen(false)} title="Close (Esc)" />
          </Tooltip>
        </Header>

        <Body>
          {/* ── Mobile WhatsApp-style list view ─────────────────── */}
          {mobileCompact && mobileView === "list" && (() => {
            const q = mobileSearch.trim().toLowerCase();
            type Row =
              | { kind: "tgv"; key: string; name: string; sub: string; pinned: boolean; unread: boolean; online?: boolean; onClick: () => void; avatar: React.ReactNode; accent?: string; meta?: RowMetaEntry }
              | { kind: "dm"; key: string; name: string; sub: string; pinned: boolean; unread: boolean; online: boolean; onClick: () => void; avatar: React.ReactNode; accent?: string; meta?: RowMetaEntry; profile: MemberProfile }
              | { kind: "group"; key: string; name: string; sub: string; pinned: boolean; unread: boolean; onClick: () => void; avatar: React.ReactNode; accent?: string; meta?: RowMetaEntry; group: GroupChat };
            const rows: Row[] = [];

            const matchFilter = (unread: boolean, pinned: boolean, kind: Row["kind"]) => {
              if (mobileFilter === "unread") return unread;
              if (mobileFilter === "favorites") return pinned;
              if (mobileFilter === "groups") return kind === "group";
              return true;
            };

            // TGV Chatroom pseudo-row
            if (!q || "tgv chatroom".includes(q)) {
              const tgvMeta = rowMeta["tgv:all"];
              const tgvUnread = !!tgvMeta?.markedUnread;
              const tgvPinned = !!tgvMeta?.pinned;
              if (matchFilter(tgvUnread, tgvPinned, "tgv") && !tgvMeta?.archived) {
                rows.push({
                  kind: "tgv",
                  key: "tgv:all",
                  name: "TGV Chatroom",
                  sub: "All members",
                  pinned: tgvPinned,
                  unread: tgvUnread,
                  accent: colors.green,
                  avatar: (
                    <span style={{ width: "2.75rem", height: "2.75rem", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: `rgba(${rgb.green}, 0.18)`, color: colors.green, border: `1px solid rgba(${rgb.green}, 0.4)` }}>
                      <ChatIcon size={18} />
                    </span>
                  ),
                  onClick: () => { setSelection({ type: "tgv" }); setMobileView("chat"); },
                });
              }
            }

            // DMs
            profiles
              .filter((p) => p.username !== currentUser)
              .forEach((p) => {
                const rowKey = `u:${p.username}`;
                const meta = rowMeta[rowKey];
                if (meta?.deleted) return;
                if (meta?.archived) return; // archived handled via showArchived section below
                const online = presence.find((pr) => pr.sysUser === p.username)?.online ?? false;
                const unread = !!meta?.markedUnread;
                const pinned = !!meta?.pinned;
                if (!matchFilter(unread, pinned, "dm")) return;
                if (q && !(p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q))) return;
                rows.push({
                  kind: "dm",
                  key: rowKey,
                  name: p.displayName,
                  sub: p.title || `@${p.username}`,
                  pinned,
                  unread,
                  online,
                  accent: p.accentColor,
                  avatar: <UserAvatar profile={p} size={44} />,
                  meta,
                  profile: p,
                  onClick: () => {
                    setSelection({ type: "dm", peer: p });
                    setDmMessages([]);
                    if (meta?.markedUnread) patchRowMeta(rowKey, { markedUnread: false });
                    setMobileView("chat");
                  },
                });
              });

            // Groups
            groups.forEach((g) => {
              const rowKey = `g:${g.id}`;
              const meta = rowMeta[rowKey];
              if (meta?.archived) return;
              const unread = !!meta?.markedUnread;
              const pinned = !!meta?.pinned;
              if (!matchFilter(unread, pinned, "group")) return;
              if (q && !g.name.toLowerCase().includes(q)) return;
              rows.push({
                kind: "group",
                key: rowKey,
                name: g.name,
                sub: `${(g.memberIds ?? []).length} members`,
                pinned,
                unread,
                accent: colors.green,
                avatar: (
                  <span style={{ width: "2.75rem", height: "2.75rem", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: `rgba(${rgb.green}, 0.14)`, color: colors.green, border: `1px solid rgba(${rgb.green}, 0.28)` }}>
                    <MembersIcon size={18} />
                  </span>
                ),
                meta,
                group: g,
                onClick: () => {
                  setSelection({ type: "group", groupId: g.id });
                  if (meta?.markedUnread) patchRowMeta(rowKey, { markedUnread: false });
                  setMobileView("chat");
                },
              });
            });

            rows.sort((a, b) => {
              if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
              if (a.unread !== b.unread) return a.unread ? -1 : 1;
              return a.name.localeCompare(b.name);
            });

            const archivedCount = Object.entries(rowMeta).filter(([, m]) => m.archived).length;

            return (
              <MobileList>
                <MobileListHeader>
                  <MobileTitle>Chat</MobileTitle>
                  <Tooltip accent={colors.green} label="New group">
                    <MobileHeaderBtn $primary onClick={() => setShowCreateGroup(true)} aria-label="New group">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M8 3v10M3 8h10"/>
                      </svg>
                    </MobileHeaderBtn>
                  </Tooltip>
                </MobileListHeader>
                <MobileSearchWrap>
                  <MobileSearchInput
                    placeholder="Search"
                    value={mobileSearch}
                    onChange={(e) => setMobileSearch(e.target.value)}
                  />
                </MobileSearchWrap>
                <MobilePillRow>
                  <MobilePill $active={mobileFilter === "all"} onClick={() => setMobileFilter("all")}>All</MobilePill>
                  <MobilePill $active={mobileFilter === "unread"} onClick={() => setMobileFilter("unread")}>Unread</MobilePill>
                  <MobilePill $active={mobileFilter === "favorites"} onClick={() => setMobileFilter("favorites")}>Favorites</MobilePill>
                  <MobilePill $active={mobileFilter === "groups"} onClick={() => setMobileFilter("groups")}>Groups</MobilePill>
                </MobilePillRow>
                <MobileScroll>
                  {archivedCount > 0 && (
                    <MobileArchivedBar onClick={() => setShowArchived((v) => !v)}>
                      <MobileArchivedIcon><WaArchive/></MobileArchivedIcon>
                      <span style={{ flex: 1 }}>Archived</span>
                      <span style={{ color: colors.green, fontWeight: 600 }}>{archivedCount}</span>
                    </MobileArchivedBar>
                  )}
                  {rows.length === 0 ? (
                    <MobileRowEmpty>No chats match this filter.</MobileRowEmpty>
                  ) : rows.map((r) => {
                    const isActive = (
                      (r.kind === "tgv" && selection.type === "tgv") ||
                      (r.kind === "dm" && selection.type === "dm" && `u:${selection.peer.username}` === r.key) ||
                      (r.kind === "group" && selection.type === "group" && `g:${selection.groupId}` === r.key)
                    );
                    const menuOpen = rowHoverMenu === r.key;
                    const meta = r.meta;
                    const muted = isMuted(meta);
                    return (
                      <MobileRowWrap key={r.key} $active={isActive}>
                        <MobileRow
                          $active={isActive}
                          onClick={(e) => {
                            if (longPressFired.current) { longPressFired.current = false; e.preventDefault(); e.stopPropagation(); return; }
                            if (menuOpen) { setRowHoverMenu(null); setMuteSubmenuFor(null); return; }
                            r.onClick();
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setRowHoverMenu(menuOpen ? null : r.key);
                            setMuteSubmenuFor(null);
                          }}
                          onTouchStart={() => startLongPress(r.key)}
                          onTouchEnd={cancelLongPress}
                          onTouchMove={cancelLongPress}
                          onTouchCancel={cancelLongPress}
                        >
                          <MobileRowAvatar>
                            {r.avatar}
                            {r.kind === "dm" && (r as { online: boolean }).online && (
                              <span style={{ position: "absolute", right: 0, bottom: 0, width: 10, height: 10, borderRadius: "50%", background: colors.green, boxShadow: `0 0 6px rgba(${rgb.green}, 0.6)`, border: "2px solid var(--t-surface, #0a0c12)" }}/>
                            )}
                          </MobileRowAvatar>
                          <MobileRowBody>
                            <MobileRowName $accent={r.accent}>{r.name}</MobileRowName>
                            <MobileRowSub>
                              {r.sub}
                            </MobileRowSub>
                          </MobileRowBody>
                          <MobileRowMeta>
                            {r.pinned && <MobileRowDot style={{ background: colors.green }} title="Pinned" />}
                            {r.unread && <MobileRowBadge>•</MobileRowBadge>}
                          </MobileRowMeta>
                        </MobileRow>
                        <MobileMoreBtn
                          $open={menuOpen}
                          onClick={(e) => { e.stopPropagation(); setRowHoverMenu(menuOpen ? null : r.key); setMuteSubmenuFor(null); }}
                          aria-label="Row actions"
                          title="Row actions"
                        >
                          <svg width="14" height="14" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                            <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </MobileMoreBtn>
                        {menuOpen && (
                          <MobileRowMenu onClick={(e) => e.stopPropagation()}>
                            {r.kind === "dm" && (() => {
                              const p = r.profile;
                              return (
                                <>
                                  {isActive && (
                                    <RowHoverMenuItem onClick={() => { setSelection({ type: "tgv" }); setRowHoverMenu(null); }}>
                                      <RowMenuGlyph><WaX/></RowMenuGlyph> Close chat
                                    </RowHoverMenuItem>
                                  )}
                                  <RowHoverMenuItem onClick={() => {
                                    const w = Math.round(window.screen.width * 0.7);
                                    const h = Math.round(window.screen.height * 0.8);
                                    const left = Math.round((window.screen.width - w) / 2);
                                    const top = Math.round((window.screen.height - h) / 2);
                                    window.open(`/dashboard/chat?popout=1&peer=${encodeURIComponent(p.username)}`, `tgv-chat-${p.username}`, `width=${w},height=${h},left=${left},top=${top}`);
                                    setRowHoverMenu(null);
                                  }}>
                                    <RowMenuGlyph><WaPopout/></RowMenuGlyph> Open in New Window
                                  </RowHoverMenuItem>
                                  <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { markedUnread: !meta?.markedUnread }); setRowHoverMenu(null); }}>
                                    <RowMenuGlyph><WaUnread/></RowMenuGlyph> {meta?.markedUnread ? "Mark as read" : "Mark as unread"}
                                  </RowHoverMenuItem>
                                  <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { archived: !meta?.archived }); if (isActive) setSelection({ type: "tgv" }); setRowHoverMenu(null); }}>
                                    <RowMenuGlyph><WaArchive/></RowMenuGlyph> {meta?.archived ? "Unarchive" : "Archive"}
                                  </RowHoverMenuItem>
                                  <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { pinned: !meta?.pinned }); setRowHoverMenu(null); }}>
                                    <RowMenuGlyph><WaPin/></RowMenuGlyph> {meta?.pinned ? "Unpin" : "Pin"}
                                  </RowHoverMenuItem>
                                  <RowHoverMenuItem onClick={() => {
                                    if (!confirm(meta?.blocked ? `Unblock ${p.displayName}?` : `Block ${p.displayName}? They won't be able to message you.`)) return;
                                    patchRowMeta(r.key, { blocked: !meta?.blocked });
                                    setRowHoverMenu(null);
                                  }}>
                                    <RowMenuGlyph><WaBlock/></RowMenuGlyph> {meta?.blocked ? `Unblock ${p.displayName}` : `Block ${p.displayName}`}
                                  </RowHoverMenuItem>
                                  <RowHoverMenuItem
                                    $highlight={muteSubmenuFor === r.key}
                                    onMouseEnter={() => setMuteSubmenuFor(r.key)}
                                    onClick={(e) => { e.stopPropagation(); setMuteSubmenuFor((cur) => cur === r.key ? null : r.key); }}
                                  >
                                    <RowMenuGlyph><WaMute/></RowMenuGlyph> {muted ? "Unmute" : "Mute"}
                                    <RowMenuCaret>›</RowMenuCaret>
                                    {muteSubmenuFor === r.key && (
                                      <MuteSubmenu onClick={(e) => e.stopPropagation()}>
                                        <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { muteUntil: Date.now() + 8 * 60 * 60 * 1000 }); setRowHoverMenu(null); setMuteSubmenuFor(null); }}>8 hours</RowHoverMenuItem>
                                        <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { muteUntil: Date.now() + 7 * 24 * 60 * 60 * 1000 }); setRowHoverMenu(null); setMuteSubmenuFor(null); }}>1 week</RowHoverMenuItem>
                                        <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { muteUntil: "always" }); setRowHoverMenu(null); setMuteSubmenuFor(null); }}>Always</RowHoverMenuItem>
                                        {muted && (
                                          <>
                                            <RowMenuDivider />
                                            <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { muteUntil: undefined }); setRowHoverMenu(null); setMuteSubmenuFor(null); }}>Unmute now</RowHoverMenuItem>
                                          </>
                                        )}
                                      </MuteSubmenu>
                                    )}
                                  </RowHoverMenuItem>
                                  <RowMenuDivider />
                                  <RowHoverMenuItem onClick={() => { setContactInfoFor(p.username); setRowHoverMenu(null); }}>
                                    <RowMenuGlyph><WaInfo/></RowMenuGlyph> Contact info
                                  </RowHoverMenuItem>
                                  <RowHoverMenuItem onClick={async () => {
                                    setRowHoverMenu(null);
                                    try {
                                      const res = await fetch(`/api/chat/dm?with=${encodeURIComponent(p.username)}&limit=1000`);
                                      const data = await res.json().catch(() => ({}));
                                      exportChannel(`dm-${p.username}.json`, { peer: p.username, exportedAt: new Date().toISOString(), messages: data.messages ?? data });
                                    } catch (e) { alert(e instanceof Error ? e.message : "Export failed"); }
                                  }}>
                                    <RowMenuGlyph><WaExport/></RowMenuGlyph> Export chat
                                  </RowHoverMenuItem>
                                  <RowHoverMenuItem onClick={() => { setSelection({ type: "dm", peer: p }); setDmMessages([]); setShowClearConfirm(true); setRowHoverMenu(null); }}>
                                    <RowMenuGlyph><WaClear/></RowMenuGlyph> Clear chat
                                  </RowHoverMenuItem>
                                  <RowHoverMenuItem $danger onClick={() => {
                                    if (!confirm(`Delete this chat with ${p.displayName}? This removes it from your list.`)) return;
                                    patchRowMeta(r.key, { deleted: true });
                                    if (isActive) setSelection({ type: "tgv" });
                                    setRowHoverMenu(null);
                                  }}>
                                    <RowMenuGlyph><WaTrash/></RowMenuGlyph> Delete chat
                                  </RowHoverMenuItem>
                                </>
                              );
                            })()}
                            {r.kind === "group" && (() => {
                              const g = r.group;
                              return (
                                <>
                                  <RowHoverMenuItem onClick={() => {
                                    const w = Math.round(window.screen.width * 0.7);
                                    const h = Math.round(window.screen.height * 0.8);
                                    const left = Math.round((window.screen.width - w) / 2);
                                    const top = Math.round((window.screen.height - h) / 2);
                                    window.open(`/dashboard/chat?popout=1&group=${encodeURIComponent(g.id)}`, `tgv-chat-g-${g.id}`, `width=${w},height=${h},left=${left},top=${top}`);
                                    setRowHoverMenu(null);
                                  }}>
                                    <RowMenuGlyph><WaPopout/></RowMenuGlyph> Open in New Window
                                  </RowHoverMenuItem>
                                  <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { markedUnread: !meta?.markedUnread }); setRowHoverMenu(null); }}>
                                    <RowMenuGlyph><WaUnread/></RowMenuGlyph> {meta?.markedUnread ? "Mark as read" : "Mark as unread"}
                                  </RowHoverMenuItem>
                                  <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { archived: !meta?.archived }); if (isActive) setSelection({ type: "tgv" }); setRowHoverMenu(null); }}>
                                    <RowMenuGlyph><WaArchive/></RowMenuGlyph> {meta?.archived ? "Unarchive" : "Archive"}
                                  </RowHoverMenuItem>
                                  <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { pinned: !meta?.pinned }); setRowHoverMenu(null); }}>
                                    <RowMenuGlyph><WaPin/></RowMenuGlyph> {meta?.pinned ? "Unpin" : "Pin"}
                                  </RowHoverMenuItem>
                                  <RowHoverMenuItem
                                    $highlight={muteSubmenuFor === r.key}
                                    onMouseEnter={() => setMuteSubmenuFor(r.key)}
                                    onClick={(e) => { e.stopPropagation(); setMuteSubmenuFor((cur) => cur === r.key ? null : r.key); }}
                                  >
                                    <RowMenuGlyph><WaMute/></RowMenuGlyph> {muted ? "Unmute" : "Mute"}
                                    <RowMenuCaret>›</RowMenuCaret>
                                    {muteSubmenuFor === r.key && (
                                      <MuteSubmenu onClick={(e) => e.stopPropagation()}>
                                        <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { muteUntil: Date.now() + 8 * 60 * 60 * 1000 }); setRowHoverMenu(null); setMuteSubmenuFor(null); }}>8 hours</RowHoverMenuItem>
                                        <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { muteUntil: Date.now() + 7 * 24 * 60 * 60 * 1000 }); setRowHoverMenu(null); setMuteSubmenuFor(null); }}>1 week</RowHoverMenuItem>
                                        <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { muteUntil: "always" }); setRowHoverMenu(null); setMuteSubmenuFor(null); }}>Always</RowHoverMenuItem>
                                        {muted && (
                                          <>
                                            <RowMenuDivider />
                                            <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { muteUntil: undefined }); setRowHoverMenu(null); setMuteSubmenuFor(null); }}>Unmute now</RowHoverMenuItem>
                                          </>
                                        )}
                                      </MuteSubmenu>
                                    )}
                                  </RowHoverMenuItem>
                                  <RowMenuDivider />
                                  <RowHoverMenuItem onClick={() => { setGroupAdminId(g.id); setRowHoverMenu(null); }}>
                                    <RowMenuGlyph><WaInfo/></RowMenuGlyph> Group info
                                  </RowHoverMenuItem>
                                  <RowHoverMenuItem onClick={async () => {
                                    setRowHoverMenu(null);
                                    try {
                                      const res = await fetch(`/api/chat/group/messages?groupId=${encodeURIComponent(g.id)}&limit=1000`);
                                      const data = await res.json().catch(() => ({}));
                                      exportChannel(`group-${g.id}.json`, { group: g, exportedAt: new Date().toISOString(), messages: data.messages ?? data });
                                    } catch (e) { alert(e instanceof Error ? e.message : "Export failed"); }
                                  }}>
                                    <RowMenuGlyph><WaExport/></RowMenuGlyph> Export chat
                                  </RowHoverMenuItem>
                                  <RowHoverMenuItem onClick={() => { setSelection({ type: "group", groupId: g.id }); setShowClearConfirm(true); setRowHoverMenu(null); }}>
                                    <RowMenuGlyph><WaClear/></RowMenuGlyph> Clear chat
                                  </RowHoverMenuItem>
                                  <RowHoverMenuItem $danger onClick={async () => {
                                    setRowHoverMenu(null);
                                    if (!confirm(`Exit "${g.name}"? You'll need to be re-added to rejoin.`)) return;
                                    await leaveGroup(g.id);
                                  }}>
                                    <RowMenuGlyph><WaExit/></RowMenuGlyph> Exit group
                                  </RowHoverMenuItem>
                                </>
                              );
                            })()}
                            {r.kind === "tgv" && (
                              <>
                                <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { markedUnread: !meta?.markedUnread }); setRowHoverMenu(null); }}>
                                  <RowMenuGlyph><WaUnread/></RowMenuGlyph> {meta?.markedUnread ? "Mark as read" : "Mark as unread"}
                                </RowHoverMenuItem>
                                <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { pinned: !meta?.pinned }); setRowHoverMenu(null); }}>
                                  <RowMenuGlyph><WaPin/></RowMenuGlyph> {meta?.pinned ? "Unpin" : "Pin"}
                                </RowHoverMenuItem>
                                <RowHoverMenuItem
                                  $highlight={muteSubmenuFor === r.key}
                                  onMouseEnter={() => setMuteSubmenuFor(r.key)}
                                  onClick={(e) => { e.stopPropagation(); setMuteSubmenuFor((cur) => cur === r.key ? null : r.key); }}
                                >
                                  <RowMenuGlyph><WaMute/></RowMenuGlyph> {muted ? "Unmute" : "Mute"}
                                  <RowMenuCaret>›</RowMenuCaret>
                                  {muteSubmenuFor === r.key && (
                                    <MuteSubmenu onClick={(e) => e.stopPropagation()}>
                                      <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { muteUntil: Date.now() + 8 * 60 * 60 * 1000 }); setRowHoverMenu(null); setMuteSubmenuFor(null); }}>8 hours</RowHoverMenuItem>
                                      <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { muteUntil: Date.now() + 7 * 24 * 60 * 60 * 1000 }); setRowHoverMenu(null); setMuteSubmenuFor(null); }}>1 week</RowHoverMenuItem>
                                      <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { muteUntil: "always" }); setRowHoverMenu(null); setMuteSubmenuFor(null); }}>Always</RowHoverMenuItem>
                                      {muted && (
                                        <>
                                          <RowMenuDivider />
                                          <RowHoverMenuItem onClick={() => { patchRowMeta(r.key, { muteUntil: undefined }); setRowHoverMenu(null); setMuteSubmenuFor(null); }}>Unmute now</RowHoverMenuItem>
                                        </>
                                      )}
                                    </MuteSubmenu>
                                  )}
                                </RowHoverMenuItem>
                              </>
                            )}
                          </MobileRowMenu>
                        )}
                      </MobileRowWrap>
                    );
                  })}
                  {showArchived && archivedCount > 0 && (
                    <>
                      <div style={{ padding: "0.625rem 0.875rem 0.375rem", fontSize: "0.6875rem", color: "var(--t-textGhost)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Archived
                      </div>
                      {profiles.filter((p) => p.username !== currentUser && rowMeta[`u:${p.username}`]?.archived && !rowMeta[`u:${p.username}`]?.deleted).map((p) => (
                        <MobileRow key={`arch-u-${p.username}`} onClick={() => { setSelection({ type: "dm", peer: p }); setDmMessages([]); setMobileView("chat"); }}>
                          <MobileRowAvatar><UserAvatar profile={p} size={44} /></MobileRowAvatar>
                          <MobileRowBody>
                            <MobileRowName $accent={p.accentColor}>{p.displayName}</MobileRowName>
                            <MobileRowSub>Archived · @{p.username}</MobileRowSub>
                          </MobileRowBody>
                        </MobileRow>
                      ))}
                      {groups.filter((g) => rowMeta[`g:${g.id}`]?.archived).map((g) => (
                        <MobileRow key={`arch-g-${g.id}`} onClick={() => { setSelection({ type: "group", groupId: g.id }); setMobileView("chat"); }}>
                          <MobileRowAvatar>
                            <span style={{ width: "2.75rem", height: "2.75rem", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: `rgba(${rgb.green}, 0.14)`, color: colors.green, border: `1px solid rgba(${rgb.green}, 0.28)` }}>
                              <MembersIcon size={18} />
                            </span>
                          </MobileRowAvatar>
                          <MobileRowBody>
                            <MobileRowName>{g.name}</MobileRowName>
                            <MobileRowSub>Archived · {(g.memberIds ?? []).length} members</MobileRowSub>
                          </MobileRowBody>
                        </MobileRow>
                      ))}
                    </>
                  )}
                </MobileScroll>
              </MobileList>
            );
          })()}
          {/* ── Sidebar ──────────────────────────────────────────── */}
          {!sidebarCollapsed && !mobileCompact && (
            <>
              <SidebarBackdrop onClick={() => setSidebarCollapsed(true)} />
              <Sidebar $width={sidebarWidth}>
                <SidebarHeader>
                  <SidebarMobileCollapse
                    aria-label="Collapse sidebar"
                    title="Collapse sidebar"
                    onClick={() => setSidebarCollapsed(true)}
                  >
                    <DTogExpandIcon side="left" size={14} />
                  </SidebarMobileCollapse>
                  <SidebarTabSwitch>
                    <Tooltip accent={colors.green} label="Show direct-message users">
                      <SidebarTabBtn
                        $active={sidebarTab === "users"}
                        $narrow={sidebarWidth < SIDEBAR_NARROW || mobileCompact}
                        onClick={() => setSidebarTab("users")}
                      >
                        {(sidebarWidth < SIDEBAR_NARROW || mobileCompact) ? (
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="8" cy="5.5" r="2.75"/>
                            <path d="M2.75 13.5c.6-2.4 2.75-3.75 5.25-3.75s4.65 1.35 5.25 3.75"/>
                          </svg>
                        ) : "Users"}
                      </SidebarTabBtn>
                    </Tooltip>
                    <Tooltip accent={colors.green} label="Show group chats">
                      <SidebarTabBtn
                        $active={sidebarTab === "groups"}
                        $narrow={sidebarWidth < SIDEBAR_NARROW || mobileCompact}
                        onClick={() => setSidebarTab("groups")}
                      >
                        {(sidebarWidth < SIDEBAR_NARROW || mobileCompact) ? (
                          <svg width="13" height="11" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="7" cy="5.5" r="2.5"/>
                            <circle cx="14.5" cy="6" r="2"/>
                            <path d="M2 13.5c.5-2.1 2.5-3.3 5-3.3s4.5 1.2 5 3.3"/>
                            <path d="M13 10.25c1.7 0 3.3.9 4.25 3.25"/>
                          </svg>
                        ) : "Groups"}
                      </SidebarTabBtn>
                    </Tooltip>
                  </SidebarTabSwitch>
                  <Tooltip accent={colors.green} label="New group chat">
                    <SidebarPlusBtn
                      onClick={() => setShowCreateGroup(true)}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                        <path d="M5 1v8M1 5h8"/>
                      </svg>
                    </SidebarPlusBtn>
                  </Tooltip>
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
                    .filter((p) => {
                      const meta = rowMeta[`u:${p.username}`];
                      if (meta?.deleted) return false;
                      if (meta?.archived) return showArchived;
                      return true;
                    })
                    .slice()
                    .sort((a, b) => {
                      const aMeta = rowMeta[`u:${a.username}`];
                      const bMeta = rowMeta[`u:${b.username}`];
                      if ((aMeta?.pinned ?? false) !== (bMeta?.pinned ?? false)) return aMeta?.pinned ? -1 : 1;
                      const aOn = presence.find((pr) => pr.sysUser === a.username)?.online ?? false;
                      const bOn = presence.find((pr) => pr.sysUser === b.username)?.online ?? false;
                      if (aOn !== bOn) return aOn ? -1 : 1;
                      return a.displayName.localeCompare(b.displayName);
                    })
                    .map((p) => {
                      const online = presence.find((pr) => pr.sysUser === p.username)?.online ?? false;
                      const isActive = selection.type === "dm" && selection.peer.username === p.username;
                      const rowKey = `u:${p.username}`;
                      const meta = rowMeta[rowKey];
                      const muted = isMuted(meta);
                      const menuOpen = rowHoverMenu === rowKey;
                      return (
                        <SidebarRowWrap key={p.username} $active={isActive}>
                          <SidebarRow
                            $active={isActive}
                            $accent={p.accentColor}
                            onClick={() => {
                              setSelection({ type: "dm", peer: p });
                              setDmMessages([]);
                              if (meta?.markedUnread) patchRowMeta(rowKey, { markedUnread: false });
                            }}
                            title={p.displayName}
                          >
                            <UserAvatar profile={p} size={18} />
                            <SidebarRowName>{p.displayName}</SidebarRowName>
                            {meta?.pinned && <PinBadge title="Pinned">★</PinBadge>}
                            {meta?.markedUnread && <PinBadge title="Unread" style={{ color: "#3fb7ff" }}>●</PinBadge>}
                            {muted && <PinBadge title="Muted" style={{ opacity: 0.55 }}>🔕</PinBadge>}
                            <SidebarRowPresence $online={online} />
                          </SidebarRow>
                          <RowHoverMenuBtn
                            $open={menuOpen}
                            onClick={(e) => { e.stopPropagation(); setRowHoverMenu(menuOpen ? null : rowKey); setMuteSubmenuFor(null); }}
                            title="More"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                              <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </RowHoverMenuBtn>
                          {menuOpen && (
                            <RowHoverMenu onClick={(e) => e.stopPropagation()}>
                              {isActive && (
                                <RowHoverMenuItem onClick={() => {
                                  setSelection({ type: "tgv" });
                                  setRowHoverMenu(null);
                                }}>
                                  <RowMenuGlyph><WaX/></RowMenuGlyph> Close chat
                                </RowHoverMenuItem>
                              )}
                              <RowHoverMenuItem onClick={() => {
                                const w = Math.round(window.screen.width * 0.7);
                                const h = Math.round(window.screen.height * 0.8);
                                const left = Math.round((window.screen.width - w) / 2);
                                const top = Math.round((window.screen.height - h) / 2);
                                window.open(`/dashboard/chat?popout=1&peer=${encodeURIComponent(p.username)}`, `tgv-chat-${p.username}`, `width=${w},height=${h},left=${left},top=${top}`);
                                setRowHoverMenu(null);
                              }}>
                                <RowMenuGlyph><WaPopout/></RowMenuGlyph> Open in New Window
                              </RowHoverMenuItem>
                              <RowHoverMenuItem onClick={() => {
                                patchRowMeta(rowKey, { markedUnread: !meta?.markedUnread });
                                setRowHoverMenu(null);
                              }}>
                                <RowMenuGlyph><WaUnread/></RowMenuGlyph> {meta?.markedUnread ? "Mark as read" : "Mark as unread"}
                              </RowHoverMenuItem>
                              <RowHoverMenuItem onClick={() => {
                                patchRowMeta(rowKey, { archived: !meta?.archived });
                                if (isActive) setSelection({ type: "tgv" });
                                setRowHoverMenu(null);
                              }}>
                                <RowMenuGlyph><WaArchive/></RowMenuGlyph> {meta?.archived ? "Unarchive" : "Archive"}
                              </RowHoverMenuItem>
                              <RowHoverMenuItem onClick={() => {
                                patchRowMeta(rowKey, { pinned: !meta?.pinned });
                                setRowHoverMenu(null);
                              }}>
                                <RowMenuGlyph><WaPin/></RowMenuGlyph> {meta?.pinned ? "Unpin" : "Pin"}
                              </RowHoverMenuItem>
                              <RowHoverMenuItem onClick={() => {
                                if (!confirm(meta?.blocked ? `Unblock ${p.displayName}?` : `Block ${p.displayName}? They won't be able to message you.`)) return;
                                patchRowMeta(rowKey, { blocked: !meta?.blocked });
                                setRowHoverMenu(null);
                              }}>
                                <RowMenuGlyph><WaBlock/></RowMenuGlyph> {meta?.blocked ? `Unblock ${p.displayName}` : `Block ${p.displayName}`}
                              </RowHoverMenuItem>
                              <RowHoverMenuItem
                                $highlight={muteSubmenuFor === rowKey}
                                onMouseEnter={() => setMuteSubmenuFor(rowKey)}
                                onClick={(e) => { e.stopPropagation(); setMuteSubmenuFor((cur) => cur === rowKey ? null : rowKey); }}
                              >
                                <RowMenuGlyph><WaMute/></RowMenuGlyph> {muted ? "Unmute" : "Mute"}
                                <RowMenuCaret>›</RowMenuCaret>
                                {muteSubmenuFor === rowKey && (
                                  <MuteSubmenu onClick={(e) => e.stopPropagation()}>
                                    <RowHoverMenuItem onClick={() => {
                                      patchRowMeta(rowKey, { muteUntil: Date.now() + 8 * 60 * 60 * 1000 });
                                      setRowHoverMenu(null); setMuteSubmenuFor(null);
                                    }}>8 hours</RowHoverMenuItem>
                                    <RowHoverMenuItem onClick={() => {
                                      patchRowMeta(rowKey, { muteUntil: Date.now() + 7 * 24 * 60 * 60 * 1000 });
                                      setRowHoverMenu(null); setMuteSubmenuFor(null);
                                    }}>1 week</RowHoverMenuItem>
                                    <RowHoverMenuItem onClick={() => {
                                      patchRowMeta(rowKey, { muteUntil: "always" });
                                      setRowHoverMenu(null); setMuteSubmenuFor(null);
                                    }}>Always</RowHoverMenuItem>
                                    {muted && (
                                      <>
                                        <RowMenuDivider />
                                        <RowHoverMenuItem onClick={() => {
                                          patchRowMeta(rowKey, { muteUntil: undefined });
                                          setRowHoverMenu(null); setMuteSubmenuFor(null);
                                        }}>Unmute now</RowHoverMenuItem>
                                      </>
                                    )}
                                  </MuteSubmenu>
                                )}
                              </RowHoverMenuItem>
                              <RowMenuDivider />
                              <RowHoverMenuItem onClick={() => {
                                setContactInfoFor(p.username);
                                setRowHoverMenu(null);
                              }}>
                                <RowMenuGlyph><WaInfo/></RowMenuGlyph> Contact info
                              </RowHoverMenuItem>
                              <RowHoverMenuItem onClick={async () => {
                                setRowHoverMenu(null);
                                try {
                                  const res = await fetch(`/api/chat/dm?with=${encodeURIComponent(p.username)}&limit=1000`);
                                  const data = await res.json().catch(() => ({}));
                                  exportChannel(`dm-${p.username}.json`, { peer: p.username, exportedAt: new Date().toISOString(), messages: data.messages ?? data });
                                } catch (e) { alert(e instanceof Error ? e.message : "Export failed"); }
                              }}>
                                <RowMenuGlyph><WaExport/></RowMenuGlyph> Export chat
                              </RowHoverMenuItem>
                              <RowHoverMenuItem onClick={() => {
                                setSelection({ type: "dm", peer: p });
                                setDmMessages([]);
                                setShowClearConfirm(true);
                                setRowHoverMenu(null);
                              }}>
                                <RowMenuGlyph><WaClear/></RowMenuGlyph> Clear chat
                              </RowHoverMenuItem>
                              <RowHoverMenuItem $danger onClick={() => {
                                if (!confirm(`Delete this chat with ${p.displayName}? This removes it from your list.`)) return;
                                patchRowMeta(rowKey, { deleted: true });
                                if (isActive) setSelection({ type: "tgv" });
                                setRowHoverMenu(null);
                              }}>
                                <RowMenuGlyph><WaTrash/></RowMenuGlyph> Delete chat
                              </RowHoverMenuItem>
                            </RowHoverMenu>
                          )}
                        </SidebarRowWrap>
                      );
                    })}

                  {sidebarTab === "groups" && (
                    <>
                      {groups
                        .filter((g) => {
                          const meta = rowMeta[`g:${g.id}`];
                          if (meta?.archived) return showArchived;
                          return true;
                        })
                        .slice()
                        .sort((a, b) => {
                          const aMeta = rowMeta[`g:${a.id}`];
                          const bMeta = rowMeta[`g:${b.id}`];
                          if ((aMeta?.pinned ?? false) !== (bMeta?.pinned ?? false)) return aMeta?.pinned ? -1 : 1;
                          return a.name.localeCompare(b.name);
                        })
                        .map((g) => {
                          const isActive = selection.type === "group" && selection.groupId === g.id;
                          const rowKey = `g:${g.id}`;
                          const meta = rowMeta[rowKey];
                          const muted = isMuted(meta);
                          const menuOpen = rowHoverMenu === rowKey;
                          return (
                          <SidebarRowWrap key={g.id} $active={isActive}>
                            <SidebarRow
                              $active={isActive}
                              onClick={() => {
                                setSelection({ type: "group", groupId: g.id });
                                if (meta?.markedUnread) patchRowMeta(rowKey, { markedUnread: false });
                              }}
                              title={g.name}
                            >
                              <MembersIcon size={14} />
                              <SidebarRowName>{g.name}</SidebarRowName>
                              {meta?.pinned && <PinBadge title="Pinned">★</PinBadge>}
                              {meta?.markedUnread && <PinBadge title="Unread" style={{ color: "#3fb7ff" }}>●</PinBadge>}
                              {muted && <PinBadge title="Muted" style={{ opacity: 0.55 }}>🔕</PinBadge>}
                            </SidebarRow>
                            <RowHoverMenuBtn
                              $open={menuOpen}
                              onClick={(e) => { e.stopPropagation(); setRowHoverMenu(menuOpen ? null : rowKey); setMuteSubmenuFor(null); }}
                              title="More"
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                                <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </RowHoverMenuBtn>
                            {menuOpen && (
                              <RowHoverMenu onClick={(e) => e.stopPropagation()}>
                                <RowHoverMenuItem onClick={() => {
                                  const w = Math.round(window.screen.width * 0.7);
                                  const h = Math.round(window.screen.height * 0.8);
                                  const left = Math.round((window.screen.width - w) / 2);
                                  const top = Math.round((window.screen.height - h) / 2);
                                  window.open(`/dashboard/chat?popout=1&group=${encodeURIComponent(g.id)}`, `tgv-chat-g-${g.id}`, `width=${w},height=${h},left=${left},top=${top}`);
                                  setRowHoverMenu(null);
                                }}>
                                  <RowMenuGlyph><WaPopout/></RowMenuGlyph> Open in New Window
                                </RowHoverMenuItem>
                                <RowHoverMenuItem onClick={() => {
                                  patchRowMeta(rowKey, { markedUnread: !meta?.markedUnread });
                                  setRowHoverMenu(null);
                                }}>
                                  <RowMenuGlyph><WaUnread/></RowMenuGlyph> {meta?.markedUnread ? "Mark as read" : "Mark as unread"}
                                </RowHoverMenuItem>
                                <RowHoverMenuItem onClick={() => {
                                  patchRowMeta(rowKey, { archived: !meta?.archived });
                                  if (isActive) setSelection({ type: "tgv" });
                                  setRowHoverMenu(null);
                                }}>
                                  <RowMenuGlyph><WaArchive/></RowMenuGlyph> {meta?.archived ? "Unarchive" : "Archive"}
                                </RowHoverMenuItem>
                                <RowHoverMenuItem onClick={() => {
                                  patchRowMeta(rowKey, { pinned: !meta?.pinned });
                                  setRowHoverMenu(null);
                                }}>
                                  <RowMenuGlyph><WaPin/></RowMenuGlyph> {meta?.pinned ? "Unpin" : "Pin"}
                                </RowHoverMenuItem>
                                <RowHoverMenuItem
                                  $highlight={muteSubmenuFor === rowKey}
                                  onMouseEnter={() => setMuteSubmenuFor(rowKey)}
                                  onClick={(e) => { e.stopPropagation(); setMuteSubmenuFor((cur) => cur === rowKey ? null : rowKey); }}
                                >
                                  <RowMenuGlyph><WaMute/></RowMenuGlyph> {muted ? "Unmute" : "Mute"}
                                  <RowMenuCaret>›</RowMenuCaret>
                                  {muteSubmenuFor === rowKey && (
                                    <MuteSubmenu onClick={(e) => e.stopPropagation()}>
                                      <RowHoverMenuItem onClick={() => {
                                        patchRowMeta(rowKey, { muteUntil: Date.now() + 8 * 60 * 60 * 1000 });
                                        setRowHoverMenu(null); setMuteSubmenuFor(null);
                                      }}>8 hours</RowHoverMenuItem>
                                      <RowHoverMenuItem onClick={() => {
                                        patchRowMeta(rowKey, { muteUntil: Date.now() + 7 * 24 * 60 * 60 * 1000 });
                                        setRowHoverMenu(null); setMuteSubmenuFor(null);
                                      }}>1 week</RowHoverMenuItem>
                                      <RowHoverMenuItem onClick={() => {
                                        patchRowMeta(rowKey, { muteUntil: "always" });
                                        setRowHoverMenu(null); setMuteSubmenuFor(null);
                                      }}>Always</RowHoverMenuItem>
                                      {muted && (
                                        <>
                                          <RowMenuDivider />
                                          <RowHoverMenuItem onClick={() => {
                                            patchRowMeta(rowKey, { muteUntil: undefined });
                                            setRowHoverMenu(null); setMuteSubmenuFor(null);
                                          }}>Unmute now</RowHoverMenuItem>
                                        </>
                                      )}
                                    </MuteSubmenu>
                                  )}
                                </RowHoverMenuItem>
                                <RowMenuDivider />
                                <RowHoverMenuItem onClick={() => {
                                  setGroupAdminId(g.id);
                                  setRowHoverMenu(null);
                                }}>
                                  <RowMenuGlyph><WaInfo/></RowMenuGlyph> Group info
                                </RowHoverMenuItem>
                                <RowHoverMenuItem onClick={async () => {
                                  setRowHoverMenu(null);
                                  try {
                                    const res = await fetch(`/api/chat/group/messages?groupId=${encodeURIComponent(g.id)}&limit=1000`);
                                    const data = await res.json().catch(() => ({}));
                                    exportChannel(`group-${g.id}.json`, { group: g, exportedAt: new Date().toISOString(), messages: data.messages ?? data });
                                  } catch (e) { alert(e instanceof Error ? e.message : "Export failed"); }
                                }}>
                                  <RowMenuGlyph><WaExport/></RowMenuGlyph> Export chat
                                </RowHoverMenuItem>
                                <RowHoverMenuItem onClick={() => {
                                  setSelection({ type: "group", groupId: g.id });
                                  setShowClearConfirm(true);
                                  setRowHoverMenu(null);
                                }}>
                                  <RowMenuGlyph><WaClear/></RowMenuGlyph> Clear chat
                                </RowHoverMenuItem>
                                <RowHoverMenuItem $danger onClick={async () => {
                                  setRowHoverMenu(null);
                                  if (!confirm(`Exit "${g.name}"? You'll need to be re-added to rejoin.`)) return;
                                  await leaveGroup(g.id);
                                }}>
                                  <RowMenuGlyph><WaExit/></RowMenuGlyph> Exit group
                                </RowHoverMenuItem>
                              </RowHoverMenu>
                            )}
                          </SidebarRowWrap>
                          );
                        })}
                    </>
                  )}
                  {(() => {
                    const prefix = sidebarTab === "users" ? "u:" : "g:";
                    const archivedCount = Object.entries(rowMeta).filter(([k, m]) => k.startsWith(prefix) && m.archived).length;
                    if (archivedCount === 0) return null;
                    return (
                      <Tooltip accent={colors.green} label={showArchived ? "Hide archived" : "Show archived"}>
                        <ArchivedToggle
                          $open={showArchived}
                          onClick={() => setShowArchived((p) => !p)}
                        >
                          <RowMenuGlyph><WaArchive/></RowMenuGlyph>
                          {showArchived ? "Hide" : "Show"} archived ({archivedCount})
                        </ArchivedToggle>
                      </Tooltip>
                    );
                  })()}
                </SidebarList>
              </Sidebar>

              <Tooltip accent={colors.green} label="Drag to resize · click to collapse">
                <SidebarDTog
                  onMouseDown={onSidebarResizeStart}
                  onTouchStart={onSidebarResizeTouchStart}
                  $dragging={sidebarDragging}
                >
                  <DTogGrip />
                </SidebarDTog>
              </Tooltip>
            </>
          )}

          {(!mobileCompact || mobileView === "chat") && (
          <ConvPane>
            {sidebarCollapsed && !mobileCompact && (
              <Tooltip accent={colors.green} label="Show sidebar">
                <DTogTab
                  onClick={() => setSidebarCollapsed(false)}
                >
                  <DTogExpandIcon side="left" />
                </DTogTab>
              </Tooltip>
            )}

            {/* ── Chat header row (peer / group / TGV) ────────── */}
            {(() => {
              const isDM = selection.type === "dm" && !!peer;
              const isGroup = selection.type === "group";
              const activeGroup = isGroup ? groups.find((g) => g.id === selection.groupId) : undefined;
              if (!isTGV && !isDM && !isGroup) return null;

              const accent = isDM ? (peer?.accentColor ?? VIOLET)
                : isGroup ? colors.green
                : colors.green;

              const members = isGroup && activeGroup
                ? (activeGroup.memberIds ?? [])
                    .map((username) => profiles.find((p) => p.username === username))
                    .filter((p): p is MemberProfile => !!p)
                : [];
              const filteredMembers = headerMemberQuery
                ? members.filter((m) =>
                    m.displayName.toLowerCase().includes(headerMemberQuery.toLowerCase()) ||
                    m.username.toLowerCase().includes(headerMemberQuery.toLowerCase()))
                : members;

              return (
                <div style={{ position: "relative" }}>
                  <ChatHeaderRow $accent={accent}>
                    {mobileCompact && (
                      <MobileBackBtn
                        onClick={() => setMobileView("list")}
                        aria-label="Back to chats"
                        title="Back to chats"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 3L5 8l5 5"/>
                        </svg>
                      </MobileBackBtn>
                    )}
                    {isDM && peer ? (
                      <ChatHeaderLeft
                        $accent={accent}
                        onClick={() => setContactInfoFor(peer.username)}
                        title="View profile"
                      >
                        <UserAvatar profile={peer} size={28} />
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, alignItems: "flex-start" }}>
                          <ChatHeaderName>{peer.displayName}</ChatHeaderName>
                          {peer.title && <ChatHeaderSub>{peer.title}</ChatHeaderSub>}
                        </div>
                      </ChatHeaderLeft>
                    ) : isGroup && activeGroup ? (
                      <ChatHeaderLeft
                        $accent={accent}
                        onClick={() => {
                          setHeaderMembersOpen((v) => !v);
                          setHeaderMemberQuery("");
                        }}
                        title="View members"
                      >
                        <MembersIcon size={18} />
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, alignItems: "flex-start" }}>
                          <ChatHeaderName>{activeGroup.name}</ChatHeaderName>
                          <ChatHeaderSub>{(activeGroup.memberIds ?? []).length} members</ChatHeaderSub>
                        </div>
                      </ChatHeaderLeft>
                    ) : (
                      <ChatHeaderLeft $accent={accent} as="div" style={{ cursor: "default" }}>
                        <ChatIcon size={18} />
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, alignItems: "flex-start" }}>
                          <ChatHeaderName>TGV Chatroom</ChatHeaderName>
                          <ChatHeaderSub>All members</ChatHeaderSub>
                        </div>
                      </ChatHeaderLeft>
                    )}
                    <ChatHeaderActions>
                      <Tooltip accent={accent} label="Video call">
                        <ChatHeaderIconBtn
                          $accent={accent}
                          onClick={() => alert("Video call: coming soon")}
                        >
                          <VideoIcon size={16} />
                        </ChatHeaderIconBtn>
                      </Tooltip>
                      <Tooltip accent={accent} label="Voice call">
                        <ChatHeaderIconBtn
                          $accent={accent}
                          onClick={() => alert("Voice call: coming soon")}
                        >
                          <PhoneIcon size={16} />
                        </ChatHeaderIconBtn>
                      </Tooltip>
                    </ChatHeaderActions>
                  </ChatHeaderRow>
                  {isGroup && headerMembersOpen && activeGroup && (
                    <ChatHeaderMemberDropdown $accent={accent}>
                      <ChatHeaderMemberSearch
                        $accent={accent}
                        placeholder="Search members…"
                        value={headerMemberQuery}
                        onChange={(e) => setHeaderMemberQuery(e.target.value)}
                        autoFocus
                      />
                      {filteredMembers.length === 0 ? (
                        <div style={{ padding: "0.5rem", fontSize: "0.75rem", opacity: 0.6 }}>
                          No members found.
                        </div>
                      ) : (
                        filteredMembers.map((m) => (
                          <ChatHeaderMemberItem
                            key={m.username}
                            $accent={accent}
                            onClick={() => {
                              setHeaderMembersOpen(false);
                              setContactInfoFor(m.username);
                            }}
                          >
                            <UserAvatar profile={m} size={22} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {m.displayName}
                            </span>
                          </ChatHeaderMemberItem>
                        ))
                      )}
                    </ChatHeaderMemberDropdown>
                  )}
                </div>
              );
            })()}

            {/* ── Chat messages ────────────────────────────────── */}
            {isTGV && (
              <ScrollableMessages>
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
                          replyTo={msg.replyTo}
                          reactions={msg.reactions}
                          currentUser={currentUser}
                          profile={profile} isMe={msg.from === currentUser}
                          settings={settings} canDelete={msg.from === currentUser || isAdmin}
                          onDelete={() => deleteMessage(msg.id)}
                          onEdit={(content) => editMessage(msg.id, content)}
                          onReply={() => {
                            const who = profile?.displayName ?? msg.from;
                            setReplyTarget({
                              id: msg.id,
                              from: who,
                              excerpt: makeExcerpt(msg.content, msg.fileName),
                            });
                          }}
                          onJumpToReply={(targetId) => scrollToMessage(targetId)}
                          onReact={(mid, emoji) => reactTgv(mid, emoji)}
                        />
                      </Fragment>
                    );
                  });
                })()}
                <div ref={bottomRef} />
              </ScrollableMessages>
            )}

            {/* ── DM thread ────────────────────────────────────── */}
            {selection.type === "dm" && peer && (
              <ScrollableMessages>
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
                          readBy={msg.readBy} peerUsername={selection.peer.username}
                          replyTo={msg.replyTo}
                          reactions={msg.reactions}
                          currentUser={currentUser}
                          profile={profile} isMe={msg.from === currentUser}
                          settings={settings} canDelete={msg.from === currentUser}
                          onDelete={() => deleteDm(msg.id)}
                          onEdit={(content) => editDm(msg.id, content)}
                          onReply={() => {
                            const who = profile?.displayName ?? msg.from;
                            setReplyTarget({
                              id: msg.id,
                              from: who,
                              excerpt: makeExcerpt(msg.content),
                            });
                          }}
                          onJumpToReply={(targetId) => scrollToMessage(targetId)}
                          onReact={(mid, emoji) => reactDm(mid, emoji, selection.peer.username)}
                        />
                      </Fragment>
                    );
                  });
                })()}
                <div ref={dmBottomRef} />
              </ScrollableMessages>
            )}

            {/* ── Group thread ────────────────────────────────── */}
            {selection.type === "group" && (() => {
              const activeGroup = groups.find((g) => g.id === selection.groupId);
              if (!activeGroup) {
                return (
                  <MsgScroll>
                    <EmptyChat>
                      <EmptyIcon>👥</EmptyIcon>
                      <EmptyText>Group not found.</EmptyText>
                    </EmptyChat>
                  </MsgScroll>
                );
              }
              if (!activeGroup.isMember) {
                return (
                  <MsgScroll>
                    <EmptyChat>
                      <EmptyIcon>👥</EmptyIcon>
                      <EmptyText>
                        <strong>{activeGroup.name}</strong> · {activeGroup.visibility ?? "open"}
                      </EmptyText>
                      <EmptyText style={{ color: "var(--t-textMuted)" }}>
                        {activeGroup.visibility === "open"
                          ? "You're not a member yet."
                          : "Members-only. Ask an admin for an invite."}
                      </EmptyText>
                      {activeGroup.visibility === "open" && (
                        <button
                          onClick={() => joinGroup(activeGroup.id)}
                          style={{
                            marginTop: "0.5rem",
                            padding: "0.4rem 0.85rem",
                            fontSize: "0.75rem",
                            borderRadius: "8px",
                            background: `rgba(${rgb.green}, 0.18)`,
                            border: `1px solid rgba(${rgb.green}, 0.55)`,
                            color: colors.green,
                            cursor: "pointer",
                          }}
                        >
                          Join group
                        </button>
                      )}
                    </EmptyChat>
                  </MsgScroll>
                );
              }
              return (
                <ScrollableMessages>
                  {groupMessages.length === 0 ? (
                    <EmptyChat>
                      <EmptyIcon>👥</EmptyIcon>
                      <EmptyText>Start the conversation in {activeGroup.name}.</EmptyText>
                    </EmptyChat>
                  ) : (() => {
                    let lastKey = "";
                    return groupMessages.map((msg) => {
                      const profile = profiles.find((p) => p.username === msg.from);
                      const k = dayKey(msg.createdAt, settings.timezone);
                      const showDivider = k !== lastKey;
                      lastKey = k;
                      const canDelete = msg.from === currentUser || (activeGroup.admins ?? []).includes(currentUser);
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
                            replyTo={msg.replyTo}
                            reactions={msg.reactions}
                            currentUser={currentUser}
                            profile={profile} isMe={msg.from === currentUser}
                            settings={settings} canDelete={canDelete}
                            onDelete={() => deleteGroupMessage(msg.id)}
                            onEdit={(content) => editGroupMessage(msg.id, content)}
                            onReply={() => {
                              const who = profile?.displayName ?? msg.from;
                              setReplyTarget({
                                id: msg.id,
                                from: who,
                                excerpt: makeExcerpt(msg.content),
                              });
                            }}
                            onJumpToReply={(targetId) => scrollToMessage(targetId)}
                            onReact={(mid, emoji) => reactGroup(mid, emoji, activeGroup.id)}
                          />
                        </Fragment>
                      );
                    });
                  })()}
                  <div ref={groupBottomRef} />
                </ScrollableMessages>
              );
            })()}

            {/* ── Input (TGV + DM + group member) ─────────────── */}
            {(isTGV || selection.type === "dm" || (selection.type === "group" && groups.find((g) => g.id === selection.groupId)?.isMember)) && (
              <InputArea>
                {replyTarget && (
                  <ReplyChipRow $accent={peer?.accentColor ?? VIOLET}>
                    <ReplyIcon size={14} />
                    <ReplyChipCol>
                      <ReplyChipFrom $accent={peer?.accentColor ?? VIOLET}>
                        Replying to {replyTarget.from}
                      </ReplyChipFrom>
                      <ReplyChipExcerpt>{replyTarget.excerpt}</ReplyChipExcerpt>
                    </ReplyChipCol>
                    <ReplyChipClose
                      onClick={() => setReplyTarget(null)}
                      title="Cancel reply"
                    >
                      <CancelIcon size={14} />
                    </ReplyChipClose>
                  </ReplyChipRow>
                )}
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
                  const composer = selection.type === "dm"
                    ? dmInput
                    : selection.type === "group"
                      ? groupInput
                      : input;
                  const gifs = extractGifUrls(composer);
                  if (!gifs.length) return null;
                  const removeGif = (url: string) => {
                    const stripped = composer.replace(url, "").replace(/\s+/g, " ").trim();
                    if (selection.type === "dm") setDmInput(stripped);
                    else if (selection.type === "group") setGroupInput(stripped);
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
                    <TypingBubble>
                      {[0, 1, 2].map((i) => (
                        <TypingDot key={i} $delay={i * 0.2} />
                      ))}
                    </TypingBubble>
                    <TypingText>
                      {typers.length === 1
                        ? `${typers[0]} is typing…`
                        : typers.length === 2
                        ? `${typers[0]} and ${typers[1]} are typing…`
                        : "Several people are typing…"}
                    </TypingText>
                  </TypingRow>
                )}

                <InputRow ref={inputRowRef}>
                  {!voiceActive && composerNarrow && (
                    <ComposerMoreAnchor onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                      <Tooltip accent={colors.green} label="More options">
                        <ComposerMoreBtn
                          $open={composerMoreOpen}
                          onClick={() => setComposerMoreOpen((p) => !p)}
                        >
                          ⋯
                        </ComposerMoreBtn>
                      </Tooltip>
                      {composerMoreOpen && (
                        <ComposerMorePopup>
                          {isTGV && (
                            <>
                              <ComposerMoreItem onClick={() => { setComposerMoreOpen(false); fileRef.current?.click(); }}>
                                <AttachMenuIcon><FileIcon size={16} /></AttachMenuIcon> File
                              </ComposerMoreItem>
                              <ComposerMoreItem onClick={() => { setComposerMoreOpen(false); photoRef.current?.click(); }}>
                                <AttachMenuIcon><PhotosIcon size={16} /></AttachMenuIcon> Photos &amp; videos
                              </ComposerMoreItem>
                              <ComposerMoreItem onClick={() => { setComposerMoreOpen(false); setConverterType("image"); }}>
                                <AttachMenuIcon><ConvertImageIcon size={16} /></AttachMenuIcon> Convert image
                              </ComposerMoreItem>
                              <ComposerMoreItem onClick={() => { setComposerMoreOpen(false); setConverterType("video"); }}>
                                <AttachMenuIcon><ConvertVideoIcon size={16} /></AttachMenuIcon> Convert video
                              </ComposerMoreItem>
                            </>
                          )}
                          <ComposerMoreItem onClick={() => { setComposerMoreOpen(false); setPickerOpen(true); }}>
                            <AttachMenuIcon><SmileIcon size={16} /></AttachMenuIcon> Emoji · GIFs · Stickers
                          </ComposerMoreItem>
                          <ComposerMoreItem onClick={() => {
                            setComposerMoreOpen(false);
                            talkTriggerRef.current?.querySelector("button")?.click();
                          }}>
                            <AttachMenuIcon><MicIcon size={16} /></AttachMenuIcon> Talk to text
                          </ComposerMoreItem>
                          {isTGV && (
                            <ComposerMoreItem onClick={() => {
                              setComposerMoreOpen(false);
                              voiceTriggerRef.current?.querySelector("button")?.click();
                            }}>
                              <AttachMenuIcon><WaveformIcon size={16} /></AttachMenuIcon> Voice memo
                            </ComposerMoreItem>
                          )}
                        </ComposerMorePopup>
                      )}
                    </ComposerMoreAnchor>
                  )}
                  {!voiceActive && !composerNarrow && isTGV && (
                    <>
                      <AttachMenuAnchor onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                        <Tooltip accent={colors.green} label="Attach">
                          <AttachBtn onClick={() => setAttachMenuOpen((p) => !p)}>
                            <AttachIcon size={14} />
                          </AttachBtn>
                        </Tooltip>
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
                    </>
                  )}
                  {!voiceActive && (
                    <>
                      <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileChange} />
                      <input ref={photoRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFileChange} />
                    </>
                  )}

                  {!voiceActive && (
                  <>
                  {!composerNarrow && (
                  <PickerAnchor onClick={(e) => e.stopPropagation()}>
                    <Tooltip accent={colors.green} label="Emoji · GIFs · Stickers">
                      <PickerBtn onClick={() => setPickerOpen((p) => !p)}>
                        <SmileIcon size={16} />
                      </PickerBtn>
                    </Tooltip>
                    {pickerOpen && (
                      <ChatPicker
                        onClose={() => setPickerOpen(false)}
                        onEmoji={(e) => {
                          if (selection.type === "dm") setDmInput((prev) => prev + e);
                          else if (selection.type === "group") setGroupInput((prev) => prev + e);
                          else setInput((prev) => prev + e);
                        }}
                        onGif={(url) => {
                          if (selection.type === "dm") setDmInput((prev) => (prev ? `${prev} ${url}` : url));
                          else if (selection.type === "group") setGroupInput((prev) => (prev ? `${prev} ${url}` : url));
                          else setInput((prev) => (prev ? `${prev} ${url}` : url));
                        }}
                        onSticker={(url) => {
                          if (selection.type === "dm") setDmInput((prev) => (prev ? `${prev} ${url}` : url));
                          else if (selection.type === "group") setGroupInput((prev) => (prev ? `${prev} ${url}` : url));
                          else setInput((prev) => (prev ? `${prev} ${url}` : url));
                        }}
                      />
                    )}
                  </PickerAnchor>
                  )}
                  {composerNarrow && pickerOpen && (
                    <ChatPicker
                      onClose={() => setPickerOpen(false)}
                      onEmoji={(e) => {
                        if (selection.type === "dm") setDmInput((prev) => prev + e);
                        else if (selection.type === "group") setGroupInput((prev) => prev + e);
                        else setInput((prev) => prev + e);
                      }}
                      onGif={(url) => {
                        if (selection.type === "dm") setDmInput((prev) => (prev ? `${prev} ${url}` : url));
                        else if (selection.type === "group") setGroupInput((prev) => (prev ? `${prev} ${url}` : url));
                        else setInput((prev) => (prev ? `${prev} ${url}` : url));
                      }}
                      onSticker={(url) => {
                        if (selection.type === "dm") setDmInput((prev) => (prev ? `${prev} ${url}` : url));
                        else if (selection.type === "group") setGroupInput((prev) => (prev ? `${prev} ${url}` : url));
                        else setInput((prev) => (prev ? `${prev} ${url}` : url));
                      }}
                    />
                  )}

                  <ChatTextarea
                    value={
                      selection.type === "dm"
                        ? dmInput
                        : selection.type === "group"
                          ? groupInput
                          : input
                    }
                    onChange={(e) => {
                      if (selection.type === "dm") setDmInput(e.target.value);
                      else if (selection.type === "group") setGroupInput(e.target.value);
                      else setInput(e.target.value);
                      if (e.target.value.trim()) signalTyping();
                    }}
                    onKeyDown={(e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (selection.type === "dm") sendDm();
                        else if (selection.type === "group") sendGroupMessage();
                        else sendMessage();
                      }
                    }}
                    placeholder={
                      composerNarrow
                        ? "Enter to send"
                        : selection.type === "dm" && peer
                          ? `Message ${peer.displayName}…`
                          : selection.type === "group"
                            ? "Message group…"
                            : "Enter to send · Shift+Enter for newline"
                    }
                    rows={1}
                    $accent={
                      selection.type === "dm"
                        ? (peer?.accentColor ?? VIOLET)
                        : selection.type === "group"
                          ? colors.green
                          : undefined
                    }
                    style={{
                      fontSize: settings.fontSize === "xs" ? 11 : settings.fontSize === "sm" ? 13 : 15,
                    }}
                  />

                  <div
                    ref={talkTriggerRef}
                    style={{ display: composerNarrow && !talkActive ? "none" : "contents" }}
                  >
                    <TalkToText
                      accent={colors.green}
                      model={settings.whisperModel ?? "base.en"}
                      onTranscript={(text) => {
                        if (selection.type === "dm") {
                          setDmInput((prev) => (prev ? `${prev} ${text}` : text));
                        } else if (selection.type === "group") {
                          setGroupInput((prev) => (prev ? `${prev} ${text}` : text));
                        } else {
                          setInput((prev) => (prev ? `${prev} ${text}` : text));
                        }
                      }}
                      onError={(msg) => alert(`Transcribe: ${msg}`)}
                      onActiveChange={setTalkActive}
                      disabled={sending || uploading || dmSending || groupSending}
                    />
                  </div>
                  </>
                  )}
                  {isTGV && (
                    <div
                      ref={voiceTriggerRef}
                      style={{ display: composerNarrow && !voiceActive ? "none" : "contents" }}
                    >
                      <VoiceRecorder accent={colors.green} onSend={sendVoice} onActiveChange={setVoiceActive} disabled={sending || uploading} />
                    </div>
                  )}

                  {!voiceActive && (
                  <Tooltip accent={colors.green} label="Send (Enter)">
                    <SendBtn
                      onClick={
                        selection.type === "dm"
                          ? sendDm
                          : selection.type === "group"
                            ? sendGroupMessage
                            : sendMessage
                      }
                      disabled={
                        selection.type === "dm"
                          ? (!dmInput.trim() || dmSending)
                          : selection.type === "group"
                            ? (!groupInput.trim() || groupSending)
                            : ((sending || uploading) || (!input.trim() && !uploadFile))
                      }
                      $color={
                        selection.type === "dm"
                          ? (peer?.accentColor ?? VIOLET)
                          : selection.type === "group"
                            ? colors.green
                            : undefined
                      }
                    >
                      {(sending || uploading || dmSending || groupSending) ? (
                        <span style={{ fontSize: "0.5625rem" }}>…</span>
                      ) : (
                        <SendIcon size={14} />
                      )}
                    </SendBtn>
                  </Tooltip>
                  )}
                </InputRow>
              </InputArea>
            )}
          </ConvPane>
          )}
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
        <CreateGroupModal
          profiles={profiles}
          currentUser={currentUser}
          onClose={() => setShowCreateGroup(false)}
          onCreated={(id) => {
            loadGroups();
            setSelection({ type: "group", groupId: id });
            setSidebarTab("groups");
          }}
        />
      )}

      {showClearConfirm && (
        <ClearConfirmOverlay onMouseDown={() => setShowClearConfirm(false)}>
          <ClearConfirmCard onMouseDown={(e) => e.stopPropagation()}>
            <ClearConfirmTitle>Clear chat</ClearConfirmTitle>
            <ClearConfirmBody>
              {selection.type === "dm"
                ? `Hide this DM with ${selection.peer.displayName} for you only. Other users keep their view.`
                : selection.type === "group"
                  ? "Hide this group's messages for you only. Other members keep their view."
                  : isExec
                    ? "Choose scope: clear only your view, or wipe the global chat for everyone."
                    : "Hide the TGV chat for you only. Other users keep their view."}
            </ClearConfirmBody>
            <ClearConfirmActions>
              <GhostBtn onClick={() => setShowClearConfirm(false)}>Cancel</GhostBtn>
              <PrimaryBtn onClick={doClearMine}>Clear for me</PrimaryBtn>
              {isExec && selection.type === "tgv" && (
                <DangerBtn onClick={doClearGlobal}>Wipe for everyone</DangerBtn>
              )}
            </ClearConfirmActions>
          </ClearConfirmCard>
        </ClearConfirmOverlay>
      )}

      {groupAdminId && (() => {
        const g = groups.find((gg) => gg.id === groupAdminId);
        if (!g) return null;
        return (
          <GroupAdminModal
            group={{
              id: g.id,
              name: g.name,
              createdBy: g.createdBy ?? "",
              memberIds: g.memberIds,
              admins: g.admins ?? [],
              visibility: g.visibility,
            }}
            profiles={profiles}
            currentUser={currentUser}
            onClose={() => setGroupAdminId(null)}
            onChanged={() => loadGroups()}
            onDeleted={() => {
              loadGroups();
              setSelection({ type: "tgv" });
            }}
          />
        );
      })()}

      {contactInfoFor && (() => {
        const p = profiles.find((pp) => pp.username === contactInfoFor);
        if (!p) return null;
        return (
          <ContactInfoOverlay onMouseDown={() => setContactInfoFor(null)}>
            <ContactInfoCard $accent={p.accentColor} onMouseDown={(e) => e.stopPropagation()}>
              <NeonX
                accent="green"
                size="sm"
                onClick={() => setContactInfoFor(null)}
                title="Close"
                style={{ position: "absolute", top: "0.4rem", right: "0.4rem", zIndex: 2 }}
              />
              <ContactInfoHeader $accent={p.accentColor}>
                <UserAvatar profile={p} size={72} />
                <ContactInfoName>{p.displayName}</ContactInfoName>
                {p.title && <ContactInfoTitle>{p.title}</ContactInfoTitle>}
              </ContactInfoHeader>
              <ContactInfoBody>
                {p.bio && (
                  <ContactInfoField>
                    <ContactInfoLabel>About</ContactInfoLabel>
                    <ContactInfoValue>{p.bio}</ContactInfoValue>
                  </ContactInfoField>
                )}
                {p.email && (
                  <ContactInfoField>
                    <ContactInfoLabel>Email</ContactInfoLabel>
                    <ContactInfoValue><a href={`mailto:${p.email}`} style={{ color: "inherit" }}>{p.email}</a></ContactInfoValue>
                  </ContactInfoField>
                )}
                <ContactInfoField>
                  <ContactInfoLabel>Username</ContactInfoLabel>
                  <ContactInfoValue>@{p.username}</ContactInfoValue>
                </ContactInfoField>
              </ContactInfoBody>
            </ContactInfoCard>
          </ContactInfoOverlay>
        );
      })()}
    </>
  );
}
