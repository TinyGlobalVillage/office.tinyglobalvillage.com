"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
import styled from "styled-components";
import ChatSettingsModal, {
  UserAvatar,
  type ChatSettings,
  type UserRole,
  type MemberProfile,
} from "./ChatSettingsModal";
import { colors, rgb } from "@/app/theme";
import { ModalBackdrop, CloseBtn } from "@/app/styled";
import NeonX from "./NeonX";
import { useModalLifecycle } from "@/app/lib/drawerKnobs";

export type Profile = {
  username: string;
  displayName: string;
  email: string;
  title: string;
  bio: string;
  accentColor: string;
  avatarUrl: string;
  role: UserRole;
};

const CHAT_SETTINGS_KEY = "tgv_chat_settings";
const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  showTimestamps: true,
  timestampFormat: "time",
  timezone: "auto",
  fontSize: "sm",
  myFont: "sans",
  whisperModel: "base.en",
};

export type Memo = {
  id: string;
  from: string;
  to: string;
  content: string;
  createdAt: string;
  editedAt?: string;
};

export type Ping = {
  id: string;
  from: string;
  to: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── Styled ────────────────────────────────────────────────────── */

const Backdrop = styled(ModalBackdrop)<{ $hidden?: boolean }>`
  z-index: 70;
  padding: 0;
  visibility: ${(p) => (p.$hidden ? "hidden" : "visible")};
`;

const Card = styled.div<{ $accent: string; $hidden?: boolean }>`
  position: fixed;
  z-index: 71;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(96vw, 520px);
  max-height: 85vh;
  background: var(--t-surface);
  border: 1px solid ${(p) => p.$accent}33;
  border-radius: 20px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.8), 0 0 40px ${(p) => p.$accent}18;
  visibility: ${(p) => (p.$hidden ? "hidden" : "visible")};

  [data-theme="light"] & {
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.12), 0 0 40px ${(p) => p.$accent}08;
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
  gap: 1rem;
  padding: 1rem 1.25rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--t-border);
`;

const NameBlock = styled.div`
  flex: 1;
  min-width: 0;
`;

const Name = styled.h3<{ $accent?: string }>`
  font-size: 1rem;
  font-weight: 700;
  color: ${(p) => p.$accent ?? "var(--t-text)"};
  margin: 0;
`;

const Email = styled.p<{ $accent?: string }>`
  font-size: 0.75rem;
  color: ${(p) => (p.$accent ? `${p.$accent}cc` : "var(--t-textFaint)")};
  margin: 0;
`;

const AvatarWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const AvatarOverlay = styled.button`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  opacity: 0;
  transition: opacity 0.15s;
  border: none;
  cursor: pointer;

  ${AvatarWrap}:hover & {
    opacity: 1;
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
`;

const SettingsBtn = styled.button<{ $accent: string }>`
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.5rem;
  border: none;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(p) => p.$accent};
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--t-inputBg);
  }
`;

const PingBtn = styled.button<{ $accent: string; $open?: boolean }>`
  width: 2.125rem;
  height: 2.125rem;
  border-radius: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  cursor: pointer;
  background: rgba(${(p) => hexToRgb(p.$accent)}, ${(p) => (p.$open ? 0.28 : 0.14)});
  border: 1px solid rgba(${(p) => hexToRgb(p.$accent)}, ${(p) => (p.$open ? 0.6 : 0.45)});
  color: ${(p) => p.$accent};
  filter: drop-shadow(0 0 6px rgba(${(p) => hexToRgb(p.$accent)}, 0.65));

  &:hover {
    background: rgba(${(p) => hexToRgb(p.$accent)}, 0.28);
    box-shadow: 0 0 10px rgba(${(p) => hexToRgb(p.$accent)}, 0.5);
  }

  [data-theme="light"] & { filter: none; }

  svg { width: 16px; height: 16px; }

  @media (max-width: 768px) {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 0.625rem;
    svg { width: 20px; height: 20px; }
  }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  scrollbar-width: thin;
`;

const SectionLabel = styled.p<{ $accent?: string }>`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${(p) => (p.$accent ? `${p.$accent}aa` : "var(--t-textGhost)")};
  margin: 0 0 0.375rem;
`;

const BioText = styled.p<{ $accent?: string }>`
  font-size: 0.75rem;
  color: ${(p) => (p.$accent ? `${p.$accent}dd` : "var(--t-textMuted)")};
  line-height: 1.625;
  margin: 0;
`;

const PingBox = styled.div<{ $accent: string }>`
  border-radius: 0.75rem;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: rgba(${(p) => hexToRgb(p.$accent)}, 0.07);
  border: 1px solid ${(p) => p.$accent}33;
`;

const PingBoxLabel = styled.p<{ $accent: string }>`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${(p) => p.$accent};
  margin: 0;
`;

const PingInput = styled.input<{ $accent: string }>`
  flex: 1;
  background: transparent;
  outline: none;
  font-size: 0.75rem;
  color: var(--t-text);
  border: none;
  border-bottom: 1px solid ${(p) => p.$accent}44;
  padding-bottom: 2px;
`;

const SmallBtn = styled.button<{ $accent: string }>`
  font-size: 0.625rem;
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
  transition: all 0.15s;
  cursor: pointer;
  background: rgba(${(p) => hexToRgb(p.$accent)}, 0.2);
  border: 1px solid ${(p) => p.$accent}55;
  color: ${(p) => p.$accent};

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const PingCard = styled.div<{ $accent: string }>`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  border-radius: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(${(p) => hexToRgb(p.$accent)}, 0.08);
  border: 1px solid ${(p) => p.$accent}22;
`;

const PingSender = styled.p<{ $accent: string }>`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${(p) => p.$accent};
  margin: 0 0 0.125rem;
`;

const PingText = styled.span`
  font-size: 0.625rem;
  color: var(--t-textMuted);
`;

const PingTime = styled.span`
  font-size: 0.5625rem;
  color: var(--t-textGhost);
  flex-shrink: 0;
`;

const PingCheck = styled.button<{ $accent: string }>`
  font-size: 0.5625rem;
  flex-shrink: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: ${(p) => p.$accent};
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.7;
  }
