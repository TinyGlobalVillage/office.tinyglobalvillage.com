"use client";

import {
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
import ChatSettingsModal, { UserAvatar, type MemberProfile, type ChatSettings as ModalChatSettings } from "./ChatSettingsModal";
import MediaConverterModal from "./MediaConverterModal";

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

type DrawerMode =
  | { view: "chat" }
  | { view: "members" }
  | { view: "dm"; peer: Profile };

const DEFAULT_SETTINGS: ChatSettings = {
  showTimestamps: true,
  timestampFormat: "time",
  fontSize: "sm",
  myFont: "sans",
};

const SETTINGS_KEY    = "tgv_chat_settings";
const TAB_STORAGE_KEY = "tgv-drawer-tab-chat-y";
const DRAWER_EVENT    = "tgv-right-drawer";
const DEFAULT_W       = 380;
const MIN_W           = 300;
const MAX_W           = 700;
const PAGE_SIZES      = [5, 10, 25, 50];

const VIOLET = colors.violet;
const VIOLET_RGB = rgb.violet;

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

function fmtTimestamp(iso: string, format: ChatSettings["timestampFormat"]): string {
  const d = new Date(iso);
  if (format === "relative") {
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
  if (format === "time") return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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

const BackBtn = styled(PanelIconBtn)`
  color: ${VIOLET};
  flex-shrink: 0;
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
  color: ${(p) => p.$color || colors.cyan};
  ${(p) => !p.$color ? `text-shadow: 0 0 8px rgba(${rgb.green}, 0.9), 0 0 20px rgba(${rgb.green}, 0.55);` : ""}

  [data-theme="light"] & {
    text-shadow: none;
  }
`;

const DmTag = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textGhost);
`;

const AvatarChips = styled.div`
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
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

const ConvertBtn = styled.button`
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
  font-size: 0.875rem;

  &:hover {
    background: rgba(${rgb.green}, 0.14);
    box-shadow: 0 0 10px rgba(${rgb.green}, 0.4);
  }
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

const MemberSearch = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);
`;

const MemberSearchInput = styled.input`
  flex: 1;
  background: transparent;
  outline: none;
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  border: none;

  &::placeholder { color: var(--t-textGhost); }
`;

const MemberSearchClear = styled.button`
  font-size: 0.5625rem;
  background: none;
  border: none;
  color: var(--t-textGhost);
  cursor: pointer;
  &:hover { color: var(--t-textMuted); }
`;

const MemberCountRow = styled.div`
  padding: 0 0.75rem 0.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;

const MemberCount = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textGhost);
`;

const PageSizeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const PageSizeLabel = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textGhost);
`;

const PageSizeBtn = styled.button<{ $active?: boolean }>`
  font-size: 0.5625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s;
  background: ${(p) => (p.$active ? `${VIOLET}22` : "transparent")};
  color: ${(p) => (p.$active ? VIOLET : "var(--t-textGhost)")};
  border: 1px solid ${(p) => (p.$active ? `${VIOLET}44` : "transparent")};
`;

const CustomSizeInput = styled.input`
  width: 2.5rem;
  font-size: 0.5625rem;
  background: transparent;
  outline: none;
  text-align: center;
  border-radius: 0.25rem;
  padding: 0.125rem 0.25rem;
  border: 1px solid ${VIOLET}44;
  color: ${VIOLET};
`;

const MemberList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  scrollbar-width: thin;
`;

const MemberCard = styled.button<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: 0.75rem;
  padding: 0.625rem 0.75rem;
  text-align: left;
  width: 100%;
  background: var(--t-inputBg);
  border: none;
  cursor: ${(p) => (p.$disabled ? "default" : "pointer")};
  opacity: ${(p) => (p.$disabled ? 0.5 : 1)};
  transition: background 0.15s;

  &:hover {
    background: ${(p) => (p.$disabled ? "var(--t-inputBg)" : "var(--t-border)")};
  }
`;

const PresenceDot = styled.span<{ $online?: boolean }>`
  position: absolute;
  bottom: 0;
  right: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid #060810;
  background: ${(p) => (p.$online ? "#4ade80" : "#374151")};
  box-shadow: ${(p) => (p.$online ? "0 0 4px #4ade80" : "none")};

  [data-theme="light"] & {
    border-color: var(--t-surface);
  }
`;

const MemberName = styled.p`
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--t-text);
  margin: 0;
  line-height: 1.3;
