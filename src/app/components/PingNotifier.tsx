"use client";

/**
 * NotificationToaster
 *
 * Bottom-left carousel of notifications.
 * - Chat  -> neon pink  (#ff4ecb)
 * - Memo  -> neon violet (#a259ff)
 * - Ping  -> neon violet (#a259ff)
 *
 * Queue behaviour:
 *   - Up to 3 cards fanned left->right, never overlapping
 *   - New cards stagger in 1 s apart
 *   - Front card (leftmost) auto-dismisses after 2 s when page is active
 *   - As front dismisses, next slides left (carousel)
 *   - OS-level notification fires when page is hidden
 *
 * Memo click -> MemoGallery modal with pagination
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import { colors, rgb } from "../theme";

// ── colours ──────────────────────────────────────────────────────────────────
const COLOR_CHAT = colors.pink;
const COLOR_MEMO = "#a259ff";

// ── types ────────────────────────────────────────────────────────────────────
type NotifType = "chat" | "memo" | "ping";

type NotifItem = {
  id: string;
  type: NotifType;
  senderName: string;
  body: string;
  color: string;
  memoData?: MemoData;
};

type MemoData = {
  id: string;
  from: string;
  to: string;
  content: string;
  createdAt: string;
  senderName: string;
};

type Ping = {
  id: string;
  from: string;
  to: string;
  message: string;
  read: boolean;
  createdAt: string;
};

type ChatMsg = {
  id: string;
  from: string;
  content: string;
  createdAt: string;
};

type Memo = {
  id: string;
  from: string;
  to: string;
  content: string;
  createdAt: string;
};

type Profile = { username: string; displayName: string; accentColor: string };

// ── animations ───────────────────────────────────────────────────────────────
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

// ── styled components: MemoGallery ───────────────────────────────────────────

const GalleryBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);

  [data-theme="light"] & {
    background: rgba(0, 0, 0, 0.4);
  }
`;

const GalleryModal = styled.div`
  position: fixed;
  z-index: 301;
  display: flex;
  flex-direction: column;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(94vw, 480px);
  max-height: 80vh;
  background: rgba(8, 6, 20, 0.98);
  border: 1px solid ${COLOR_MEMO}44;
  border-radius: 20px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.85), 0 0 60px ${COLOR_MEMO}18;

  [data-theme="light"] & {
    background: var(--t-bg);
    border-color: ${COLOR_MEMO}66;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.15), 0 0 40px ${COLOR_MEMO}10;
  }
`;

const GalleryHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  flex-shrink: 0;
  border-bottom: 1px solid ${COLOR_MEMO}22;

  [data-theme="light"] & {
    border-bottom-color: var(--t-border);
  }
`;

const GalleryHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const GalleryHeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const GalleryTag = styled.span`
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${COLOR_MEMO};
`;

const GallerySender = styled.span`
  font-size: 10px;
  font-weight: 600;
  color: ${COLOR_MEMO};
`;

const PaginationDots = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const PaginationDot = styled.button<{ $active: boolean }>`
  border-radius: 9999px;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s;
  width: ${({ $active }) => ($active ? "18px" : "7px")};
  height: 7px;
  background: ${({ $active }) => ($active ? COLOR_MEMO : `${COLOR_MEMO}50`)};
  box-shadow: ${({ $active }) => ($active ? `0 0 8px ${COLOR_MEMO}` : "none")};
`;

const GalleryCloseBtn = styled.button`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  color: ${COLOR_MEMO};
  background: ${COLOR_MEMO}18;

  [data-theme="light"] & {
    background: ${COLOR_MEMO}10;
  }
`;

const GalleryBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
`;

const GalleryContent = styled.p`
  font-size: 14px;
  line-height: 1.625;
  white-space: pre-wrap;
  color: ${COLOR_MEMO};

  [data-theme="light"] & {
    color: var(--t-text);
  }
`;

const GalleryDate = styled.p`
  font-size: 10px;
  margin-top: 16px;
  font-weight: 600;
  color: ${COLOR_MEMO}90;
`;

const GalleryActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
`;

const GalleryActionBtn = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: ${COLOR_MEMO};
  background: ${COLOR_MEMO}18;
  border: 1px solid ${COLOR_MEMO}40;

  ${({ $danger }) =>
    $danger &&
    `
    &:hover {
      background: rgba(${rgb.red}, 0.2);
      border-color: rgba(${rgb.red}, 0.4);
      color: ${colors.red};
    }
  `}

  [data-theme="light"] & {
    background: ${COLOR_MEMO}08;
    border-color: ${COLOR_MEMO}30;
  }
`;

const GalleryFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  flex-shrink: 0;
  border-top: 1px solid ${COLOR_MEMO}30;

  [data-theme="light"] & {
    border-top-color: var(--t-border);
  }
`;

const GalleryNavBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: ${COLOR_MEMO};
  background: ${COLOR_MEMO}22;
  border: 1px solid ${COLOR_MEMO}44;

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }

  [data-theme="light"] & {
    background: ${COLOR_MEMO}0A;
    border-color: ${COLOR_MEMO}30;
  }
`;

const GalleryPageInfo = styled.span`
  font-size: 11px;
  font-weight: 700;
  color: ${COLOR_MEMO};
`;

// ── styled components: Toast cards ───────────────────────────────────────────

const ToastCard = styled.div<{ $color: string }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  border-radius: 16px;
  padding: 12px 16px;
  background: rgba(6, 5, 16, 0.97);
  border: 1px solid ${({ $color }) => $color}44;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.75),
    0 0 24px ${({ $color }) => $color}16;
  backdrop-filter: blur(14px);

  [data-theme="light"] & {
    background: var(--t-bg);
    border-color: ${({ $color }) => $color}66;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1),
      0 0 16px ${({ $color }) => $color}10;
  }
`;

const AccentBar = styled.div<{ $color: string }>`
  width: 2px;
  align-self: stretch;
  border-radius: 9999px;
  flex-shrink: 0;
  background: linear-gradient(
    to bottom,
    ${({ $color }) => $color},
    ${({ $color }) => $color}44
  );
`;

const ToastContent = styled.div<{ $clickable: boolean }>`
  flex: 1;
  min-width: 0;
  cursor: ${({ $clickable }) => ($clickable ? "pointer" : "default")};
`;

const ToastSender = styled.p<{ $color: string }>`
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
  color: ${({ $color }) => $color};
`;

const ToastBody = styled.p`
  font-size: 11px;
  line-height: 1.625;
  color: rgba(255, 255, 255, 0.65);

  [data-theme="light"] & {
    color: var(--t-textMuted);
  }
`;

const ToastMemoHint = styled.p<{ $color: string }>`
  font-size: 9px;
  margin-top: 6px;
  font-weight: 600;
  color: ${({ $color }) => $color}88;
`;

const DismissBtn = styled.button`
  color: rgba(255, 255, 255, 0.2);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
  margin-top: 2px;
  transition: color 0.15s;

  &:hover {
    color: rgba(255, 255, 255, 0.5);
  }

  [data-theme="light"] & {
    color: var(--t-textGhost);
    &:hover {
      color: var(--t-textMuted);
    }
  }
`;

// ── OS notification helper ───────────────────────────────────────────────────
function fireOsNotification(item: NotifItem) {
  if (typeof window === "undefined" || Notification.permission !== "granted") return;
  try {
    const n = new Notification(
      item.type === "chat" ? `\uD83D\uDCAC ${item.senderName}` : `\uD83D\uDCDD Memo from ${item.senderName}`,
      { body: item.body, icon: "/favicon.ico", tag: item.id, silent: false }
    );
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 8000);
  } catch { /* unsupported */ }
}