`;

const MemoInput = styled.input<{ $accent?: string }>`
  flex: 1;
  background: transparent;
  outline: none;
  font-size: 0.75rem;
  color: ${(p) => p.$accent ?? "var(--t-textMuted)"};
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid ${(p) => (p.$accent ? `${p.$accent}55` : "var(--t-borderStrong)")};

  &::placeholder {
    color: ${(p) => (p.$accent ? `${p.$accent}77` : "var(--t-textGhost)")};
  }
`;

const MemoAddBtn = styled.button<{ $accent?: string }>`
  font-size: 0.625rem;
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
  transition: all 0.15s;
  cursor: pointer;
  background: ${(p) => (p.$accent ? `rgba(${hexToRgb(p.$accent)}, 0.18)` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$accent ? `${p.$accent}66` : "var(--t-borderStrong)")};
  color: ${(p) => p.$accent ?? "var(--t-textMuted)"};

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const MemoCard = styled.div<{ $accent?: string }>`
  border-radius: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: ${(p) => (p.$accent ? `rgba(${hexToRgb(p.$accent)}, 0.08)` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$accent ? `${p.$accent}33` : "var(--t-border)")};
`;

const MemoContent = styled.p<{ $accent?: string }>`
  font-size: 0.6875rem;
  color: ${(p) => p.$accent ?? "var(--t-text)"};
  opacity: ${(p) => (p.$accent ? 0.95 : 0.75)};
  line-height: 1.625;
  margin: 0;
`;

const MemoMeta = styled.p<{ $accent?: string }>`
  font-size: 0.5625rem;
  color: ${(p) => (p.$accent ? `${p.$accent}99` : "var(--t-textGhost)")};
  margin: 0.125rem 0 0;
`;

const MemoActions = styled.div`
  display: flex;
  gap: 0.5rem;
  opacity: 0.55;
  flex-shrink: 0;
  transition: opacity 0.15s;

  ${MemoCard}:hover & {
    opacity: 1;
  }
`;