`;

const MemberStatus = styled.p<{ $online?: boolean }>`
  font-size: 0.5625rem;
  margin: 0;
  color: ${(p) => (p.$online ? "#4ade8099" : "var(--t-textGhost)")};
`;

const DmLabel = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textGhost);
  flex-shrink: 0;
  transition: color 0.15s;

  ${MemberCard}:hover & {
    color: var(--t-textMuted);
  }
`;

const MemberMenuBtn = styled.button`
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  background: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--t-textGhost);
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s;

  ${MemberCard}:hover & { opacity: 1; }
  &:hover { background: rgba(${VIOLET_RGB}, 0.15); color: ${VIOLET}; }
`;

const MemberMenuDrop = styled.div`
  position: absolute;
  right: 0.5rem;
  top: 2.2rem;
  z-index: 200;
  background: var(--t-surface);
  border: 1px solid var(--t-border);
  border-radius: 8px;
  padding: 0.25rem 0;
  min-width: 170px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.35);
`;

const MemberMenuItem = styled.button`
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 0.45rem 0.85rem;
  font-size: 0.75rem;
  color: var(--t-text);
  cursor: pointer;
  white-space: nowrap;
  &:hover { background: rgba(${VIOLET_RGB}, 0.12); color: ${VIOLET}; }
`;

const PagerRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  flex-shrink: 0;
  border-top: 1px solid var(--t-border);
