"use client";

import { useState, useEffect } from "react";
import styled from "styled-components";
import ClaudeIcon from "./ClaudeIcon";
import ClaudeChatModal from "./ClaudeChatModal";
import ClaudeGuideModal from "./ClaudeGuideModal";
import ClaudeFilesModal from "./ClaudeFilesModal";
import ClaudeVocabModal from "./ClaudeVocabModal";
import { colors, rgb, glowRgba } from "../../theme";
import { CloseBtn } from "../../styled";

type SubModal = null | "chat" | "guide" | "files" | "vocab";

const tiles: Array<{ key: Exclude<SubModal, null>; title: string; subtitle: string; icon: string }> = [
  { key: "chat",  title: "Chat",       subtitle: "Talk to Claude",                icon: "💬" },
  { key: "guide", title: "Learn",      subtitle: "How to work with Claude",       icon: "📖" },
  { key: "files", title: "Files",      subtitle: "Global ~/.claude/ config",      icon: "🗂️" },
  { key: "vocab", title: "Vocabulary", subtitle: "Named UI patterns + shorthand", icon: "🔤" },
];

const Backdrop = styled.div`
  position: fixed; inset: 0; z-index: 55;
  background: var(--t-overlay);
  backdrop-filter: blur(4px);
`;

const Panel = styled.div`
  position: fixed; z-index: 56;
  display: flex; flex-direction: column; overflow: hidden;
  top: 80px; left: 50%; transform: translateX(-50%);
  width: min(720px, 92vw);
  max-height: calc(100vh - 120px);
  background: var(--t-surface);
  border: 1px solid ${glowRgba("orange", 0.32)};
  border-radius: 20px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.85), 0 0 32px ${glowRgba("orange", 0.15)};

  [data-theme="light"] & {
    box-shadow: 0 12px 40px rgba(0,0,0,0.1), 0 0 24px ${glowRgba("orange", 0.08)};
  }
`;

const Header = styled.div`
  display: flex; align-items: center; gap: 0.75rem;
  padding: 1rem 1.25rem; flex-shrink: 0;
  border-bottom: 1px solid ${glowRgba("orange", 0.18)};
`;

const Title = styled.h2`
  font-size: 1rem; font-weight: 700; margin: 0;
  color: ${colors.orange};
`;

const Sub = styled.p`
  font-size: 0.6875rem; margin: 0;
  color: var(--t-textFaint);
`;

const Grid = styled.div`
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 0.75rem; padding: 1.25rem;
`;

const Tile = styled.button`
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 0.5rem; padding: 1.75rem 1rem;
  border-radius: 1rem; border: none; cursor: pointer;
  background: ${glowRgba("orange", 0.06)};
  border: 1px solid ${glowRgba("orange", 0.18)};
  transition: background 0.15s, box-shadow 0.15s;

  &:hover {
    background: ${glowRgba("orange", 0.12)};
    box-shadow: 0 0 22px ${glowRgba("orange", 0.22)};
  }

  [data-theme="light"] & {
    background: ${glowRgba("orange", 0.04)};
    border-color: ${glowRgba("orange", 0.12)};
    &:hover {
      background: ${glowRgba("orange", 0.08)};
      box-shadow: 0 0 16px ${glowRgba("orange", 0.1)};
    }
  }
`;

const TileIcon = styled.span`font-size: 1.875rem;`;
const TileTitle = styled.span`
  font-size: 0.75rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: ${colors.orange};
`;
const TileSub = styled.span`
  font-size: 0.625rem; text-align: center; line-height: 1.3;
  color: var(--t-textFaint);
`;

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

      <Backdrop onClick={onClose} />
      <Panel>
        <Header>
          <ClaudeIcon size={28} color={colors.orange} />
          <div style={{ flex: 1 }}>
            <Title>Claude</Title>
            <Sub>Pick a tool — chat, guide, file browser, or vocabulary.</Sub>
          </div>
          <CloseBtn onClick={onClose} title="Close (Esc)">✕</CloseBtn>
        </Header>
        <Grid>
          {tiles.map((t) => (
            <Tile key={t.key} onClick={() => setSub(t.key)}>
              <TileIcon>{t.icon}</TileIcon>
              <TileTitle>{t.title}</TileTitle>
              <TileSub>{t.subtitle}</TileSub>
            </Tile>
          ))}
        </Grid>
      </Panel>
    </>
  );
}
