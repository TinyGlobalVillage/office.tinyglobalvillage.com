"use client";

import { useState, useEffect } from "react";
import styled from "styled-components";
import ClaudeIcon from "./ClaudeIcon";
import ClaudeChatModal from "./ClaudeChatModal";
import ClaudeGuideModal from "./ClaudeGuideModal";
import ClaudeFilesModal from "./ClaudeFilesModal";
import ClaudeVocabModal from "./ClaudeVocabModal";
import { colors, rgb, glowRgba } from "../../theme";
import { DrawerTitle } from "../../styled";
import NeonX from "../NeonX";
import Tooltip from "../ui/Tooltip";
import { useModalLifecycle } from "../../lib/drawerKnobs";

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

const Panel = styled.div<{ $fs?: boolean }>`
  position: fixed; z-index: 56;
  display: flex; flex-direction: column; overflow: hidden;
  ${(p) => p.$fs ? `
    inset: 0;
    width: 100vw;
    max-height: 100vh;
    border-radius: 0;
  ` : `
    top: 80px; left: 50%; transform: translateX(-50%);
    width: min(720px, 92vw);
    max-height: calc(100vh - 120px);
    border-radius: 20px;
  `}
  background: var(--t-surface);
  border: 1px solid ${glowRgba("orange", 0.32)};
  box-shadow: 0 24px 80px rgba(0,0,0,0.85), 0 0 32px ${glowRgba("orange", 0.15)};

  [data-theme="light"] & {
    box-shadow: 0 12px 40px rgba(0,0,0,0.1), 0 0 24px ${glowRgba("orange", 0.08)};
  }
`;

const CtrlBtn = styled.button<{ $active?: boolean }>`
  width: 2.125rem;
  height: 2.125rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.0625rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  background: ${(p) => (p.$active ? glowRgba("orange", 0.28) : glowRgba("orange", 0.14))};
  border: 1px solid ${(p) => glowRgba("orange", p.$active ? 0.6 : 0.45)};
  color: ${colors.orange};
  text-shadow: 0 0 6px rgba(${rgb.orange}, 0.7);
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  &:hover { background: ${glowRgba("orange", 0.28)}; box-shadow: 0 0 10px ${glowRgba("orange", 0.5)}; }
  &:active { transform: translateY(1px); }

  [data-theme="light"] & { text-shadow: none; }

  svg { width: 14px; height: 14px; }

  @media (max-width: 768px) {
    width: 2.75rem;
    height: 2.75rem;
    font-size: 1.1875rem;
    border-radius: 0.625rem;
  }
`;

const Header = styled.div`
  display: flex; align-items: center; gap: 0.75rem;
  padding: 1rem 1.25rem; flex-shrink: 0;
  border-bottom: 1px solid ${glowRgba("orange", 0.18)};
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
  useModalLifecycle();
  const [sub, setSub] = useState<SubModal>(null);
  const [fullscreen, setFullscreen] = useState(false);

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
      <Panel $fs={fullscreen}>
        <Header>
          <ClaudeIcon size={28} color={colors.orange} />
          <div style={{ flex: 1 }}>
            <DrawerTitle $accent="orange">Claude</DrawerTitle>
            <Sub>Pick a tool — chat, guide, file browser, or vocabulary.</Sub>
          </div>
          <Tooltip accent={colors.orange} label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            <CtrlBtn
              $active={fullscreen}
              onClick={() => setFullscreen((v) => !v)}
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreen ? "⊡" : "⊞"}
            </CtrlBtn>
          </Tooltip>
          <Tooltip accent={colors.orange} label="Close (Esc)">
            <NeonX accent="orange" onClick={onClose} />
          </Tooltip>
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
