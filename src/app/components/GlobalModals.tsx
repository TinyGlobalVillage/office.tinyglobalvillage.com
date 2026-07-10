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
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);

  useEffect(() => {
    const handlers: Record<string, () => void> = {
      "open-claude": () => setClaudeOpen(true),
      "open-sandbox": () => setSandboxOpen(true),
      "open-library": () => setLibraryOpen(true),
      "open-suggestion": () => setSuggestionOpen(true),
      "open-activity": () => setActivityOpen(true),
      "open-rcs-diary": () => setDiaryOpen(true),
    };
    const entries = Object.entries(handlers);
    entries.forEach(([ev, fn]) => window.addEventListener(ev, fn));
    return () => entries.forEach(([ev, fn]) => window.removeEventListener(ev, fn));
  }, []);

  return (
    <>
      {claudeOpen && <ClaudeMenuModal onClose={() => setClaudeOpen(false)} />}
      {sandboxOpen && <SandboxModal onClose={() => setSandboxOpen(false)} />}
      {libraryOpen && <LibraryModal onClose={() => setLibraryOpen(false)} />}
      {suggestionOpen && <SuggestionBoxModal onClose={() => setSuggestionOpen(false)} />}
      {activityOpen && <ActivityModal onClose={() => setActivityOpen(false)} />}
      {diaryOpen && <RcsDiaryModal onClose={() => setDiaryOpen(false)} />}
      {/* self-listens for "open-my-alerts" */}
      <MyAlertsAccess headless />
    </>
  );
}
