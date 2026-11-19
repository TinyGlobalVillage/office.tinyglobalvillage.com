"use client";

import { ReactNode, Suspense, useEffect, type ComponentType } from "react";
import { useSearchParams } from "next/navigation";
import { TerminalProvider } from "./TerminalProvider";
import { PreviewProvider } from "./PreviewDrawer";
import dynamic from "next/dynamic";
import PreviewDrawer from "./PreviewDrawer";
import PresenceHeartbeat from "./PresenceHeartbeat";
import PingNotifier from "./PingNotifier";
import DashboardPopoutBeacon from "./DashboardPopoutBeacon";
import GlobalModals from "./GlobalModals";
import DrawerStackController from "./DrawerStackController";
import TileUrlSync from "./TileUrlSync";
import FindPalette from "./FindPalette";
import type { RingChannel } from "./call";
import { deferShellPiece } from "../lib/deferredShell";

// Stack-efficiency P2: the drawers and call overlays are on every Office page
// but none of them is needed to paint it. They load right after hydration, out
// of the first-load bundle; deferredShell holds any drawer event fired before
// they arrive and replays it once they have all mounted.
const FrontDeskDrawer = dynamic(deferShellPiece("frontdesk", () => import("./FrontDeskDrawer").then((m) => m.default)), { ssr: false });
const IncomingCallOverlay = dynamic(deferShellPiece("call-overlay", () => import("./frontdesk/IncomingCallOverlay").then((m) => m.default)), { ssr: false });
const OfficeMessenger = dynamic(deferShellPiece("messenger", () => import("./OfficeMessenger").then((m) => m.default)), { ssr: false });
const Forum = dynamic(deferShellPiece("forum", () => import("@tgv/module-forum").then((m) => m.Forum as ComponentType<{ apiBase: string }>)), { ssr: false });
const InboxDrawer = dynamic(deferShellPiece("inbox", () => import("./InboxDrawer").then((m) => m.default)), { ssr: false });
const SessionsDrawer = dynamic(deferShellPiece("sessions", () => import("./SessionsDrawer").then((m) => m.default)), { ssr: false });
const LegendDrawer = dynamic(deferShellPiece("legend", () => import("./LegendDrawer").then((m) => m.default)), { ssr: false });
const CliTerminal = dynamic(deferShellPiece("terminal", () => import("./CliTerminal").then((m) => m.default)), { ssr: false });
const IncomingCallToast = dynamic(deferShellPiece("call-toast", () => import("./call/IncomingCallToast").then((m) => m.default)), { ssr: false });

function ShellInner({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const embedded = searchParams?.get("embedded") === "1";
  const popout = searchParams?.get("popout") === "1";

  // Deep link from a scheduled-alert email (…/dashboard?alert=<id>): open the
  // Front Desk drawer on its alerts tab. AlertsTab reads the same ?alert= param
  // on mount and opens that alert's detail card.
  const deepAlert = searchParams?.get("alert");
  useEffect(() => {
    if (!deepAlert) return;
    window.dispatchEvent(new CustomEvent("tgv-drawer-open", { detail: "alerts" }));
  }, [deepAlert]);

  if (embedded) {
    // Embedded mode: stripped-down shell for iframe-mounted dashboard modals.
    // Skip drawers, terminal, preview — the host window owns those.
    return (
      <TerminalProvider>
        <PreviewProvider>
          {children}
        </PreviewProvider>
      </TerminalProvider>
    );
  }

  if (popout) {
    // Pop-out mode: chromeless standalone window, heartbeat to the main window
    // via BroadcastChannel so the origin modal shows a Blackout placeholder.
    return (
      <TerminalProvider>
        <PreviewProvider>
          <DashboardPopoutBeacon />
          {children}
        </PreviewProvider>
      </TerminalProvider>
    );
  }

  const handleJoinFromRing = (mode: "active" | "observer") => (channel: RingChannel) => {
    // Drawers listen on `tgv-drawer-open` + `tgv-call-accept` to swap to the
    // accepted channel. The call stack's drawers subscribe to the latter and
    // enter the appropriate surface (full for sessions, strip for dm/group).
    window.dispatchEvent(new CustomEvent("tgv-call-accept", {
      detail: { channel, mode },
    }));
    // Also pop open the relevant drawer.
    const drawerId = channel.type === "session" ? "sessions" : "chat";
    window.dispatchEvent(new CustomEvent("tgv-drawer-open", { detail: drawerId }));
  };

  return (
    <TerminalProvider>
      <PreviewProvider>
        <PresenceHeartbeat />
        <PingNotifier />
        <DrawerStackController />
        {/* ?tile= opens modals and drawers on arrival, on every page — see TileUrlSync. */}
        <TileUrlSync />
        <FrontDeskDrawer />
        <IncomingCallOverlay />
        <OfficeMessenger />
        {/* The forum drawer. No launcher of its own: the chat's Forums list opens it. Mounted here,
            once, so a page that mounts a second messenger does not open two of them. */}
        <Forum apiBase="/api/forum" />
        <InboxDrawer />
        <SessionsDrawer />
        <LegendDrawer />
        <GlobalModals />
        {/* cmd/ctrl+F — find any tile, drawer tab or Utils tool by name. */}
        <FindPalette />
        <IncomingCallToast
          onJoinActive={handleJoinFromRing("active")}
          onJoinObserver={handleJoinFromRing("observer")}
        />
        {children}
        <CliTerminal />
        <PreviewDrawer />
      </PreviewProvider>
    </TerminalProvider>
  );
}

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <TerminalProvider>
          <PreviewProvider>{children}</PreviewProvider>
        </TerminalProvider>
      }
    >
      <ShellInner>{children}</ShellInner>
    </Suspense>
  );
}
