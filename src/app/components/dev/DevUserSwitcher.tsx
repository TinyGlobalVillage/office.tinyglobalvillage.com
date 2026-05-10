/**
 * DEV MODE — draggable left-edge drawer for switching effective user.
 *
 * Ported from @tgv/module-dashboards DevUserSwitcher and adapted to office's
 * username-keyed user store. Mounted globally from src/app/layout.tsx when
 * (admin + dev-switcher-enabled + user's `dev-drawer-on` localStorage flag).
 *
 * Switching a user POSTs to /api/dev/impersonate which sets a cookie; then
 * we reload so server components and API routes see the new effective user.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import styled, { keyframes } from "styled-components";
import { clearAllDrawerState } from "../../lib/drawerPersist";

type DemoUser = {
  username: string;
  displayName: string;
  email: string;
  role: string;
};

const slideIn = keyframes`
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
`;

const slideOut = keyframes`
  from { transform: translateX(0); }
  to   { transform: translateX(-100%); }
`;

const Z_DEV = 2147483647;

const Root = styled.div<{ $top: number }>`
  position: fixed;
  left: env(safe-area-inset-left, 0px);
  top: ${({ $top }) => $top}px;
  z-index: ${Z_DEV};
  display: flex;
  align-items: flex-start;
  touch-action: none;
  user-select: none;
`;

const TabBtn = styled.button`
  appearance: none;
  border: 1px solid rgba(0, 228, 253, 0.4);
  border-left: none;
  border-radius: 0 8px 8px 0;
  background: rgba(10, 10, 15, 0.96);
  backdrop-filter: blur(12px);
  color: rgba(0, 228, 253, 0.8);
  font-family: monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 10px 8px;
  cursor: grab;
  transition: background 0.15s, color 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  writing-mode: vertical-lr;
  text-orientation: mixed;
  box-shadow: 2px 0 12px rgba(0, 228, 253, 0.12);

  @media (max-width: 899px) {
    padding: 14px 12px;
    font-size: 11px;
    min-height: 60px;
    border-width: 2px;
    box-shadow: 2px 0 16px rgba(0, 228, 253, 0.25);
  }

  &:hover { background: rgba(0, 228, 253, 0.1); color: #00e4fd; }
  &:active { cursor: grabbing; }
`;

const TabDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00e4fd;
  box-shadow: 0 0 6px rgba(0, 228, 253, 0.6);
`;

const Panel = styled.div<{ $closing: boolean }>`
  background: rgba(10, 10, 15, 0.97);
  border: 1px solid rgba(0, 228, 253, 0.25);
  border-left: none;
  border-radius: 0 12px 12px 0;
  padding: 14px 16px 14px 14px;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 228, 253, 0.06);
  backdrop-filter: blur(12px);
  font-family: monospace;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 230px;
  max-height: 80vh;
  overflow-y: auto;
  animation: ${({ $closing }) => ($closing ? slideOut : slideIn)} 0.2s ease forwards;

  @media (max-width: 899px) {
    min-width: unset;
    width: calc(100vw - 50px);
    max-width: 320px;
    max-height: 70vh;
  }
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const PanelTitle = styled.span`
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: rgba(0, 228, 253, 0.5);
`;

const CloseBtn = styled.button`
  appearance: none;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  font-size: 16px;
  padding: 0 2px;
  line-height: 1;
  transition: color 0.15s;
  &:hover { color: rgba(255, 255, 255, 0.7); }
`;

const SectionLabel = styled.div`
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: rgba(230, 255, 255, 0.3);
  margin-top: 4px;
`;

const CurrentRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Username = styled.div`
  color: rgba(0, 228, 253, 0.85);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
`;

const RoleBadge = styled.span<{ $role: string }>`
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${({ $role }) =>
    $role === "admin" ? "rgba(0,228,253,0.15)" : "rgba(168,85,247,0.15)"};
  color: ${({ $role }) => ($role === "admin" ? "#00e4fd" : "#a855f7")};
  border: 1px solid ${({ $role }) =>
    $role === "admin" ? "rgba(0,228,253,0.3)" : "rgba(168,85,247,0.3)"};
`;

const UserSelect = styled.select`
  appearance: none;
  width: 100%;
  padding: 8px 30px 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(0, 228, 253, 0.3);
  background: rgba(0, 228, 253, 0.06);
  color: #00e4fd;
  font-family: monospace;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2300e4fd' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;

  &:focus { border-color: rgba(0, 228, 253, 0.6); }
  & option {
    background: #0a0a0f;
    color: #e6ffff;
    font-family: monospace;
  }
`;

const Divider = styled.div`
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin: 8px 0;
`;

const RestoreBtn = styled.button`
  appearance: none;
  border: 1px solid rgba(0, 228, 253, 0.3);
  background: rgba(0, 228, 253, 0.06);
  color: rgba(0, 228, 253, 0.9);
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 800;
  font-family: monospace;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  width: 100%;
  transition: all 0.15s;
  &:hover { background: rgba(0, 228, 253, 0.12); }
`;

const LogoutBtn = styled.button`
  appearance: none;
  border: none;
  cursor: pointer;
  padding: 9px 14px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 800;
  font-family: monospace;
  letter-spacing: 0.3px;
  background: rgba(239, 68, 68, 0.1);
  color: rgba(239, 68, 68, 0.7);
  transition: all 0.15s;
  width: 100%;

  &:hover { background: rgba(239, 68, 68, 0.18); color: #f87171; }
  &:active { transform: scale(0.97); }
`;

const STORAGE_KEY = "dev-switcher-top";

function readImpersonatedUsername(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)__dev_impersonate_username=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

type Props = {
  /** Real logged-in admin's username (from the JWT) — used to show who the "real you" is. */
  adminUsername: string;
};

