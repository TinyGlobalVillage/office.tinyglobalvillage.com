"use client";

import { useEffect, useState } from "react";
import ClaudeMenuModal from "./claude/ClaudeMenuModal";
import SandboxModal from "./sandbox/SandboxModal";
import LibraryModal from "./LibraryModal";
import SuggestionBoxModal from "./suggestion/SuggestionBoxModal";
import ActivityModal from "./ActivityModal";
import RcsDiaryModal from "./diary/RcsDiaryModal";
import MyAlertsAccess from "./MyAlertsAccess";

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

  return (
    <>
      {claudeOpen && <ClaudeMenuModal onClose={() => setClaudeOpen(false)} initialTool={claudeTool} />}
      {sandboxOpen && <SandboxModal onClose={() => setSandboxOpen(false)} initialView={sandboxView} />}
      {libraryOpen && <LibraryModal onClose={() => setLibraryOpen(false)} initialChild={libraryChild} />}
      {suggestionOpen && <SuggestionBoxModal onClose={() => setSuggestionOpen(false)} />}
      {activityOpen && <ActivityModal onClose={() => setActivityOpen(false)} initialTab={activityView} />}
      {diaryOpen && <RcsDiaryModal onClose={() => setDiaryOpen(false)} />}
      {/* self-listens for "open-my-alerts" */}
      <MyAlertsAccess headless />
    </>
  );
}