// ── MemoGallery modal ────────────────────────────────────────────────────────
function MemoGallery({
  memos,
  startIdx,
  onClose,
  onMemoRemoved,
}: {
  memos: MemoData[];
  startIdx: number;
  onClose: () => void;
  onMemoRemoved: (id: string) => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const [localMemos, setLocalMemos] = useState(memos);
  const memo = localMemos[idx];
  if (!memo) return null;

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => setIdx((i) => Math.min(localMemos.length - 1, i + 1));

  const removeCurrent = (newList: MemoData[]) => {
    setLocalMemos(newList);
    if (newList.length === 0) { onClose(); return; }
    setIdx((i) => Math.min(i, newList.length - 1));
  };

  const archiveMemo = async () => {
    await fetch("/api/users/memo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: memo.id, archive: true }),
    }).catch(() => {});
    onMemoRemoved(memo.id);
    removeCurrent(localMemos.filter((m) => m.id !== memo.id));
  };

  const deleteMemo = async () => {
    await fetch(`/api/users/memo?id=${memo.id}`, { method: "DELETE" }).catch(() => {});
    onMemoRemoved(memo.id);
    removeCurrent(localMemos.filter((m) => m.id !== memo.id));
  };

  return createPortal(
    <>
      <GalleryBackdrop onClick={onClose} />
      <GalleryModal>
        {/* Header */}
        <GalleryHeader>
          <GalleryHeaderLeft>
            <GalleryTag>
              \uD83D\uDCDD Memo
            </GalleryTag>
            <GallerySender>
              from {memo.senderName}
            </GallerySender>
          </GalleryHeaderLeft>
          <GalleryHeaderRight>
            {memos.length > 1 && (
              <PaginationDots>
                {memos.map((_, i) => (
                  <PaginationDot
                    key={i}
                    onClick={() => setIdx(i)}
                    $active={i === idx}
                  />
                ))}
              </PaginationDots>
            )}
            <GalleryCloseBtn onClick={onClose}>
              &#x2715;
            </GalleryCloseBtn>
          </GalleryHeaderRight>
        </GalleryHeader>

        {/* Body */}
        <GalleryBody>
          <GalleryContent>{memo.content}</GalleryContent>
          <GalleryDate>
            {new Date(memo.createdAt).toLocaleString(undefined, {
              month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </GalleryDate>
          <GalleryActions>
            <GalleryActionBtn onClick={archiveMemo}>
              &#x2B07; Archive
            </GalleryActionBtn>
            <GalleryActionBtn $danger onClick={deleteMemo}>
              &#x2715; Delete
            </GalleryActionBtn>
          </GalleryActions>
        </GalleryBody>

        {/* Pagination arrows */}
        {localMemos.length > 1 && (
          <GalleryFooter>
            <GalleryNavBtn onClick={prev} disabled={idx === 0}>
              &larr; Prev
            </GalleryNavBtn>
            <GalleryPageInfo>
              {idx + 1} / {localMemos.length}
            </GalleryPageInfo>
            <GalleryNavBtn onClick={next} disabled={idx === localMemos.length - 1}>
              Next &rarr;
            </GalleryNavBtn>
          </GalleryFooter>
        )}
      </GalleryModal>
    </>,
    document.body
  );
}

// ── constants ────────────────────────────────────────────────────────────────
const CARD_W = 264;
const CARD_GAP = 12;
const MAX_VISIBLE = 3;
const OPACITIES = [1, 0.6, 0.32];
const SCALES = [1, 0.93, 0.86];

// ── main component ───────────────────────────────────────────────────────────
export default function PingNotifier() {
  const [visible, setVisible] = useState<NotifItem[]>([]);
  const [gallery, setGallery] = useState<{ memos: MemoData[]; idx: number } | null>(null);

  const queueRef = useRef<NotifItem[]>([]);
  const seenIds = useRef<Set<string>>(new Set());
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChatIdRef = useRef<string | null>(null);
  const chatInitialized = useRef(false);
  const memoSeenRef = useRef<Set<string>>(new Set());
  const allMemosRef = useRef<MemoData[]>([]);

  // Load persisted seen memo IDs once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tgv_seen_memos");
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        memoSeenRef.current = new Set(ids);
      }
    } catch { /* ignore */ }
  }, []);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState("");

  const isActive = () => !document.hidden && document.visibilityState === "visible";

  // OS notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Load profiles + current user
  useEffect(() => {
    Promise.all([
      fetch("/api/users/profile").then((r) => r.json()).catch(() => ({ profiles: [] })),
      fetch("/api/users/me").then((r) => r.json()).catch(() => null),
    ]).then(([pd, meRes]) => {
      setProfiles(pd.profiles ?? []);
      setCurrentUser(meRes?.username ?? "admin");
    });
  }, []);

  // ── release one item from queue into visible ───────────────────────────────
  const scheduleRelease = useCallback(() => {
    if (releaseTimer.current !== null) return;
    releaseTimer.current = setTimeout(() => {
      releaseTimer.current = null;
      setVisible((prev) => {
        if (prev.length >= MAX_VISIBLE || queueRef.current.length === 0) return prev;
        const next = queueRef.current.shift()!;
        const updated = [...prev, next];
        if (queueRef.current.length > 0 && updated.length < MAX_VISIBLE) {
          scheduleRelease();
        }
        return updated;
      });
    }, 1000);
  }, []);

  // ── enqueue new notifications ──────────────────────────────────────────────
  const enqueue = useCallback((items: NotifItem[]) => {
    if (items.length === 0) return;

    if (!isActive()) {
      items.forEach(fireOsNotification);
    }

    setVisible((prev) => {
      const slots = MAX_VISIBLE - prev.length;
      const immediate = items.slice(0, slots);
      const deferred = items.slice(slots);
      queueRef.current = [...queueRef.current, ...deferred];
      if (deferred.length > 0) scheduleRelease();
      return [...prev, ...immediate];
    });
  }, [scheduleRelease]);

  // ── dismiss front card ─────────────────────────────────────────────────────
  const dismissFront = useCallback(() => {
    setVisible((prev) => {
      if (prev.length === 0) return prev;
      const [, ...rest] = prev;
      if (queueRef.current.length > 0 && rest.length < MAX_VISIBLE) {
        scheduleRelease();
      }
      return rest;
    });
  }, [scheduleRelease]);

  // ── auto-dismiss front card after 2 s (page active) ───────────────────────
  const frontId = visible[0]?.id;
  useEffect(() => {
    if (!frontId) return;
    if (!isActive()) return;
    const t = setTimeout(dismissFront, 2000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frontId]);

  // Flush on tab focus
  useEffect(() => {
    const onActive = () => {
      if (isActive() && visible.length > 0) {
        // restart dismiss timer -- handled by frontId effect re-running on focus
      }
    };
    document.addEventListener("visibilitychange", onActive);
    window.addEventListener("focus", onActive);
    return () => {
      document.removeEventListener("visibilitychange", onActive);
      window.removeEventListener("focus", onActive);
    };
  }, [visible.length]);

  // ── poll pings ─────────────────────────────────────────────────────────────
  const checkPings = useCallback(async () => {
    try {
      const d = await fetch("/api/users/ping").then((r) => r.json());
      const fresh: Ping[] = (d.pings ?? []).filter(
        (p: Ping) => !p.read && !seenIds.current.has(p.id)
      );
      if (!fresh.length) return;
      fresh.forEach((p) => seenIds.current.add(p.id));
      const items: NotifItem[] = fresh.map((p) => {
        const s = profiles.find((pr) => pr.username === p.from);
        return {
          id: p.id,
          type: "ping",
          senderName: s?.displayName ?? p.from,
          body: p.message,
          color: COLOR_MEMO,
        };
      });
      enqueue(items);
    } catch { /* ignore */ }
  }, [profiles, enqueue]);

  // ── poll chat ──────────────────────────────────────────────────────────────
  const checkChat = useCallback(async () => {
    try {
      const d = await fetch("/api/chat?limit=20").then((r) => r.json());
      const msgs: ChatMsg[] = d.messages ?? [];
      if (!msgs.length) return;

      if (!chatInitialized.current) {
        lastChatIdRef.current = msgs[msgs.length - 1]?.id ?? null;
        chatInitialized.current = true;
        return;
      }

      const lastIdx = msgs.findIndex((m) => m.id === lastChatIdRef.current);
      const fresh = lastIdx === -1 ? [] : msgs.slice(lastIdx + 1);
      const fromOthers = fresh.filter(
        (m) => m.from !== currentUser && !seenIds.current.has(m.id)
      );
      if (!fromOthers.length) {
        if (fresh.length) lastChatIdRef.current = fresh[fresh.length - 1].id;
        return;
      }
      fromOthers.forEach((m) => seenIds.current.add(m.id));
      lastChatIdRef.current = fresh[fresh.length - 1].id;

      const items: NotifItem[] = fromOthers.map((m) => {
        const s = profiles.find((pr) => pr.username === m.from);
        return {
          id: m.id,
          type: "chat",
          senderName: s?.displayName ?? m.from,
          body: m.content || "(file)",
          color: COLOR_CHAT,
        };
      });
      enqueue(items);
    } catch { /* ignore */ }
  }, [profiles, currentUser, enqueue]);

  // ── poll memos ─────────────────────────────────────────────────────────────
  const checkMemos = useCallback(async () => {
    try {
      const d = await fetch("/api/users/memo").then((r) => r.json());
      const memos: Memo[] = d.memos ?? [];
      const fresh = memos.filter(
        (m) => m.from !== currentUser && !memoSeenRef.current.has(m.id)
      );
      if (!fresh.length) return;
      fresh.forEach((m) => memoSeenRef.current.add(m.id));
      try {
        localStorage.setItem("tgv_seen_memos", JSON.stringify([...memoSeenRef.current]));
      } catch { /* ignore */ }

      const items: NotifItem[] = fresh.map((m) => {
        const s = profiles.find((pr) => pr.username === m.from);
        const senderName = s?.displayName ?? m.from;
        const memoData: MemoData = { ...m, senderName };
        allMemosRef.current = [memoData, ...allMemosRef.current];
        return {
          id: m.id,
          type: "memo",
          senderName,
          body: m.content.length > 80 ? m.content.slice(0, 80) + "…" : m.content,
          color: COLOR_MEMO,
          memoData,
        };
      });
      enqueue(items);
    } catch { /* ignore */ }
  }, [profiles, currentUser, enqueue]);

  useEffect(() => {
    if (!profiles.length || !currentUser) return;
    checkPings();
    checkChat();
    checkMemos();
    const i1 = setInterval(checkPings, 30_000);
    const i2 = setInterval(checkChat, 15_000);
    const i3 = setInterval(checkMemos, 20_000);
    return () => { clearInterval(i1); clearInterval(i2); clearInterval(i3); };
  }, [checkPings, checkChat, checkMemos, profiles, currentUser]);

  // ── open gallery ───────────────────────────────────────────────────────────
  const openGallery = (item: NotifItem) => {
    if (item.type !== "memo" || !allMemosRef.current.length) return;
    const idx = allMemosRef.current.findIndex(
      (m) => m.id === item.memoData?.id
    );
    setGallery({ memos: allMemosRef.current, idx: Math.max(0, idx) });
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {visible.map((item, i) => {
        const color = item.color;
        const leftPx = 24 + i * (CARD_W + CARD_GAP);
        const opacity = OPACITIES[i] ?? 0;
        const scale = SCALES[i] ?? 0.8;
        const isMemo = item.type === "memo";

        return (
          <div
            key={item.id}
            style={{
              position: "fixed",
              bottom: 24,
              left: leftPx,
              width: CARD_W,
              opacity,
              transform: `scale(${scale})`,
              transformOrigin: "bottom left",
              transition: "left 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease, transform 0.35s ease",
              zIndex: 200 - i,
              pointerEvents: i === 0 ? "all" : "none",
            }}
          >
            <ToastCard $color={color}>
              <AccentBar $color={color} />
              <ToastContent
                $clickable={isMemo}
                onClick={isMemo ? () => openGallery(item) : undefined}
              >
                <ToastSender $color={color}>
                  {item.type === "chat" ? "\uD83D\uDCAC" : "\uD83D\uDCDD"} {item.senderName}
                </ToastSender>
                <ToastBody>{item.body}</ToastBody>
                {isMemo && (
                  <ToastMemoHint $color={color}>
                    tap to view memo &rarr;
                  </ToastMemoHint>
                )}
              </ToastContent>
              {i === 0 && (
                <DismissBtn onClick={dismissFront}>
                  &#x2715;
                </DismissBtn>
              )}
            </ToastCard>
          </div>
        );
      })}

      {/* Memo gallery modal */}
      {gallery && (
        <MemoGallery
          memos={gallery.memos}
          startIdx={gallery.idx}
          onClose={() => setGallery(null)}
          onMemoRemoved={(id) => {
            allMemosRef.current = allMemosRef.current.filter((m) => m.id !== id);
            setGallery((g) => g ? { ...g, memos: g.memos.filter((m) => m.id !== id) } : null);
          }}
        />
      )}
    </>
  );
}