export default function DevUserSwitcher({ adminUsername }: Props) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [impersonated, setImpersonated] = useState<string | null>(null);

  const [topY, setTopY] = useState(() => {
    if (typeof window === "undefined") return 200;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Math.min(Number(saved), window.innerHeight - 60) : 200;
  });
  const dragging = useRef(false);
  const dragOffset = useRef(0);

  useEffect(() => {
    setImpersonated(readImpersonatedUsername());
  }, []);

  const loadUsers = useCallback(async () => {
    if (loaded) return;
    try {
      const res = await fetch("/api/dev/demo-users");
      if (!res.ok) return;
      const data = (await res.json()) as { users: DemoUser[] };
      setUsers(data.users ?? []);
      setLoaded(true);
    } catch { /* ignore */ }
  }, [loaded]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    dragOffset.current = e.clientY - topY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [topY]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const next = Math.max(20, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current));
    setTopY(next);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const next = Math.max(20, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current));
    setTopY(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }, []);

  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const handleTabPointerDown = useCallback((e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    onPointerDown(e);
  }, [onPointerDown]);

  const handleTabPointerUp = useCallback((e: React.PointerEvent) => {
    const start = pointerStart.current;
    onPointerUp(e);
    if (start) {
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx < 5 && dy < 5) {
        setOpen(true);
        void loadUsers();
      }
    }
    pointerStart.current = null;
  }, [onPointerUp, loadUsers]);

  function handleClose() {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 200);
  }

  async function switchToUsername(username: string) {
    if (switching) return;
    setSwitching(username);
    try {
      if (username === adminUsername) {
        await fetch("/api/dev/impersonate", { method: "DELETE" });
      } else {
        await fetch("/api/dev/impersonate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
      }
      window.location.reload();
    } catch {
      setSwitching(null);
    }
  }

  const sortedUsers = useMemo(() => {
    const admins = users.filter((u) => u.role === "admin");
    const others = users.filter((u) => u.role !== "admin");
    return [...admins, ...others];
  }, [users]);

  const activeUsername = impersonated ?? adminUsername;
  const activeRecord = users.find((u) => u.username === activeUsername);
  const displayName = activeRecord?.displayName ?? activeUsername;
  const currentRole = activeRecord?.role ?? (impersonated ? "member" : "admin");

  return (
    <Root $top={topY} onPointerMove={onPointerMove}>
      {open ? (
        <Panel $closing={closing}>
          <PanelHeader>
            <PanelTitle>Dev Mode</PanelTitle>
            <CloseBtn type="button" onClick={handleClose}>✕</CloseBtn>
          </PanelHeader>

          <CurrentRow>
            <Username>{displayName}</Username>
            <RoleBadge $role={currentRole}>{currentRole}</RoleBadge>
          </CurrentRow>

          <SectionLabel>Switch User</SectionLabel>
          {loaded ? (
            <UserSelect
              value={activeUsername}
              disabled={switching !== null}
              onChange={(e) => void switchToUsername(e.target.value)}
            >
              {sortedUsers.map((u) => (
                <option key={u.username} value={u.username}>
                  {u.displayName} ({u.role})
                </option>
              ))}
            </UserSelect>
          ) : (
            <UserSelect disabled>
              <option>Loading…</option>
            </UserSelect>
          )}
          {switching && (
            <span style={{ fontSize: 10, color: "rgba(0,228,253,0.5)" }}>Switching…</span>
          )}

          {impersonated && (
            <RestoreBtn
              type="button"
              disabled={switching !== null}
              onClick={() => void switchToUsername(adminUsername)}
            >
              ↺ Restore admin
            </RestoreBtn>
          )}

          <Divider />

          <LogoutBtn type="button" onClick={() => { clearAllDrawerState(); signOut({ callbackUrl: "/login" }); }}>
            Sign Out
          </LogoutBtn>
        </Panel>
      ) : (
        <TabBtn
          type="button"
          onPointerDown={handleTabPointerDown}
          onPointerUp={handleTabPointerUp}
          onClick={(e) => e.preventDefault()}
        >
          <TabDot />
          DEV
        </TabBtn>
      )}
    </Root>
  );
}
