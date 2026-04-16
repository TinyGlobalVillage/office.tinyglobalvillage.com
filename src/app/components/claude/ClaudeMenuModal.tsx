"use client";

import { useState, useEffect } from "react";
import ClaudeIcon from "./ClaudeIcon";
import ClaudeChatModal from "./ClaudeChatModal";
import ClaudeGuideModal from "./ClaudeGuideModal";
import ClaudeFilesModal from "./ClaudeFilesModal";
import ClaudeVocabModal from "./ClaudeVocabModal";

type SubModal = null | "chat" | "guide" | "files" | "vocab";

const ORANGE = "#d97757";
const ORANGE_RGB = "217,119,87";

const tiles: Array<{
  key: Exclude<SubModal, null>;
  title: string;
  subtitle: string;
  icon: string;
}> = [
  { key: "chat",  title: "Chat",       subtitle: "Talk to Claude",                icon: "💬" },
  { key: "guide", title: "Learn",      subtitle: "How to work with Claude",       icon: "📖" },
  { key: "files", title: "Files",      subtitle: "Global ~/.claude/ config",      icon: "🗂️" },
  { key: "vocab", title: "Vocabulary", subtitle: "Named UI patterns + shorthand", icon: "🔤" },
];

export default function ClaudeMenuModal({ onClose }: { onClose: () => void }) {
  const [sub, setSub] = useState<SubModal>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (sub) { setSub(null); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose, sub]);

  return (
    <>
      {sub === "chat"  && <ClaudeChatModal  onClose={() => setSub(null)} />}
      {sub === "guide" && <ClaudeGuideModal onClose={() => setSub(null)} />}
      {sub === "files" && <ClaudeFilesModal onClose={() => setSub(null)} />}
      {sub === "vocab" && <ClaudeVocabModal onClose={() => setSub(null)} />}

      <div
        className="fixed inset-0 z-[55]"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      <div
        className="fixed z-[56] flex flex-col overflow-hidden"
        style={{
          top: 80, left: "50%", transform: "translateX(-50%)",
          width: "min(720px, 92vw)",
          maxHeight: "calc(100vh - 120px)",
          background: "rgba(6,8,12,0.99)",
          border: `1px solid rgba(${ORANGE_RGB},0.32)`,
          borderRadius: 20,
          boxShadow: `0 24px 80px rgba(0,0,0,0.85), 0 0 32px rgba(${ORANGE_RGB},0.15)`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid rgba(${ORANGE_RGB},0.18)` }}
        >
          <ClaudeIcon size={28} color={ORANGE} />
          <div className="flex flex-col flex-1">
            <h2 className="text-base font-bold" style={{ color: ORANGE }}>Claude</h2>
            <p className="text-[11px] text-white/40">Pick a tool — chat, guide, file browser, or vocabulary.</p>
          </div>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:bg-white/10 transition-all"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >✕</button>
        </div>

        {/* Sub-tile grid */}
        <div className="grid grid-cols-2 gap-3 p-5">
          {tiles.map((t) => (
            <button
              key={t.key}
              onClick={() => setSub(t.key)}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl py-7 px-4 transition-all"
              style={{
                background: `rgba(${ORANGE_RGB},0.06)`,
                border: `1px solid rgba(${ORANGE_RGB},0.18)`,
                boxShadow: `0 0 0 0 rgba(${ORANGE_RGB},0)`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 22px rgba(${ORANGE_RGB},0.22)`;
                (e.currentTarget as HTMLElement).style.background = `rgba(${ORANGE_RGB},0.12)`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0 rgba(${ORANGE_RGB},0)`;
                (e.currentTarget as HTMLElement).style.background = `rgba(${ORANGE_RGB},0.06)`;
              }}
            >
              <span className="text-3xl">{t.icon}</span>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: ORANGE }}>{t.title}</span>
              <span className="text-[10px] text-white/45 text-center leading-tight">{t.subtitle}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
