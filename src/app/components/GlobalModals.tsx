"use client";

import { useEffect, useState } from "react";
import { clearTileUrl, currentTile } from "@/app/lib/tileUrl";
import dynamic from "next/dynamic";
import MyAlertsAccess from "./MyAlertsAccess";

// Stack-efficiency P2: every modal here renders only while open, so none of
// them belongs in the first load of every Office page. Each loads on demand;
// `warmGlobalModals` fetches the chunks once the page is idle so the first
// open is still instant.
const loaders = {
  claude: () => import("./claude/ClaudeMenuModal"),
  sandbox: () => import("./sandbox/SandboxModal"),
  library: () => import("./LibraryModal"),
  suggestion: () => import("./suggestion/SuggestionBoxModal"),
  activity: () => import("./ActivityModal"),
  diary: () => import("./diary/RcsDiaryModal"),
};
const ClaudeMenuModal = dynamic(loaders.claude, { ssr: false });
const SandboxModal = dynamic(loaders.sandbox, { ssr: false });
const LibraryModal = dynamic(loaders.library, { ssr: false });
const SuggestionBoxModal = dynamic(loaders.suggestion, { ssr: false });
const ActivityModal = dynamic(loaders.activity, { ssr: false });
const RcsDiaryModal = dynamic(loaders.diary, { ssr: false });

let warmed = false;
function warmGlobalModals() {
  if (warmed) return;
  warmed = true;
  Object.values(loaders).forEach((load) => void load().catch(() => { warmed = false; }));
}

// Global hosts for the window-event modals dispatched by the dashboard tiles
// and the TgvNav Menu (see dashboardTiles.tsx). Hosting here — not in a page —
// is what lets a Menu entry work from ANY office page.
export default function GlobalModals() {
  const [claudeOpen, setClaudeOpen] = useState(false);
  // Which child surface the opener asked for (dashboardTiles OFFICE_CHILDREN),
  // handed to the modal so a search result lands on the thing, not the room.
  const [sandboxView, setSandboxView] = useState<string | undefined>();
  const [libraryChild, setLibraryChild] = useState<string | undefined>();
  const [claudeTool, setClaudeTool] = useState<string | undefined>();
  const [activityView, setActivityView] = useState<string | undefined>();
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);

  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warmGlobalModals, { timeout: 8000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(warmGlobalModals, 4000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const handlers: Record<string, (e: Event) => void> = {
      "open-claude": (e) => {
        setClaudeTool((e as CustomEvent<string | undefined>).detail);
        setClaudeOpen(true);
      },
      "open-sandbox": (e) => {
        setSandboxView((e as CustomEvent<string | undefined>).detail);
        setSandboxOpen(true);
      },
      "open-library": (e) => {
        setLibraryChild((e as CustomEvent<string | undefined>).detail);
        setLibraryOpen(true);
      },
      "open-suggestion": () => setSuggestionOpen(true),
      "open-activity": (e) => {
        setActivityView((e as CustomEvent<string | undefined>).detail);
        setActivityOpen(true);
      },
      "open-rcs-diary": () => setDiaryOpen(true),
    };
    const entries = Object.entries(handlers);
    entries.forEach(([ev, fn]) => window.addEventListener(ev, fn));
    return () => entries.forEach(([ev, fn]) => window.removeEventListener(ev, fn));
  }, []);

  // Back closes what Back opened. dispatchTileAction pushed an entry when the
  // modal opened, so popping it has to take the modal down too — otherwise the
  // address bar says /dashboard while the Sandbox is still covering the screen.
  useEffect(() => {
    const sync = () => {
      const named = (currentTile().tile ?? "").toLowerCase();
      if (named !== "claude") setClaudeOpen(false);
      if (named !== "sandbox") setSandboxOpen(false);
      if (named !== "library") setLibraryOpen(false);
      if (named !== "suggest") setSuggestionOpen(false);
      if (named !== "logs") setActivityOpen(false);
      if (named !== "diary") setDiaryOpen(false);
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  /**
   * Closing takes the address with it. `clearTileUrl(key)` only fires when the
   * URL is describing THIS modal, so dismissing one surface can't wipe a link
   * that still points at another one still open.
   */
  const close = (set: (v: boolean) => void, key: string) => () => {
    set(false);
    clearTileUrl(key);
  };

  return (
    <>
      {claudeOpen && <ClaudeMenuModal onClose={close(setClaudeOpen, "Claude")} initialTool={claudeTool} />}
      {sandboxOpen && <SandboxModal onClose={close(setSandboxOpen, "Sandbox")} initialView={sandboxView} />}
      {libraryOpen && <LibraryModal onClose={close(setLibraryOpen, "Library")} initialChild={libraryChild} />}
      {suggestionOpen && <SuggestionBoxModal onClose={close(setSuggestionOpen, "Suggest")} />}
      {activityOpen && <ActivityModal onClose={close(setActivityOpen, "Logs")} initialTab={activityView} />}
      {diaryOpen && <RcsDiaryModal onClose={close(setDiaryOpen, "Diary")} />}
      {/* self-listens for "open-my-alerts" */}
      <MyAlertsAccess headless />
    </>
  );
}
