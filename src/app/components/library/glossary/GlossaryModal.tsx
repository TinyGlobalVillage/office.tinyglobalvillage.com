"use client";
/**
 * Glossary — Library → Glossary. Named TGV concepts, each with a mock demo and
 * a pointer to where the real thing lives.
 *
 * Deliberately a READER, not a workbench: nothing here is composable, so there
 * are no controls, no save, no deploy. Things you build with live in the
 * Sandbox; things you're being taught live here.
 */
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { useState } from "react";
import styled from "styled-components";
import { colors, glowRgba } from "../../../theme";
import { useModalLifecycle } from "../../../lib/drawerKnobs";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalSubtitle,
  ModalBody,
  DrawerTitle,
} from "../../../styled";
import NeonX from "../../NeonX";
import { GLOSSARY } from "./glossaryEntries";

export default function GlossaryModal({ onClose }: { onClose: () => void }) {
  useModalLifecycle();
  useEscapeToClose({ open: true, onClose });
  const [activeKey, setActiveKey] = useState<string>(GLOSSARY[0]?.key ?? "");
  const active = GLOSSARY.find((g) => g.key === activeKey) ?? GLOSSARY[0] ?? null;

  return (
    <ModalBackdrop onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContainer onMouseDown={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <DrawerTitle>Glossary</DrawerTitle>
            <ModalSubtitle>
              {GLOSSARY.length} named concepts — what a term means and where it lives
            </ModalSubtitle>
          </ModalHeaderLeft>
          <NeonX accent="violet" size="sm" onClick={onClose} title="Close" />
        </ModalHeader>

        <ModalBody>
          <Layout>
            <List>
              {GLOSSARY.map((g) => (
                <ListItem
                  key={g.key}
                  $active={g.key === active?.key}
                  onClick={() => setActiveKey(g.key)}
                >
                  <TermChip>{g.term}</TermChip>
                  <span>{g.name}</span>
                </ListItem>
              ))}
            </List>

            {active && (
              <Detail>
                <DetailTitle>
                  <TermChip>{active.term}</TermChip>
                  {active.name}
                </DetailTitle>
                <DemoArea>
                  <active.Demo />
                </DemoArea>
                <Label>What it is</Label>
                <Body>{active.summary}</Body>
                <Label>How you meet it</Label>
                <Body>{active.usage}</Body>
                <Label>Canonical</Label>
                <Canonical>{active.canonical}</Canonical>
              </Detail>
            )}
          </Layout>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

const Layout = styled.div`
  display: flex;
  gap: 1rem;
  min-height: 0;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const List = styled.div`
  flex: 0 0 200px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  @media (max-width: 768px) {
    flex: none;
    flex-direction: row;
    flex-wrap: wrap;
  }
`;

const ListItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  color: ${(p) => (p.$active ? colors.violet : "var(--t-text)")};
  background: ${(p) => (p.$active ? glowRgba("violet", 0.14) : "transparent")};
  border: 1px solid ${(p) => (p.$active ? glowRgba("violet", 0.45) : "transparent")};

  &:hover {
    background: ${glowRgba("violet", 0.1)};
  }
`;

const TermChip = styled.span`
  flex: none;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 2px 6px;
  border-radius: 5px;
  color: ${colors.violet};
  background: ${glowRgba("violet", 0.14)};
  border: 1px solid ${glowRgba("violet", 0.3)};
`;

const Detail = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const DetailTitle = styled.h3`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: ${colors.violet};
`;

const DemoArea = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem 1rem;
  border-radius: 0.75rem;
  background: ${glowRgba("violet", 0.04)};
  border: 1px solid ${glowRgba("violet", 0.12)};
`;

const Label = styled.span`
  font-size: 0.625rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${glowRgba("violet", 0.75)};
  margin-top: 0.25rem;
`;

const Body = styled.p`
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--t-textMuted, rgba(255, 255, 255, 0.72));
`;

const Canonical = styled.code`
  font-size: 0.6875rem;
  color: ${glowRgba("violet", 0.8)};
  word-break: break-word;
`;
