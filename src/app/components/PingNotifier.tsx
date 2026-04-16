"use client";

/**
 * NotificationToaster
 *
 * Bottom-left carousel of notifications.
 * - Chat  → neon pink  (#ff4ecb)
 * - Memo  → neon violet (#a259ff)
 * - Ping  → neon violet (#a259ff)
 *
 * Queue behaviour:
 *   • Up to 3 cards fanned left→right, never overlapping
 *   • New cards stagger in 1 s apart
 *   • Front card (leftmost) auto-dismisses after 2 s when page is active
 *   • As front dismisses, next slides left (carousel)
 *   • OS-level notification fires when page is hidden
 *
 * Memo click → MemoGallery modal with pagination
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ── colours ──────────────────────────────────────────────────────────────────
const COLOR_CHAT = "#ff4ecb";
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

// ── OS notification helper ───────────────────────────────────────────────────
function fireOsNotification(item: NotifItem) {
  if (typeof window === "undefined" || Notification.permission !== "granted") return;
  try {
    const n = new Notification(
      item.type === "chat" ? `💬 ${item.senderName}` : `📝 Memo from ${item.senderName}`,
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[300]"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="fixed z-[301] flex flex-col"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "min(94vw, 480px)",
          maxHeight: "80vh",
          background: "rgba(8,6,20,0.98)",
          border: `1px solid ${COLOR_MEMO}44`,
          borderRadius: 20,
          boxShadow: `0 24px 80px rgba(0,0,0,0.85), 0 0 60px ${COLOR_MEMO}18`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid ${COLOR_MEMO}22` }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: COLOR_MEMO }}>
              📝 Memo
            </span>
            <span className="text-[10px] font-semibold" style={{ color: COLOR_MEMO }}>
              from {memo.senderName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Pagination dots */}
            {memos.length > 1 && (
              <div className="flex items-center gap-1.5">
                {memos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIdx(i)}
                    className="rounded-full transition-all"
                    style={{
                      width: i === idx ? 18 : 7,
                      height: 7,
                      background: i === idx ? COLOR_MEMO : `${COLOR_MEMO}50`,
                      boxShadow: i === idx ? `0 0 8px ${COLOR_MEMO}` : "none",
                    }}
                  />
                ))}
              </div>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md transition-all"
              style={{ color: COLOR_MEMO, background: `${COLOR_MEMO}18` }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: COLOR_MEMO }}>
            {memo.content}
          </p>
          <p className="text-[10px] mt-4 font-semibold" style={{ color: `${COLOR_MEMO}90` }}>
            {new Date(memo.createdAt).toLocaleString(undefined, {
              month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={archiveMemo}
              className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all"
              style={{ color: COLOR_MEMO, background: `${COLOR_MEMO}18`, border: `1px solid ${COLOR_MEMO}40` }}
            >
              ⬇ Archive
            </button>
            <button
              onClick={deleteMemo}
              className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all hover:bg-red-500/20 hover:border-red-400/40 hover:text-red-400"
              style={{ color: COLOR_MEMO, background: `${COLOR_MEMO}18`, border: `1px solid ${COLOR_MEMO}40` }}
            >
              ✕ Delete
            </button>
          </div>
        </div>

        {/* Pagination arrows */}
        {localMemos.length > 1 && (
          <div
            className="flex items-center justify-between px-5 py-3 flex-shrink-0"
            style={{ borderTop: `1px solid ${COLOR_MEMO}30` }}
          >
            <button
              onClick={prev}
              disabled={idx === 0}
              className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-30"
              style={{ color: COLOR_MEMO, background: `${COLOR_MEMO}22`, border: `1px solid ${COLOR_MEMO}44` }}
            >
              ← Prev
            </button>
            <span className="text-[11px] font-bold" style={{ color: COLOR_MEMO }}>
              {idx + 1} / {localMemos.length}
            </span>
            <button
              onClick={next}
              disabled={idx === localMemos.length - 1}
              className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-30"
              style={{ color: COLOR_MEMO, background: `${COLOR_MEMO}22`, border: `1px solid ${COLOR_MEMO}44` }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
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
  // Persist seen memo IDs in localStorage so reloads don't re-fire old memos
  const memoSeenRef = useRef<Set<string>>(new Set());
  const allMemosRef = useRef<MemoData[]>([]);  // gallery history

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
        // Schedule more if queue still has items
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
      // Pull next from queue after 1 s
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
        // restart dismiss timer — handled by frontId effect re-running on focus
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
        // Add to gallery history (prepend newest first for display, but keep order)
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
            className="fixed"
            style={{
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
            <div
              className="flex items-start gap-3 rounded-2xl px-4 py-3"
              style={{
                background: "rgba(6,5,16,0.97)",
                border: `1px solid ${color}44`,
                boxShadow: `0 8px 32px rgba(0,0,0,0.75), 0 0 24px ${color}16`,
                backdropFilter: "blur(14px)",
              }}
            >
              {/* Left accent bar */}
              <div
                className="w-0.5 self-stretch rounded-full flex-shrink-0"
                style={{ background: `linear-gradient(to bottom, ${color}, ${color}44)` }}
              />

              {/* Content */}
              <div
                className="flex-1 min-w-0"
                style={{ cursor: isMemo ? "pointer" : "default" }}
                onClick={isMemo ? () => openGallery(item) : undefined}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color }}>
                  {item.type === "chat" ? "💬" : "📝"} {item.senderName}
                </p>
                <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                  {item.body}
                </p>
                {isMemo && (
                  <p className="text-[9px] mt-1.5 font-semibold" style={{ color: `${color}88` }}>
                    tap to view memo →
                  </p>
                )}
              </div>

              {/* Dismiss (front card only) */}
              {i === 0 && (
                <button
                  onClick={dismissFront}
                  className="text-white/20 hover:text-white/50 transition-colors text-xs flex-shrink-0 mt-0.5"
                >
                  ✕
                </button>
              )}
            </div>
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
