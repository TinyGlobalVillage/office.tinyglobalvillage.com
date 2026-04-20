"use client";

import { useEffect } from "react";
import styled from "styled-components";
import LibraryIcon from "./LibraryIcon";
import { colors, rgb, glowRgba } from "../theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalSubtitle,
  ModalBody,
  CloseBtn,
} from "../styled";
import NeonX from "./NeonX";

const SECTIONS = [
  { title: "Component Library", body: "Canonical TGV UI primitives — pulled from the Sandbox registry once they ship.", status: "in progress" },
  { title: "Skill Library", body: "Domain skills the agent can consult: opensrs, fastmail, swisseph, and more as they're added.", status: "live" },
  { title: "Playbook Library", body: "Reusable runbooks: gitrefuse, dep-check, deploy flows, incident response.", status: "live" },
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="violet" $maxWidth="48rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <LibraryIcon size={28} color={colors.violet} />
            <div>
              <ModalTitle $color={colors.violet}>Library</ModalTitle>
              <ModalSubtitle>Catalog of every reusable asset across TGV + Refusionist</ModalSubtitle>
            </div>
          </ModalHeaderLeft>
          <NeonX accent="pink" onClick={onClose} title="Close" />
        </ModalHeader>
        <ModalBody>
          <Grid>
            {SECTIONS.map((s) => (
              <Card key={s.title}>
                <CardHeader>
                  <CardTitle>{s.title}</CardTitle>
                  <StatusBadge $status={s.status}>{s.status}</StatusBadge>
                </CardHeader>
                <CardBody>{s.body}</CardBody>
              </Card>
            ))}
          </Grid>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