const MemoActionBtn = styled.button<{ $accent?: string }>`
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
  transition: all 0.15s;
  cursor: pointer;
  color: ${(p) => (p.$accent ? p.$accent : "var(--t-textMuted)")};
  background: ${(p) => (p.$accent ? `rgba(${hexToRgb(p.$accent)}, 0.14)` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$accent ? `${p.$accent}55` : "var(--t-border)")};

  &:hover {
    background: ${(p) => (p.$accent ? `rgba(${hexToRgb(p.$accent)}, 0.24)` : "var(--t-inputBg)")};
    border-color: ${(p) => (p.$accent ? `${p.$accent}88` : "var(--t-borderStrong)")};
    color: ${(p) => p.$accent ?? "var(--t-text)"};
    box-shadow: ${(p) => (p.$accent ? `0 0 8px ${p.$accent}55` : "none")};
  }
`;

const ArchiveBtn = styled.button<{ $accent?: string }>`
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
  transition: all 0.15s;
  cursor: pointer;
  color: ${(p) => p.$accent ?? colors.violet};
  background: ${(p) =>
    p.$accent
      ? `rgba(${hexToRgb(p.$accent)}, 0.14)`
      : `rgba(${rgb.violet}, 0.15)`};
  border: 1px solid ${(p) => (p.$accent ? `${p.$accent}55` : `rgba(${rgb.violet}, 0.35)`)};

  &:hover {
    background: ${(p) =>
      p.$accent
        ? `rgba(${hexToRgb(p.$accent)}, 0.24)`
        : `rgba(${rgb.violet}, 0.25)`};
    border-color: ${(p) => (p.$accent ? `${p.$accent}88` : `rgba(${rgb.violet}, 0.5)`)};
    box-shadow: ${(p) =>
      p.$accent
        ? `0 0 8px ${p.$accent}55`
        : `0 0 8px rgba(${rgb.violet}, 0.35)`};
  }
`;

const DeleteBtn = styled(ArchiveBtn)`
  &:hover {
    background: rgba(${rgb.red}, 0.22);
    border-color: rgba(${rgb.red}, 0.55);
    color: ${colors.red};
    box-shadow: 0 0 10px rgba(${rgb.red}, 0.45);
  }
`;

const MemoEditInput = styled.input<{ $accent?: string }>`
  flex: 1;
  background: transparent;
  outline: none;
  font-size: 0.75rem;
  color: ${(p) => p.$accent ?? "var(--t-text)"};
  border: none;
`;

const MarkAllBtn = styled.button<{ $accent?: string }>`
  font-size: 0.5625rem;
  color: ${(p) => (p.$accent ? `${p.$accent}cc` : "var(--t-textFaint)")};
  border: none;
  background: none;
  cursor: pointer;

  &:hover {
    color: ${(p) => p.$accent ?? "var(--t-textMuted)"};
  }
`;

const MemoPager = styled.div<{ $accent?: string }>`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.375rem;
  margin-top: 0.625rem;
`;

const MemoPagerBtn = styled.button<{ $accent?: string }>`
  height: 1.75rem;
  min-width: 1.75rem;
  padding: 0 0.5rem;
  border-radius: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6875rem;
  font-weight: 700;
  cursor: pointer;
  background: ${(p) => (p.$accent ? `rgba(${hexToRgb(p.$accent)}, 0.14)` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$accent ? `${p.$accent}55` : "var(--t-border)")};
  color: ${(p) => p.$accent ?? "var(--t-textMuted)"};
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: ${(p) => (p.$accent ? `rgba(${hexToRgb(p.$accent)}, 0.26)` : "var(--t-inputBg)")};
    border-color: ${(p) => (p.$accent ? `${p.$accent}88` : "var(--t-borderStrong)")};
    box-shadow: ${(p) => (p.$accent ? `0 0 8px ${p.$accent}55` : "none")};
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
`;

const MemoPagerInfo = styled.span<{ $accent?: string }>`
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: ${(p) => (p.$accent ? `${p.$accent}cc` : "var(--t-textMuted)")};
`;

const MemoDropWrap = styled.div`
  position: relative;
`;

const MemoDropTrigger = styled.button<{ $accent?: string; $active?: boolean }>`
  height: 1.75rem;
  padding: 0 0.625rem;
  border-radius: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  background: ${(p) =>
    p.$accent
      ? `rgba(${hexToRgb(p.$accent)}, ${p.$active ? 0.28 : 0.14})`
      : "var(--t-inputBg)"};
  border: 1px solid ${(p) =>
    p.$accent ? `${p.$accent}${p.$active ? "99" : "55"}` : "var(--t-border)"};
  color: ${(p) => p.$accent ?? "var(--t-textMuted)"};
  transition: all 0.15s;

  &:hover {
    background: ${(p) => (p.$accent ? `rgba(${hexToRgb(p.$accent)}, 0.28)` : "var(--t-inputBg)")};
    box-shadow: ${(p) => (p.$accent ? `0 0 8px ${p.$accent}55` : "none")};
  }
`;

