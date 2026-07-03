"use client";

/**
 * Quick-reference modal for the Claude-via-WhatsApp agent. Loads the
 * canonical readme from /srv/refusion-core/logs/tgv-office/readmes/claude-via-whatsapp.md
 * via the /api/readmes/[id] endpoint.
 *
 * Accessible from the Front Desk SystemToolsModal so operators can pull
 * up the command grammar + cost model + how-it-works at any time.
 */

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { rgb } from "../../theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalSubtitle,
  ModalBody,
  CloseBtn,
} from "../../styled";
import { renderMarkdown } from "@/lib/markdown";

type Readme = { id: string; title: string; category: string; body: string };

const Article = styled.article`
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--t-text);

  h1 {
    font-size: 1.4rem;
    margin: 0 0 0.75rem;
    color: var(--t-text);
  }
  h2 {
    font-size: 1rem;
    margin: 1.5rem 0 0.5rem;
    color: rgba(${rgb.gold}, 1);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
  }
  h3 { font-size: 0.9rem; margin: 1rem 0 0.4rem; }
  p { margin: 0 0 0.75rem; }
  ul, ol { margin: 0 0 0.75rem; padding-left: 1.25rem; }
  li { margin-bottom: 0.25rem; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.5rem 0 1rem;
    font-size: 0.8rem;
  }
  th, td {
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--t-border);
    text-align: left;
    vertical-align: top;
  }
  th {
    background: rgba(${rgb.gold}, 0.08);
    font-weight: 700;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  code, .md-code {
    font-family: var(--font-geist-mono), monospace;
    font-size: 0.8em;
    background: rgba(${rgb.gold}, 0.1);
    border: 1px solid rgba(${rgb.gold}, 0.2);
    border-radius: 0.25rem;
    padding: 0.05em 0.35em;
    color: rgba(${rgb.gold}, 1);
  }
  pre {
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid var(--t-border);
    border-radius: 0.4rem;
    padding: 0.6rem 0.8rem;
    overflow-x: auto;
    font-family: var(--font-geist-mono), monospace;
    font-size: 0.78rem;
    margin: 0 0 0.75rem;
  }
  hr { border: 0; border-top: 1px solid var(--t-border); margin: 1rem 0; }
  blockquote {
    border-left: 3px solid rgba(${rgb.gold}, 0.4);
    padding: 0.25rem 0.75rem;
    margin: 0.5rem 0;
    color: var(--t-textFaint);
    font-style: italic;
  }
  strong { color: var(--t-text); }
`;

const LoadingNote = styled.div`
  text-align: center;
  padding: 3rem;
  color: var(--t-textFaint);
`;

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function WhatsappRelayReadmeModal({ open, onClose }: Props) {
  useEscapeToClose({ open, onClose });

  const [readme, setReadme] = useState<Readme | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/readmes/claude-via-whatsapp");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as Readme;
      setReadme(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (open && !readme) void load();
  }, [open, readme, load]);

  if (!open) return null;

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer
        $accent="gold"
        $maxWidth="48rem"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle>📱 Claude-via-WhatsApp</ModalTitle>
            <ModalSubtitle>Quick reference — command grammar + cost model + architecture</ModalSubtitle>
          </ModalHeaderLeft>
          <CloseBtn onClick={onClose}>×</CloseBtn>
        </ModalHeader>
        <ModalBody>
          {error ? (
            <LoadingNote>Error loading readme: {error}</LoadingNote>
          ) : !readme ? (
            <LoadingNote>Loading…</LoadingNote>
          ) : (
            <Article dangerouslySetInnerHTML={{ __html: renderMarkdown(readme.body) }} />
          )}
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