`;

const PagerBtn = styled.button<{ $active?: boolean }>`
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.25rem;
  font-size: 0.625rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$active ? `${VIOLET}44` : "transparent")};
  background: ${(p) => (p.$active ? `${VIOLET}25` : "transparent")};
  color: ${(p) => (p.$active ? VIOLET : "var(--t-textGhost)")};
  transition: all 0.15s;

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const MemberEmpty = styled.p`
  font-size: 0.6875rem;
  color: var(--t-textGhost);
  text-align: center;
  padding: 2rem 0;
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
              {fmtTimestamp(createdAt, settings.timestampFormat)}
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
          ) : (
            <>
              {content && <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{content}</p>}
              {fileUrl && <FileAttachment url={fileUrl} name={fileName} size={fileSize} mime={fileMime} />}
            </>
          )}
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

// ── Members panel ─────────────────────────────────────────────────────────────

function MembersPanel({
  profiles,
  presence,
  currentUser,
  onSelectUser,
  onWhatsApp,
}: {
  profiles: Profile[];
  presence: { sysUser: string; online: boolean }[];
  currentUser: string;
  onSelectUser: (p: Profile) => void;
  onWhatsApp?: (p: Profile) => void;
}) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [customSize, setCustomSize] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [page, setPage] = useState(0);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  const filtered = profiles.filter((p) =>
    p.displayName.toLowerCase().includes(search.toLowerCase()) ||
    p.username.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const setSize = (n: number) => {
    setPageSize(n);
    setPage(0);
    setShowCustom(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ padding: "0.75rem 0.75rem 0.5rem", flexShrink: 0 }}>
        <MemberSearch>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="4.5" cy="4.5" r="3.5" stroke="var(--t-textGhost)" strokeWidth="1.2"/>
            <path d="M7.5 7.5l2 2" stroke="var(--t-textGhost)" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <MemberSearchInput
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search members…"
          />
          {search && (
            <MemberSearchClear onClick={() => { setSearch(""); setPage(0); }}>✕</MemberSearchClear>
          )}
        </MemberSearch>
      </div>

      <MemberCountRow>
        <MemberCount>{filtered.length} member{filtered.length !== 1 ? "s" : ""}</MemberCount>
        <PageSizeRow>
          <PageSizeLabel>Show:</PageSizeLabel>
          {PAGE_SIZES.map((n) => (
            <PageSizeBtn key={n} $active={pageSize === n && !showCustom} onClick={() => setSize(n)}>
              {n}
            </PageSizeBtn>
          ))}
          <PageSizeBtn $active={showCustom} onClick={() => setShowCustom((p) => !p)}>
            Custom
          </PageSizeBtn>
          {showCustom && (
            <CustomSizeInput
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const n = parseInt(customSize, 10);
                  if (n > 0) setSize(n);
                }
              }}
              placeholder="n"
              autoFocus
            />
          )}
        </PageSizeRow>
      </MemberCountRow>

      <MemberList>
        {paged.length === 0 ? (
          <MemberEmpty>No members found</MemberEmpty>
        ) : (
          paged.map((p) => {
            const pres = presence.find((pr) => pr.sysUser === p.username);
            const online = pres?.online ?? false;
            const isMe = p.username === currentUser;
            return (
              <MemberCard key={p.username} onClick={() => !isMe && onSelectUser(p)} $disabled={isMe} style={{ position: "relative" }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <UserAvatar profile={p} size={32} />
                  <PresenceDot $online={online} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <MemberName>{p.displayName}</MemberName>
                  <MemberStatus $online={online}>
                    {online ? "● Online" : "○ Offline"}
                  </MemberStatus>
                </div>
                {!isMe && (
                  <>
                    <MemberMenuBtn
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === p.username ? null : p.username); }}
                      title="More options"
                    >⋮</MemberMenuBtn>
                    {menuOpen === p.username && (
                      <MemberMenuDrop onClick={(e) => e.stopPropagation()}>
                        <MemberMenuItem onClick={() => { onSelectUser(p); setMenuOpen(null); }}>
                          💬 Send DM
                        </MemberMenuItem>
                        {onWhatsApp && (
                          <MemberMenuItem onClick={() => { onWhatsApp(p); setMenuOpen(null); }}>
                            🟢 Continue in WhatsApp
                          </MemberMenuItem>
                        )}
                      </MemberMenuDrop>
                    )}
                  </>
                )}
              </MemberCard>
            );
          })
        )}
      </MemberList>

      {totalPages > 1 && (
        <PagerRow>
          <PagerBtn onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>‹</PagerBtn>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
            <PagerBtn key={i} $active={safePage === i} onClick={() => setPage(i)}>
              {i + 1}
            </PagerBtn>
          ))}
          <PagerBtn onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage === totalPages - 1}>›</PagerBtn>
        </PagerRow>
      )}
    </div>
  );
}

// ── Main ChatDrawer ───────────────────────────────────────────────────────────

export default function ChatDrawer() {
  const [open, setOpen]           = useState(false);
  const [width, setWidth]         = useState(DEFAULT_W);
  const [tabY, setTabY]           = useState<number>(480);
  const [mode, setMode]           = useState<DrawerMode>({ view: "chat" });

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
    const savedW = sessionStorage.getItem("chat-drawer-width");
    if (savedW) setWidth(parseInt(savedW, 10));
    const savedLastSeen = localStorage.getItem("tgv_chat_last_seen_id");
    if (savedLastSeen) lastSeenId.current = savedLastSeen;
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
    if (mode.view !== "dm") return;
    const peer = (mode as { view: "dm"; peer: Profile }).peer;
    loadDmMessages(peer.username);
    const id = setInterval(() => loadDmMessages(peer.username), 10_000);
    return () => clearInterval(id);
  }, [mode, loadDmMessages]);

  useEffect(() => {
    if (mode.view === "dm") {
      dmBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [dmMessages, mode]);

  useEffect(() => {
    if (!open || (mode.view !== "chat" && mode.view !== "dm")) return;
    const context = mode.view === "dm"
      ? `dm:${(mode as { view: "dm"; peer: Profile }).peer.username}`
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
  }, [open, mode]);

  const signalTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    const context = mode.view === "dm"
      ? `dm:${(mode as { view: "dm"; peer: Profile }).peer.username}`
      : "chat";
    fetch("/api/chat/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context }),
    }).catch(() => {});
  }, [mode]);

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
      const newW = Math.min(MAX_W, Math.max(MIN_W, startW.current + delta));
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
  }, [width]);

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
    if (!dmInput.trim() || dmSending || mode.view !== "dm") return;
    const peer = (mode as { view: "dm"; peer: Profile }).peer;
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
    if (mode.view !== "dm") return;
    const peer = (mode as { view: "dm"; peer: Profile }).peer;
    await fetch(`/api/chat/dm?id=${id}&with=${peer.username}`, { method: "DELETE" });
    await loadDmMessages(peer.username);
  };

  const editDm = async (id: string, content: string) => {
    if (mode.view !== "dm") return;
    const peer = (mode as { view: "dm"; peer: Profile }).peer;
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

  const peer = mode.view === "dm" ? (mode as { view: "dm"; peer: Profile }).peer : null;

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
          {mode.view !== "chat" && (
            <BackBtn onClick={() => setMode(mode.view === "dm" ? { view: "members" } : { view: "chat" })}>
              ‹
            </BackBtn>
          )}

          <TitleWrap>
            {mode.view === "chat" && (
              <>
                <span style={{ fontSize: "0.875rem" }}>💬</span>
                <TitleText>TGV Chat</TitleText>
              </>
            )}
            {mode.view === "members" && (
              <TitleText $color={VIOLET}>Members</TitleText>
            )}
            {mode.view === "dm" && peer && (
              <>
                <UserAvatar profile={peer} size={20} />
                <TitleText $color={peer.accentColor} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {peer.displayName}
                </TitleText>
                <DmTag>DM</DmTag>
              </>
            )}
          </TitleWrap>

          {mode.view === "chat" && (
            <AvatarChips>
              {profiles.map((p) => (
                <span key={p.username} title={p.displayName} style={{ flexShrink: 0 }}>
                  <UserAvatar profile={p} size={20} />
                </span>
              ))}
            </AvatarChips>
          )}

          {mode.view === "chat" && (
            <ControlBtn onClick={() => setMode({ view: "members" })} title="Members">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="5" r="2.5"/>
                <circle cx="11" cy="5" r="2.5"/>
                <path d="M0 14c0-2.5 2.2-4 5-4s5 1.5 5 4"/>
                <path d="M11 10c2.2.5 4 1.8 4 4" strokeLinecap="round"/>
              </svg>
            </ControlBtn>
          )}

          {mode.view === "chat" && (
            <ControlBtn onClick={clearChat} title="Clear all messages">
              <svg viewBox="0 0 14 14" fill="currentColor">
                <path d="M2 4h10M5 4V2.5A.5.5 0 0 1 5.5 2h3a.5.5 0 0 1 .5.5V4M3 4l.7 7.5A1 1 0 0 0 4.7 12.5h4.6a1 1 0 0 0 1-.9L11 4H3z"/>
              </svg>
            </ControlBtn>
          )}

          {mode.view === "chat" && (
            <ControlBtn onClick={() => setShowSettingsModal(true)} title="Settings">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 10.5A2.5 2.5 0 1 1 8 5.5a2.5 2.5 0 0 1 0 5zm5.29-2.77a5.07 5.07 0 0 0 .04-.73 5 5 0 0 0-.04-.73l1.57-1.23a.38.38 0 0 0 .09-.48l-1.49-2.57a.37.37 0 0 0-.45-.16l-1.85.74a5.4 5.4 0 0 0-1.26-.73L9.67.37A.36.36 0 0 0 9.31 0H6.69a.36.36 0 0 0-.36.37l-.27 1.97a5.4 5.4 0 0 0-1.26.73l-1.85-.74a.37.37 0 0 0-.45.16L1.05 4.86a.37.37 0 0 0 .09.48l1.57 1.23c-.03.24-.04.48-.04.73s.01.49.04.73L1.14 9.26a.37.37 0 0 0-.09.48l1.49 2.57c.09.16.28.22.45.16l1.85-.74c.39.28.82.52 1.26.73l.27 1.97c.05.2.24.37.45.37H9.3c.21 0 .4-.17.45-.37l.27-1.97a5.4 5.4 0 0 0 1.26-.73l1.85.74c.17.06.36 0 .45-.16l1.49-2.57a.37.37 0 0 0-.09-.48l-1.69-1.27z"/>
              </svg>
            </ControlBtn>
          )}

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

        {/* ── Members panel ────────────────────────────────────────── */}
        {mode.view === "members" && (
          <MembersPanel
            profiles={profiles}
            presence={presence}
            currentUser={currentUser}
            onSelectUser={(p) => { setMode({ view: "dm", peer: p }); setDmMessages([]); }}
            onWhatsApp={(p) => {
              const text = `Continuing my conversation with ${p.displayName} from TGV Office`;
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
            }}
          />
        )}

        {/* ── Chat messages ────────────────────────────────────────── */}
        {mode.view === "chat" && (
          <MsgScroll>
            {messages.length === 0 ? (
              <EmptyChat>
                <EmptyIcon>💬</EmptyIcon>
                <EmptyText>No messages yet. Say hi!</EmptyText>
              </EmptyChat>
            ) : (
              messages.map((msg) => {
                const profile = profiles.find((p) => p.username === msg.from);
                return (
                  <MessageBubble
                    key={msg.id}
                    id={msg.id} from={msg.from} content={msg.content}
                    fileUrl={msg.fileUrl} fileName={msg.fileName} fileSize={msg.fileSize} fileMime={msg.fileMime}
                    createdAt={msg.createdAt} editedAt={msg.editedAt}
                    profile={profile} isMe={msg.from === currentUser}
                    settings={settings} canDelete={msg.from === currentUser || isAdmin}
                    onDelete={() => deleteMessage(msg.id)}
                    onEdit={(content) => editMessage(msg.id, content)}
                  />
                );
              })
            )}
            <div ref={bottomRef} />
          </MsgScroll>
        )}

        {/* ── DM thread ────────────────────────────────────────────── */}
        {mode.view === "dm" && peer && (
          <MsgScroll>
            {dmMessages.length === 0 ? (
              <EmptyChat>
                <UserAvatar profile={peer} size={40} />
                <EmptyText style={{ marginTop: "0.25rem" }}>Start a conversation with {peer.displayName}</EmptyText>
              </EmptyChat>
            ) : (
              dmMessages.map((msg) => {
                const profile = profiles.find((p) => p.username === msg.from);
                return (
                  <MessageBubble
                    key={msg.id}
                    id={msg.id} from={msg.from} content={msg.content}
                    createdAt={msg.createdAt} editedAt={msg.editedAt}
                    profile={profile} isMe={msg.from === currentUser}
                    settings={settings} canDelete={msg.from === currentUser}
                    onDelete={() => deleteDm(msg.id)}
                    onEdit={(content) => editDm(msg.id, content)}
                  />
                );
              })
            )}
            <div ref={dmBottomRef} />
          </MsgScroll>
        )}

        {/* ── Input (chat + DM) ────────────────────────────────────── */}
        {(mode.view === "chat" || mode.view === "dm") && (
          <InputArea>
            {mode.view === "chat" && uploadFile && (
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
                    <ThumbRemove onClick={() => setUploadFile(null)}>✕</ThumbRemove>
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
                  <FilePreviewClose onClick={() => setUploadFile(null)}>✕</FilePreviewClose>
                </FilePreview>
              )
            )}

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
              {mode.view === "chat" && (
                <>
                  <AttachBtn onClick={() => fileRef.current?.click()} title="Attach file">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                  </AttachBtn>
                  <ConvertBtn onClick={() => setConverterType("image")} title="Convert media">
                    ✦
                  </ConvertBtn>
                  <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileChange} />
                </>
              )}

              <ChatTextarea
                value={mode.view === "dm" ? dmInput : input}
                onChange={(e) => {
                  if (mode.view === "dm") setDmInput(e.target.value);
                  else setInput(e.target.value);
                  if (e.target.value.trim()) signalTyping();
                }}
                onKeyDown={(e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    mode.view === "dm" ? sendDm() : sendMessage();
                  }
                }}
                placeholder={mode.view === "dm" && peer ? `Message ${peer.displayName}…` : "Enter to send · Shift+Enter for newline"}
                rows={1}
                $accent={mode.view === "dm" ? (peer?.accentColor ?? VIOLET) : undefined}
                style={{
                  fontSize: settings.fontSize === "xs" ? 11 : settings.fontSize === "sm" ? 13 : 15,
                }}
              />

              <SendBtn
                onClick={mode.view === "dm" ? sendDm : sendMessage}
                disabled={mode.view === "dm" ? (!dmInput.trim() || dmSending) : ((sending || uploading) || (!input.trim() && !uploadFile))}
                $color={mode.view === "dm" ? (peer?.accentColor ?? VIOLET) : undefined}
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
    </>
  );
}