const MemoDropMenu = styled.div<{ $accent?: string }>`
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 0.25rem;
  min-width: 96px;
  border-radius: 0.75rem;
  overflow: hidden;
  z-index: 10;
  background: var(--t-surface);
  border: 1px solid ${(p) => (p.$accent ? `${p.$accent}55` : "var(--t-borderStrong)")};
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);

  [data-theme="light"] & {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  }
`;

const MemoDropItem = styled.button<{ $accent?: string; $active?: boolean }>`
  width: 100%;
  text-align: left;
  padding: 0.5rem 1rem;
  font-size: 0.6875rem;
  border: none;
  cursor: pointer;
  color: ${(p) => (p.$active && p.$accent ? p.$accent : "var(--t-textMuted)")};
  background: transparent;
  transition: background 0.1s;

  &:hover {
    background: ${(p) => (p.$accent ? `rgba(${hexToRgb(p.$accent)}, 0.12)` : "var(--t-inputBg)")};
  }
`;

const MemoCustomInput = styled.input<{ $accent?: string }>`
  width: 3.5rem;
  height: 1.75rem;
  text-align: center;
  font-size: 0.6875rem;
  padding: 0 0.5rem;
  border-radius: 0.5rem;
  outline: none;
  background: ${(p) => (p.$accent ? `rgba(${hexToRgb(p.$accent)}, 0.08)` : "var(--t-inputBg)")};
  color: ${(p) => p.$accent ?? "var(--t-text)"};
  border: 1px solid ${(p) => (p.$accent ? `${p.$accent}55` : "var(--t-border)")};
`;

/* ── Component ─────────────────────────────────────────────────── */

