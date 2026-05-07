"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import TopNav from "../../components/TopNav";

interface ReadMe {
  id: string;
  title: string;
  category: string;
  content: string;
}

const Page = styled.div`
  min-height: 100vh;
  background: rgb(${rgb(colors.bg)});
  color: rgb(${rgb(colors.fg)});
  padding: 2rem;
`;

const Header = styled.h1`
  font-size: 1.5rem;
  margin: 0 0 1.5rem;
`;

const Table = styled.table`
  width: 100%;
  max-width: 1100px;
  border-collapse: separate;
  border-spacing: 0;
  background: rgb(${rgb(colors.surface)});
  border: 1px solid rgb(${rgb(colors.border)});
  border-radius: 8px;
  overflow: hidden;
`;

const Th = styled.th`
  text-align: left;
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgb(${rgb(colors.fgMuted)});
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgb(${rgb(colors.border)});
`;

const Tr = styled.tr`
  cursor: pointer;
  transition: background 120ms;
  &:hover {
    background: rgba(${rgb(colors.accent)}, 0.08);
  }
`;

const Td = styled.td`
  padding: 0.85rem 1rem;
  border-bottom: 1px solid rgba(${rgb(colors.border)}, 0.4);
`;

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
`;

const ModalBody = styled.div`
  width: min(720px, 92vw);
  max-height: 84vh;
  overflow-y: auto;
  background: rgb(${rgb(colors.surface)});
  border: 1px solid rgb(${rgb(colors.border)});
  border-radius: 10px;
  padding: 1.75rem 2rem;
  pre, code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  h1, h2, h3 {
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
  }
`;

const CloseBtn = styled.button`
  background: transparent;
  border: 1px solid rgb(${rgb(colors.border)});
  color: rgb(${rgb(colors.fg)});
  padding: 0.4rem 0.85rem;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 1rem;
`;

function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}

export default function ReadMesPage() {
  const [items, setItems] = useState<ReadMe[]>([]);
  const [open, setOpen] = useState<ReadMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/readmes")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <TopNav />
      <Page>
        <Header>Read Me&apos;s</Header>
        {loading && <p>Loading…</p>}
        {!loading && (
          <Table>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Category</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <Tr key={it.id} onClick={() => setOpen(it)}>
                  <Td>{it.title}</Td>
                  <Td>{it.category}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        {open && (
          <ModalBackdrop onClick={() => setOpen(null)}>
            <ModalBody onClick={(e) => e.stopPropagation()}>
              <h2 style={{ marginTop: 0 }}>{open.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(open.content) }} />
              <CloseBtn onClick={() => setOpen(null)}>Close</CloseBtn>
            </ModalBody>
          </ModalBackdrop>
        )}
      </Page>
    </>
  );
}
