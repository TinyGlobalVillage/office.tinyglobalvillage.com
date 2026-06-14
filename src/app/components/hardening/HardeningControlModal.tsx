"use client";

// HardeningControlModal — reusable shell for every "system hardening surface"
// modal on Office Utils.
//
// Codified pattern (~/.claude/CLAUDE.md §"Hardening UTILS Surfaces"):
//   Every defensive mechanism we install on RCS gets a tile on Utils that
//   opens an HCM. The HCM renders an audit-log timeline at the top (when the
//   surface has one) and the hardening-specific sections supplied by the
//   consumer.
//
//   The RCS-wide system-tool views (fail2ban + UFW) are OPTIONAL and, as of
//   2026-06-14 (Gio), live ONLY on their own dedicated "Firewall & Intrusion"
//   tile — they are no longer force-rendered on every modal (that was visual
//   noise on surfaces unrelated to the firewall). A consumer that wants them
//   passes `globalSystemViews`; almost none do.
//
// Layout (both bracketed rows render only when the prop is provided):
//   ┌─────────────────────────────────────────────────────┐
//   │ Title + Subtitle                                  × │
//   ├─────────────────────────────────────────────────────┤
//   │ [Combined audit-log timeline]                       │  (if auditLogView)
//   │ [Hardening-specific sections — passed in via props] │  (always)
//   │ [Fail2ban + UFW — RCS-wide]                         │  (if globalSystemViews)
//   └─────────────────────────────────────────────────────┘

import { type ReactNode } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../NeonX";

export type HCMSection = {
  id: string;
  title: string;
  qmbm?: string;          // optional explainer body for a Question-Mark Bubble
  body: ReactNode;
};

export type HardeningControlModalProps = {
  title: string;
  subtitle?: string;
  /** Optional QMBM next to the modal title — explains the whole surface, not a section.
      Section-level qmbms still live on each HCMSection. */
  qmbm?: string;
  /** Hardening-specific sections — the modal's main content. */
  sections: HCMSection[];
  /** OPTIONAL RCS-wide system views (fail2ban + UFW). Historically force-rendered on EVERY
      hardening modal; as of 2026-06-14 they live ONLY on the dedicated "Firewall & Intrusion"
      tile (FirewallControlModal), so almost every consumer omits this. Rendered only when set. */
  globalSystemViews?: ReactNode;
  /** OPTIONAL combined audit-log timeline (from the consumer's audit-log endpoint). Rendered only
      when provided — a surface with no audit feed (e.g. the firewall tile) omits it. */
  auditLogView?: ReactNode;
  onClose: () => void;
};

const Sub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  letter-spacing: 0.04em;
  margin-top: 0.125rem;
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const SectionWrap = styled.section`
  display: flex; flex-direction: column; gap: 0.5rem;
  padding: 0.875rem 1rem;
  border: 1px solid rgba(${rgb.gold}, 0.18);
  border-radius: 0.625rem;
  background: rgba(${rgb.gold}, 0.04);
`;

const SectionHeader = styled.div`
  display: flex; align-items: center; gap: 0.5rem;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: ${colors.gold};
`;

const QmbmBubble = styled.button`
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.125rem; height: 1.125rem;
  border-radius: 50%;
  border: 1px solid rgba(${rgb.gold}, 0.4);
  background: transparent;
  color: ${colors.gold};
  font-size: 0.625rem; font-weight: 700;
  cursor: pointer;
  &:hover { background: rgba(${rgb.gold}, 0.1); }
`;

const QmbmCard = styled.div`
  margin-top: 0.5rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid rgba(${rgb.gold}, 0.25);
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--t-text);
  white-space: pre-wrap;
`;

import { useState } from "react";

function Section({ section }: { section: HCMSection }) {
  const [open, setOpen] = useState(false);
  return (
    <SectionWrap>
      <SectionHeader>
        <SectionTitle>{section.title}</SectionTitle>
        {section.qmbm && (
          <QmbmBubble
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-label={`Explain ${section.title}`}
            title={`Explain ${section.title}`}
          >
            ?
          </QmbmBubble>
        )}
      </SectionHeader>
      {open && section.qmbm && <QmbmCard>{section.qmbm}</QmbmCard>}
      <div>{section.body}</div>
    </SectionWrap>
  );
}

export default function HardeningControlModal(props: HardeningControlModalProps) {
  const [qmbmOpen, setQmbmOpen] = useState(false);
  return (
    <ModalBackdrop onClick={props.onClose}>
      <ModalContainer
        $accent="gold"
        $maxWidth="56rem"
        onClick={e => e.stopPropagation()}
      >
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ModalTitle>{props.title}</ModalTitle>
                {props.qmbm && (
                  <QmbmBubble
                    type="button"
                    onClick={() => setQmbmOpen(o => !o)}
                    aria-label={`Explain ${props.title}`}
                    title={`Explain ${props.title}`}
                  >
                    ?
                  </QmbmBubble>
                )}
              </div>
              {props.subtitle && <Sub>{props.subtitle}</Sub>}
              {qmbmOpen && props.qmbm && <QmbmCard>{props.qmbm}</QmbmCard>}
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={props.onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            {props.auditLogView && (
              <SectionWrap>
                <SectionHeader>
                  <SectionTitle>Activity Timeline</SectionTitle>
                </SectionHeader>
                <div>{props.auditLogView}</div>
              </SectionWrap>
            )}

            {props.sections.map(s => (
              <Section key={s.id} section={s} />
            ))}

            {props.globalSystemViews && (
              <SectionWrap>
                <SectionHeader>
                  <SectionTitle>RCS-wide system tools</SectionTitle>
                  <Sub>fail2ban + UFW posture for the whole box, not just this hardening surface</Sub>
                </SectionHeader>
                <div>{props.globalSystemViews}</div>
              </SectionWrap>
            )}
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