export default function ProfileModal({
  profile,
  profiles,
  memos,
  pings,
  currentUser,
  onClose,
  onRefresh,
}: {
  profile: Profile;
  profiles: Profile[];
  memos: Memo[];
  pings: Ping[];
  currentUser: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  useModalLifecycle();
  const isOwn = profile.username === currentUser;
  const accent = profile.accentColor;
  const pa = accent;

  const [newMemo, setNewMemo] = useState("");
  const [sendingMemo, setSendingMemo] = useState(false);
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editMemoContent, setEditMemoContent] = useState("");
  const [memoPage, setMemoPage] = useState(0);
  const [memoPerPage, setMemoPerPage] = useState<number>(5);
  const [memoCustomPerPage, setMemoCustomPerPage] = useState("");
  const [memoShowCustom, setMemoShowCustom] = useState(false);
  const [memoDropOpen, setMemoDropOpen] = useState(false);
  const memoDropRef = useRef<HTMLDivElement>(null);
  const MEMO_PAGE_OPTIONS = [5, 10, 25, 50];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (memoDropRef.current && !memoDropRef.current.contains(e.target as Node)) setMemoDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const [pingMsg, setPingMsg] = useState("");
  const [sendingPing, setSendingPing] = useState(false);
  const [showPingInput, setShowPingInput] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [storagePercent, setStoragePercent] = useState(0);

  const openSettingsModal = async () => {
    const res = await fetch("/api/chat?limit=1")
      .then((r) => r.json())
      .catch(() => ({}));
    setStoragePercent(res.storagePercent ?? 0);
    setShowSettingsModal(true);
  };

  const clearChat = async () => {
    if (!confirm("Clear all chat messages and files? This cannot be undone.")) return;
    await fetch("/api/chat/clear", { method: "POST" });
    const res = await fetch("/api/chat?limit=1")
      .then((r) => r.json())
      .catch(() => ({}));
    setStoragePercent(res.storagePercent ?? 0);
  };

  const [chatSettings, setChatSettings] = useState<ChatSettings>(DEFAULT_CHAT_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_SETTINGS_KEY);
      if (raw) setChatSettings({ ...DEFAULT_CHAT_SETTINGS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const saveChatSettings = (patch: Partial<ChatSettings>) => {
    setChatSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(CHAT_SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/users/avatar", { method: "POST", body: fd });
      if (res.ok) onRefresh();
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const relevantPings = isOwn
    ? pings.filter((p) => p.to === currentUser && !p.read)
    : pings.filter((p) => p.from === profile.username && p.to === currentUser && !p.read);

  const relevantMemos = memos.filter(
    (m) => m.from === profile.username || m.to === profile.username
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (showSettingsModal) {
          setShowSettingsModal(false);
          return;
        }
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose, showSettingsModal]);

  const sendMemo = async () => {
    if (!newMemo.trim()) return;
    setSendingMemo(true);
    await fetch("/api/users/memo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: profile.username, content: newMemo.trim() }),
    });
    setNewMemo("");
    setSendingMemo(false);
    onRefresh();
  };

  const saveMemoEdit = async (id: string) => {
    await fetch("/api/users/memo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, content: editMemoContent }),
    });
    setEditingMemoId(null);
    onRefresh();
  };

  const deleteMemo = async (id: string) => {
    await fetch(`/api/users/memo?id=${id}`, { method: "DELETE" });
    onRefresh();
  };

  const archiveMemo = async (id: string) => {
    await fetch("/api/users/memo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, archive: true }),
    });
    onRefresh();
  };

  const sendPing = async () => {
    if (!pingMsg.trim()) return;
    setSendingPing(true);
    await fetch("/api/users/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: profile.username, message: pingMsg.trim() }),
    });
    setPingMsg("");
    setShowPingInput(false);
    setSendingPing(false);
    onRefresh();
  };

  const markPingRead = async (id: string) => {
    await fetch("/api/users/ping", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    onRefresh();
  };

  const markAllPingsRead = async () => {
    await fetch("/api/users/ping", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    onRefresh();
  };

  return (
    <>
      {showSettingsModal && (
        <ChatSettingsModal
          settings={chatSettings}
          onSettingsChange={saveChatSettings}
          profiles={profiles as unknown as MemberProfile[]}
          currentUser={currentUser}
          storagePercent={storagePercent}
          onClearChat={clearChat}
          onClose={() => setShowSettingsModal(false)}
          onProfileRefresh={onRefresh}
        />
      )}

      <Backdrop $hidden={showSettingsModal} onClick={onClose} />
      <Card $accent={accent} $hidden={showSettingsModal}>
        <Header>
          <AvatarWrap>
            <UserAvatar profile={profile} size={44} />
            {isOwn && (
              <>
                <AvatarOverlay
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  title="Change avatar"
                >
                  {uploadingAvatar ? (
                    <span style={{ fontSize: "0.5625rem", color: "#fff" }}>…</span>
                  ) : (
                    <span style={{ color: "#fff", fontSize: "0.75rem" }}>📷</span>
                  )}
                </AvatarOverlay>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleAvatarChange}
                />
              </>
            )}
          </AvatarWrap>
          <NameBlock>
            <Name $accent={pa}>{profile.displayName}</Name>
            <Email $accent={pa}>{profile.email}</Email>
          </NameBlock>
          <HeaderActions>
            {isOwn && (
              <SettingsBtn $accent={accent} onClick={openSettingsModal} title="Edit profile & settings">
                <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 10.5A2.5 2.5 0 1 1 8 5.5a2.5 2.5 0 0 1 0 5zm5.29-2.77a5.07 5.07 0 0 0 .04-.73 5 5 0 0 0-.04-.73l1.57-1.23a.38.38 0 0 0 .09-.48l-1.49-2.57a.37.37 0 0 0-.45-.16l-1.85.74a5.4 5.4 0 0 0-1.26-.73L9.67.37A.36.36 0 0 0 9.31 0H6.69a.36.36 0 0 0-.36.37l-.27 1.97a5.4 5.4 0 0 0-1.26.73l-1.85-.74a.37.37 0 0 0-.45.16L1.05 4.86a.37.37 0 0 0 .09.48l1.57 1.23c-.03.24-.04.48-.04.73s.01.49.04.73L1.14 9.26a.37.37 0 0 0-.09.48l1.49 2.57c.09.16.28.22.45.16l1.85-.74c.39.28.82.52 1.26.73l.27 1.97c.05.2.24.37.45.37H9.3c.21 0 .4-.17.45-.37l.27-1.97a5.4 5.4 0 0 0 1.26-.73l1.85.74c.17.06.36 0 .45-.16l1.49-2.57a.37.37 0 0 0-.09-.48l-1.69-1.27z" />
                </svg>
              </SettingsBtn>
            )}
            {!isOwn && (
              <PingBtn
                $accent={accent}
                $open={showPingInput}
                onClick={() => setShowPingInput((p) => !p)}
                title="Ping"
                aria-label="Ping"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </PingBtn>
            )}
            <NeonX color={pa} onClick={onClose} title="Close" />
          </HeaderActions>
        </Header>

        <Body>
          {profile.bio && (
            <div>
              <SectionLabel $accent={pa}>Bio</SectionLabel>
              <BioText $accent={pa}>{profile.bio}</BioText>
            </div>
          )}

          {profile.title && (
            <div>
              <SectionLabel $accent={pa}>Role</SectionLabel>
              <BioText $accent={pa}>{profile.title}</BioText>
            </div>
          )}

          {showPingInput && !isOwn && (
            <PingBox $accent={accent}>
              <PingBoxLabel $accent={accent}>Send a ping to {profile.displayName}</PingBoxLabel>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <PingInput
                  $accent={accent}
                  value={pingMsg}
                  onChange={(e) => setPingMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendPing();
                  }}
                  placeholder="Quick message…"
                  autoFocus
                />
                <SmallBtn $accent={accent} onClick={sendPing} disabled={!pingMsg.trim() || sendingPing}>
                  {sendingPing ? "…" : "Send 🔔"}
                </SmallBtn>
              </div>
            </PingBox>
          )}

          {relevantPings.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <SectionLabel style={{ margin: 0 }}>
                  {isOwn ? "Unread Pings" : `Pings from ${profile.displayName}`}
                </SectionLabel>
                {isOwn && relevantPings.length > 1 && (
                  <MarkAllBtn $accent={pa} onClick={markAllPingsRead}>Mark all read</MarkAllBtn>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {relevantPings.map((p) => {
                  const senderProfile = profiles.find((pr) => pr.username === p.from);
                  const senderAccent = senderProfile?.accentColor ?? colors.pink;
                  return (
                    <PingCard key={p.id} $accent={senderAccent}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isOwn && (
                          <PingSender $accent={senderAccent}>
                            from {senderProfile?.displayName ?? p.from}
                          </PingSender>
                        )}
                        <PingText>{p.message}</PingText>
                      </div>
                      <PingTime>{timeAgo(p.createdAt)}</PingTime>
                      <PingCheck $accent={senderAccent} onClick={() => markPingRead(p.id)} title="Mark as read">
                        ✓
                      </PingCheck>
                    </PingCard>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <SectionLabel $accent={pa}>Memos</SectionLabel>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <MemoInput
                $accent={pa}
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMemo();
                  }
                }}
                placeholder={isOwn ? "Note to self…" : `Note for ${profile.displayName}…`}
              />
              <MemoAddBtn $accent={pa} onClick={sendMemo} disabled={!newMemo.trim() || sendingMemo}>
                Add
              </MemoAddBtn>
            </div>

            {relevantMemos.length === 0 ? (
              <p style={{ fontSize: "0.625rem", color: pa ? `${pa}99` : "var(--t-textGhost)" }}>No memos yet.</p>
            ) : (() => {
              const customN = parseInt(memoCustomPerPage);
              const effectivePerPage = memoShowCustom && customN > 0 ? customN : memoPerPage;
              const totalMemoPages = Math.max(1, Math.ceil(relevantMemos.length / effectivePerPage));
              const safePage = Math.min(memoPage, totalMemoPages - 1);
              const pagedMemos = relevantMemos.slice(
                safePage * effectivePerPage,
                safePage * effectivePerPage + effectivePerPage
              );
              return (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {pagedMemos.map((m) => {
                      const authorAccent = profiles.find((p) => p.username === m.from)?.accentColor ?? pa;
                      return (
                        <MemoCard key={m.id} $accent={authorAccent}>
                          {editingMemoId === m.id ? (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <MemoEditInput
                                $accent={authorAccent}
                                value={editMemoContent}
                                onChange={(e) => setEditMemoContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveMemoEdit(m.id);
                                  if (e.key === "Escape") setEditingMemoId(null);
                                }}
                                autoFocus
                              />
                              <MemoActionBtn $accent={authorAccent} onClick={() => saveMemoEdit(m.id)}>Save</MemoActionBtn>
                              <MemoActionBtn $accent={authorAccent} onClick={() => setEditingMemoId(null)}>✕</MemoActionBtn>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <MemoContent $accent={authorAccent}>{m.content}</MemoContent>
                                <MemoMeta $accent={authorAccent}>
                                  {profiles.find((p) => p.username === m.from)?.displayName ?? m.from} ·{" "}
                                  {timeAgo(m.createdAt)}
                                  {m.editedAt && " · edited"}
                                </MemoMeta>
                              </div>
                              <MemoActions>
                                {m.from === currentUser && (
                                  <MemoActionBtn
                                    $accent={authorAccent}
                                    onClick={() => {
                                      setEditingMemoId(m.id);
                                      setEditMemoContent(m.content);
                                    }}
                                    title="Edit"
                                  >
                                    ✎
                                  </MemoActionBtn>
                                )}
                                <ArchiveBtn $accent={authorAccent} onClick={() => archiveMemo(m.id)} title="Archive (hide from your view)">
                                  ⬇
                                </ArchiveBtn>
                                <DeleteBtn $accent={authorAccent} onClick={() => deleteMemo(m.id)} title="Delete permanently">
                                  ✕
                                </DeleteBtn>
                              </MemoActions>
                            </div>
                          )}
                        </MemoCard>
                      );
                    })}
                  </div>
                  {relevantMemos.length > MEMO_PAGE_OPTIONS[0] && (
                    <MemoPager $accent={pa}>
                      <MemoDropWrap ref={memoDropRef}>
                        <MemoDropTrigger
                          $accent={pa}
                          $active
                          onClick={() => setMemoDropOpen((p) => !p)}
                          title="Memos per page"
                          type="button"
                        >
                          <span>
                            {memoShowCustom && customN > 0 ? customN : effectivePerPage} / pg
                          </span>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                            <path d="M5 7L1 3h8L5 7z" />
                          </svg>
                        </MemoDropTrigger>
                        {memoDropOpen && (
                          <MemoDropMenu $accent={pa}>
                            {MEMO_PAGE_OPTIONS.map((n) => (
                              <MemoDropItem
                                key={n}
                                $accent={pa}
                                $active={effectivePerPage === n && !memoShowCustom}
                                onClick={() => {
                                  setMemoPerPage(n);
                                  setMemoShowCustom(false);
                                  setMemoPage(0);
                                  setMemoDropOpen(false);
                                }}
                                type="button"
                              >
                                {n}
                              </MemoDropItem>
                            ))}
                            <MemoDropItem
                              $accent={pa}
                              $active={memoShowCustom}
                              onClick={() => {
                                setMemoShowCustom(true);
                                setMemoDropOpen(false);
                              }}
                              style={{ borderTop: "1px solid var(--t-border)" }}
                              type="button"
                            >
                              Custom…
                            </MemoDropItem>
                          </MemoDropMenu>
                        )}
                      </MemoDropWrap>
                      {memoShowCustom && (
                        <MemoCustomInput
                          $accent={pa}
                          type="number"
                          value={memoCustomPerPage}
                          onChange={(e) => { setMemoCustomPerPage(e.target.value); setMemoPage(0); }}
                          placeholder="n"
                          autoFocus
                        />
                      )}
                      <MemoPagerBtn
                        $accent={pa}
                        onClick={() => setMemoPage((p) => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                        title="Previous page"
                        type="button"
                      >
                        ‹
                      </MemoPagerBtn>
                      <MemoPagerInfo $accent={pa}>
                        {safePage + 1} / {totalMemoPages}
                      </MemoPagerInfo>
                      <MemoPagerBtn
                        $accent={pa}
                        onClick={() => setMemoPage((p) => Math.min(totalMemoPages - 1, p + 1))}
                        disabled={safePage >= totalMemoPages - 1}
                        title="Next page"
                        type="button"
                      >
                        ›
                      </MemoPagerBtn>
                    </MemoPager>
                  )}
                </>
              );
            })()}
          </div>
        </Body>
      </Card>
    </>
  );
}
