"use client";

import { useEffect, useState } from "react";
import ClaudeMenuModal from "./claude/ClaudeMenuModal";
import SandboxModal from "./sandbox/SandboxModal";
import LibraryModal from "./LibraryModal";
import SuggestionBoxModal from "./suggestion/SuggestionBoxModal";

export default function GlobalModals() {
  const [claudeOpen, setClaudeOpen] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);

  useEffect(() => {
    const handlers: Record<string, () => void> = {
      "open-claude": () => setClaudeOpen(true),
      "open-sandbox": () => setSandboxOpen(true),
      "open-library": () => setLibraryOpen(true),
      "open-suggestion": () => setSuggestionOpen(true),
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
    </>
  );
}
