"use client";

import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { useState } from "react";
import styled from "styled-components";
import LibraryIcon from "./LibraryIcon";
import { colors, rgb, glowRgba } from "../theme";
import { useModalLifecycle } from "../lib/drawerKnobs";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalSubtitle,
  ModalBody,
  DrawerTitle,
} from "../styled";
import NeonX from "./NeonX";
import Tooltip from "./ui/Tooltip";
import SkillLibraryModal from "./SkillLibraryModal";
import PlaybookLibraryModal from "./PlaybookLibraryModal";
import SandboxModal from "./sandbox/SandboxModal";
import UtilsLibraryModal from "./UtilsLibraryModal";

const FsContainer = styled(ModalContainer)<{ $fs: boolean }>`
  ${(p) => p.$fs && `
    max-width: 100vw;
    max-height: 100vh;
    width: 100vw;
    height: 100vh;
    border-radius: 0;
  `}
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
  background: ${(p) => (p.$active ? glowRgba("violet", 0.28) : glowRgba("violet", 0.14))};
  border: 1px solid ${(p) => glowRgba("violet", p.$active ? 0.6 : 0.45)};
  color: ${colors.violet};
  text-shadow: 0 0 6px rgba(${rgb.violet}, 0.7);
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  &:hover { background: ${glowRgba("violet", 0.28)}; box-shadow: 0 0 10px ${glowRgba("violet", 0.5)}; }
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

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
`;

const SECTIONS = [
  { title: "Component Library", body: "Canonical TGV UI primitives — shared catalog with the Sandbox. Open from here to browse; use the Sandbox tile on the dashboard to author.", status: "live" },
  { title: "Skill Library", body: "Domain skills the agent can consult: opensrs, fastmail, swisseph, and more as they're added.", status: "live" },
  { title: "Playbook Library", body: "Reusable runbooks: gitrefuse, dep-check, deploy flows, incident response.", status: "live" },
  { title: "Utils Library", body: "Developer & niche tooling — feature worktrees today; default home for new RCS / Office utilities going forward.", status: "live" },
  { title: "Asset Library", body: "Logos, icons, brand colors, copy snippets — single source of truth for TGV + Refusionist.", status: "planned" },
  { title: "Knowledge Library", body: "Long-form references — Human Design corpus, registrar protocols, infra docs.", status: "live" },
];

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  max-height: 70vh;
  overflow-y: auto;

  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const Card = styled.div`
  border-radius: 0.75rem;
  padding: 1rem;
  background: ${glowRgba("violet", 0.04)};
  border: 1px solid ${glowRgba("violet", 0.12)};
  transition: background 0.15s;

  [data-theme="light"] & {
    background: ${glowRgba("violet", 0.03)};
    border-color: ${glowRgba("violet", 0.08)};
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
`;

const CardTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0;
  color: ${colors.violet};
`;

const StatusBadge = styled.span<{ $status: string }>`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  color: ${(p) =>
    p.$status === "live" ? colors.green
    : p.$status === "in progress" ? colors.gold
    : "var(--t-textFaint)"};
  background: ${(p) =>
    p.$status === "live" ? glowRgba("green", 0.1)
    : p.$status === "in progress" ? glowRgba("gold", 0.1)
    : "var(--t-inputBg)"};
`;

const CardBody = styled.p`
  font-size: 0.75rem;
  color: var(--t-textMuted);
  line-height: 1.5;
  margin: 0;
`;

export default function LibraryModal({ onClose }: { onClose: () => void }) {
  useModalLifecycle();
  const [fullscreen, setFullscreen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [playbooksOpen, setPlaybooksOpen] = useState(false);
  const [componentLibraryOpen, setComponentLibraryOpen] = useState(false);
  const [utilsLibraryOpen, setUtilsLibraryOpen] = useState(false);

  useEscapeToClose({ open: true, onClose });

  // When a nested modal (Component Library / Skill / Playbook) is open,
  // drop the LibraryModal backdrop below the nested PanelBackdrop (z-index
  // 65 in styled.ts) so the nested modal renders ON TOP. Without this,
  // LibraryModal's z-index 100 covers the nested one.
  const nestedOpen = componentLibraryOpen || skillsOpen || playbooksOpen || utilsLibraryOpen;
  const backdropStyle = nestedOpen ? { zIndex: 50 } : undefined;

  return (
    <>
      <ModalBackdrop onClick={onClose} style={backdropStyle}>
        <FsContainer $fs={fullscreen} $accent="violet" $maxWidth="48rem" onClick={(e) => e.stopPropagation()}>
          <ModalHeader>
            <ModalHeaderLeft>
              <LibraryIcon size={28} color={colors.violet} />
              <div>
                <DrawerTitle $accent="violet">Library</DrawerTitle>
                <ModalSubtitle>Catalog of every reusable asset across TGV + Refusionist</ModalSubtitle>
              </div>
            </ModalHeaderLeft>
            <HeaderRight>
              <Tooltip accent={colors.violet} label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
                <CtrlBtn
                  $active={fullscreen}
                  onClick={() => setFullscreen((v) => !v)}
                  aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {fullscreen ? "⊡" : "⊞"}
                </CtrlBtn>
              </Tooltip>
              <Tooltip accent={colors.violet} label="Close (Esc)">
                <NeonX accent="violet" onClick={onClose} />
              </Tooltip>
            </HeaderRight>
          </ModalHeader>
          <ModalBody>
            <Grid>
              {SECTIONS.map((s) => {
                const onOpen =
                  s.title === "Component Library" && s.status === "live" ? () => setComponentLibraryOpen(true)
                  : s.title === "Skill Library" && s.status === "live" ? () => setSkillsOpen(true)
                  : s.title === "Playbook Library" && s.status === "live" ? () => setPlaybooksOpen(true)
                  : s.title === "Utils Library" && s.status === "live" ? () => setUtilsLibraryOpen(true)
                  : null;
                const isClickable = onOpen !== null;
                return (
                  <Card
                    key={s.title}
                    onClick={isClickable ? onOpen : undefined}
                    style={{ cursor: isClickable ? "pointer" : "default" }}
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") onOpen!(); } : undefined}
                  >
                    <CardHeader>
                      <CardTitle>{s.title}</CardTitle>
                      <StatusBadge $status={s.status}>{s.status}</StatusBadge>
                    </CardHeader>
                    <CardBody>{s.body}</CardBody>
                  </Card>
                );
              })}
            </Grid>
          </ModalBody>
        </FsContainer>
      </ModalBackdrop>
      <SkillLibraryModal open={skillsOpen} onClose={() => setSkillsOpen(false)} />
      {playbooksOpen && <PlaybookLibraryModal onClose={() => setPlaybooksOpen(false)} />}
      {componentLibraryOpen && (
        <SandboxModal
          onClose={() => setComponentLibraryOpen(false)}
          title="Component Library"
          surface="library"
        />
      )}
      {utilsLibraryOpen && <UtilsLibraryModal onClose={() => setUtilsLibraryOpen(false)} />}
    </>
  );
}
