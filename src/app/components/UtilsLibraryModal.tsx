"use client";

/**
 * UtilsLibraryModal — the developer / niche-tooling catalog that lives as a
 * card inside the top-level Library modal (LibraryModal.tsx).
 *
 * Per global protocol (feedback_office_surface_for_rcs_utils.md):
 * the DEFAULT home for new RCS / TGV Office utilities is here. Top-level
 * `/dashboard/utils` tiles are reserved for high-frequency operator actions,
 * hardening HCMs, or anything the user explicitly wants on the main surface.
 *
 * Today: one entry — 🌲 Feature Worktrees. Future migrations land alongside.
 */

import { useEffect, useState, type ReactNode } from "react";
import styled from "styled-components";
import { colors, glowRgba } from "../theme";
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
import FeatureWorktreesControlModal from "./dev-tooling/feature-worktrees/FeatureWorktreesControlModal";

type UtilStatus = "live" | "in progress" | "planned";

type UtilEntry = {
  key: string;
  emoji: string;
  title: string;
  blurb: string;
  status: UtilStatus;
};

type SectionSpec = {
  id: string;
  title: string;
  entries: UtilEntry[];
};

const SECTIONS: SectionSpec[] = [
  {
    id: "dev-tooling",
    title: "Developer Tooling",
    entries: [
      {
        key: "feature-worktrees",
        emoji: "🌲",
        title: "Feature Worktrees",
        blurb:
          "Git-worktree feature isolation for Claude Code sessions. Active worktrees across both Linux users (admin + marmar), per-row Finalize (squash / merge / discard / keep), prune controls, and daily auto-prune log.",
        status: "live",
      },
    ],
  },
];

/* ── Styled ───────────────────────────────────────────────────── */

const FsContainer = styled(ModalContainer)<{ $fs: boolean }>`
  ${(p) =>
    p.$fs &&
    `
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
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  &:hover {
    background: ${glowRgba("violet", 0.28)};
    box-shadow: 0 0 10px ${glowRgba("violet", 0.5)};
  }
  &:active {
    transform: translateY(1px);
  }
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
`;

const SectionWrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  & + & {
    margin-top: 1.25rem;
  }
`;

const SectionLabel = styled.h3`
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: ${colors.violet};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;

  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const Card = styled.button<{ $clickable: boolean }>`
  text-align: left;
  border-radius: 0.75rem;
  padding: 1rem;
  background: ${glowRgba("violet", 0.04)};
  border: 1px solid ${glowRgba("violet", 0.18)};
  cursor: ${(p) => (p.$clickable ? "pointer" : "default")};
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
  color: inherit;

  &:hover {
    background: ${(p) => (p.$clickable ? glowRgba("violet", 0.1) : glowRgba("violet", 0.04))};
    border-color: ${(p) => (p.$clickable ? glowRgba("violet", 0.4) : glowRgba("violet", 0.18))};
  }
  &:active {
    transform: ${(p) => (p.$clickable ? "translateY(1px)" : "none")};
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.4rem;
  gap: 0.5rem;
`;

const CardTitle = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: ${colors.violet};
`;

const Emoji = styled.span`
  font-size: 1rem;
`;

const StatusBadge = styled.span<{ $status: UtilStatus }>`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  color: ${(p) =>
    p.$status === "live"
      ? colors.green
      : p.$status === "in progress"
        ? colors.gold
        : "var(--t-textFaint)"};
  background: ${(p) =>
    p.$status === "live"
      ? glowRgba("green", 0.1)
      : p.$status === "in progress"
        ? glowRgba("gold", 0.1)
        : "var(--t-inputBg)"};
`;

const CardBody = styled.p`
  font-size: 0.75rem;
  color: var(--t-textMuted);
  line-height: 1.5;
  margin: 0;
`;

/* ── Component ────────────────────────────────────────────────── */

type Open =
  | { kind: "none" }
  | { kind: "feature-worktrees" };

export default function UtilsLibraryModal({
  onClose,
}: {
  onClose: () => void;
}) {
  useModalLifecycle();
  const [fullscreen, setFullscreen] = useState(false);
  const [child, setChild] = useState<Open>({ kind: "none" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (child.kind !== "none") setChild({ kind: "none" });
        else onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [child.kind, onClose]);

  // Drop the backdrop below the nested modal's z-index so the child renders on top.
  const nestedOpen = child.kind !== "none";
  const backdropStyle = nestedOpen ? { zIndex: 50 } : undefined;

  function openFor(entry: UtilEntry): (() => void) | null {
    if (entry.key === "feature-worktrees" && entry.status === "live") {
      return () => setChild({ kind: "feature-worktrees" });
    }
    return null;
  }

  return (
    <>
      <ModalBackdrop onClick={onClose} style={backdropStyle}>
        <FsContainer
          $fs={fullscreen}
          $accent="violet"
          $maxWidth="48rem"
          onClick={(e) => e.stopPropagation()}
        >
          <ModalHeader>
            <ModalHeaderLeft>
              <Emoji style={{ fontSize: "1.5rem" }}>🛠️</Emoji>
              <div>
                <DrawerTitle $accent="violet">Utils Library</DrawerTitle>
                <ModalSubtitle>
                  Developer & niche tooling — the default home for new RCS / Office utilities
                </ModalSubtitle>
              </div>
            </ModalHeaderLeft>
            <HeaderRight>
              <Tooltip
                accent={colors.violet}
                label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
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
            {SECTIONS.map((sec) => (
              <SectionWrap key={sec.id}>
                <SectionLabel>{sec.title}</SectionLabel>
                <Grid>
                  {sec.entries.map((e) => {
                    const onOpen = openFor(e);
                    const clickable = onOpen !== null;
                    const node: ReactNode = (
                      <>
                        <CardHeader>
                          <CardTitle>
                            <Emoji>{e.emoji}</Emoji>
                            {e.title}
                          </CardTitle>
                          <StatusBadge $status={e.status}>{e.status}</StatusBadge>
                        </CardHeader>
                        <CardBody>{e.blurb}</CardBody>
                      </>
                    );
                    return (
                      <Card
                        key={e.key}
                        $clickable={clickable}
                        type="button"
                        disabled={!clickable}
                        onClick={onOpen ?? undefined}
                      >
                        {node}
                      </Card>
                    );
                  })}
                </Grid>
              </SectionWrap>
            ))}
          </ModalBody>
        </FsContainer>
      </ModalBackdrop>

      {child.kind === "feature-worktrees" && (
        <FeatureWorktreesControlModal onClose={() => setChild({ kind: "none" })} />
      )}
    </>
  );
}
