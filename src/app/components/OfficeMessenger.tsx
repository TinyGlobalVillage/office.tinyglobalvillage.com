"use client";
// OfficeMessenger — Office's chat is the shared messenger (@tgv/module-tim), the same one a
// villager's dashboard mounts. Staff conversations, village conversations, calls and the support
// queue all live in the module; this file is only Office's way IN to it: the green "Chat" side tab
// (draggable, unread badge) and the `tgv-drawer-open` bridge every Office tile and search uses.
//
// The messenger is deliberately NOT registered in Office's drawer stack — it owns its own backdrop
// and ESC. It wears the stack's data attribute instead, so the stack's outside-click closer treats
// a press inside it as a press inside a drawer and leaves the others alone.
import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { InstantMessenger, useIM } from "@tgv/module-tim";
import { colors, rgb } from "../theme";
import { DrawerTab, DrawerTabLabel } from "../styled";
import { DRAWER_DATA_ATTR } from "../lib/drawerStack";
import { useKnobVisibility } from "../lib/drawerKnobs";
import { DrawerChatsIcon } from "./icons";

const DRAWER_ID = "chat";
const TAB_STORAGE_KEY = "tgv-drawer-tab-chat-y";

// The signed-in person's neon colour (Profile → Appearance). The messenger and its side tab wear
// it, and re-read it the moment the picker saves a new one.
function useMyAccent(): string | null {
  const [accent, setAccent] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [me, prof] = await Promise.all([
          fetch("/api/users/me").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/users/profile").then((r) => (r.ok ? r.json() : null)),
        ]);
        const mine = (prof?.profiles as { username: string; accentColor?: string }[] | undefined)?.find((p) => p.username === me?.username);
        if (alive && mine?.accentColor) setAccent(mine.accentColor);
      } catch {
        /* keeps the last colour */
      }
    };
    void load();
    window.addEventListener("tgv-profile-change", load);
    return () => {
      alive = false;
      window.removeEventListener("tgv-profile-change", load);
    };
  }, []);
  return accent;
}

const toRgb = (hex: string): string | null => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${n >> 16}, ${(n >> 8) & 255}, ${n & 255}`;
};

function ChatTab({ accent }: { accent: string | null }) {
  const { me, open, setOpen, unreadTotal } = useIM();
  const { hideKnob } = useKnobVisibility();
  const [tabY, setTabY] = useState(480);
  const drag = useRef({ y: 0, pos: 0, moved: false });

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(TAB_STORAGE_KEY));
    if (saved > 0) setTabY(Math.max(40, Math.min(window.innerHeight - 100, saved)));
  }, []);

  // Every Office surface that opens the chat (dashboard tile, search, a ring) says so with this.
  useEffect(() => {
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail === DRAWER_ID) setOpen(true);
    };
    window.addEventListener("tgv-drawer-open", onOpen);
    return () => window.removeEventListener("tgv-drawer-open", onOpen);
  }, [setOpen]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      drag.current = { y: e.clientY, pos: tabY, moved: false };
      let last = tabY;
      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - drag.current.y;
        if (Math.abs(delta) > 4) drag.current.moved = true;
        if (!drag.current.moved) return;
        last = Math.max(40, Math.min(window.innerHeight - 100, drag.current.pos + delta));
        setTabY(last);
      };
      const onUp = () => {
        if (drag.current.moved) window.localStorage.setItem(TAB_STORAGE_KEY, String(last));
        else setOpen(true);
        document.body.style.cursor = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.body.style.cursor = "ns-resize";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [tabY, setOpen],
  );

  // No member behind this Office login (bootstrap answered 401) ⇒ no messenger, so no way in.
  if (!me || open || hideKnob) return null;
  return (
    <SideTab
      {...{ [DRAWER_DATA_ATTR]: DRAWER_ID }}
      $side="left"
      $accent="green"
      $unread={unreadTotal > 0}
      $hex={accent && toRgb(accent) ? accent : colors.green}
      $rgb={(accent && toRgb(accent)) || rgb.green}
      onMouseDown={onMouseDown}
      title="Open chat"
      aria-label={unreadTotal > 0 ? `Open chat, ${unreadTotal} unread` : "Open chat"}
      style={{ top: tabY }}
    >
      <Glyph>
        <DrawerChatsIcon size={16} />
        {unreadTotal > 0 && <UnreadBadge>{unreadTotal > 9 ? "9+" : unreadTotal}</UnreadBadge>}
      </Glyph>
      <DrawerTabLabel>Chat</DrawerTabLabel>
    </SideTab>
  );
}

export default function OfficeMessenger({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const accent = useMyAccent();
  return (
    <InstantMessenger
      apiBase="/api/im"
      forumsPath="/api/forum/mine"
      transcribePath="/api/chat/transcribe"
      hideLauncher
      accent={accent}
      defaultOpen={defaultOpen}
      timeclockPath="/api/frontdesk/timeclock"
      supportQueuePath="/api/frontdesk/support/queue"
      notifyPrefsPath={null}
      consentInboxPath={null}
      drawerAttrs={{ [DRAWER_DATA_ATTR]: DRAWER_ID }}
    >
      <ChatTab accent={accent} />
    </InstantMessenger>
  );
}

const SideTab = styled(DrawerTab)<{ $unread: boolean; $hex: string; $rgb: string }>`
  left: 0;
  z-index: 100;
  color: ${(p) => p.$hex};
  border-color: rgba(${(p) => p.$rgb}, 0.45);
  border-left: none;
  background: rgba(${(p) => p.$rgb}, ${(p) => (p.$unread ? 0.22 : 0.12)});
  box-shadow: 2px 0 ${(p) => (p.$unread ? 14 : 10)}px rgba(${(p) => p.$rgb}, ${(p) => (p.$unread ? 0.35 : 0.18)});
`;
const Glyph = styled.span`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;
const UnreadBadge = styled.span`
  position: absolute;
  top: -6px;
  right: -6px;
  width: 13px;
  height: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 7px;
  font-weight: 700;
  background: ${colors.cyan};
  color: #060810;
`;
