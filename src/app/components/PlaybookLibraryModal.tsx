"use client";

/**
 * Playbook Library — catalogs every RCS utils script (with README) and every
 * user-authored bash alias on RCS (admin + marmar). Mirrors SkillLibraryModal's
 * accordion pattern. Two top-level sections: Aliases (table) and Scripts
 * (accordion rows grouped by directory).
 *
 * Fetches /api/playbooks/index for the catalog and /api/playbooks/readme on
 * demand for each script's README body.
 */

import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
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
import AddmToggle from "@tgv/module-component-library/components/ui/AddmToggle";
import { renderMarkdown } from "@/lib/markdown";

type ScriptEntry = {
  slug: string;
  name: string;
  group: string;
  readmePath: string;
  readmeRel: string;
  summary: string;
};

type Group = { name: string; items: ScriptEntry[] };

type AliasEntry = {
  user: string;
  name: string;
  expansion: string;
  callsScript: string | null;
};

type CatalogResponse = {
  groups: Group[];
  aliases: AliasEntry[];
  counts: { scripts: number; aliases: number; groups: number };
};

/* ── Layout ───────────────────────────────────────────────────────── */

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
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
`;

const SectionTitle = styled.h3`
  font-size: 0.75rem;
  font-weight: 800;
  color: ${colors.violet};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 1.25rem 0 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:first-of-type { margin-top: 0; }
`;

const SectionCount = styled.span`
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--t-textFaint);
  background: var(--t-inputBg);
  border: 1px solid var(--t-border);
  border-radius: 0.3rem;
  padding: 0.1rem 0.4rem;
  letter-spacing: 0.05em;
`;

const Loading = styled.div`
  text-align: center;
  padding: 1.5rem;
  color: var(--t-textFaint);
  font-size: 0.8rem;
`;

/* ── Aliases section ─────────────────────────────────────────────── */

const AliasTable = styled.div`
  display: grid;
  grid-template-columns: minmax(5rem, auto) minmax(6rem, auto) 1fr auto;
  gap: 0;
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  overflow: hidden;
  font-size: 0.75rem;
`;

const AliasHeaderCell = styled.div`
  padding: 0.4rem 0.6rem;
  background: ${glowRgba("violet", 0.08)};
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${colors.violet};
  border-bottom: 1px solid var(--t-border);
`;

const AliasCell = styled.div<{ $mono?: boolean }>`
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--t-border);
  font-family: ${(p) => (p.$mono ? "var(--font-geist-mono), monospace" : "inherit")};
  font-size: ${(p) => (p.$mono ? "0.72rem" : "0.75rem")};
  color: var(--t-text);
  word-break: break-word;
  display: flex;
  align-items: center;

  &:last-child, &:nth-last-child(-n+4) { border-bottom: none; }
`;

const AliasUserBadge = styled.span<{ $user: string }>`
  font-size: 0.55rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.1rem 0.35rem;
  border-radius: 0.3rem;
  background: ${(p) =>
    p.$user === "admin" ? glowRgba("cyan", 0.12) : glowRgba("gold", 0.12)};
  color: ${(p) => (p.$user === "admin" ? colors.cyan : colors.gold)};
  border: 1px solid ${(p) =>
    p.$user === "admin" ? glowRgba("cyan", 0.3) : glowRgba("gold", 0.3)};
`;

const ScriptLink = styled.button`
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  font-size: 0.65rem;
  color: ${colors.violet};
  text-decoration: underline;
  cursor: pointer;
  text-align: left;
  &:hover { color: ${colors.cyan}; }
`;

/* ── Scripts section (accordion, ADDM-lite) ───────────────────────── */

const AddmWrap = styled.div`
  border: 1px solid var(--t-border);
  border-radius: 0.55rem;
  background: var(--t-inputBg);
  overflow: hidden;
  & + & { margin-top: 0.4rem; }
`;

const AddmHeader = styled.button<{ $open: boolean }>`
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  background: ${(p) => (p.$open ? glowRgba("violet", 0.08) : "transparent")};
  border: none;
  border-bottom: 1px solid ${(p) => (p.$open ? "var(--t-border)" : "transparent")};
  cursor: pointer;
  text-align: left;
  color: var(--t-text);
  font-size: 0.82rem;
  font-weight: 600;
  transition: background 0.15s;
  &:hover { background: ${glowRgba("violet", 0.06)}; }
`;

const AddmLabel = styled.span`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`;

const AddmBlurb = styled.span`
  font-size: 0.68rem;
  color: var(--t-textFaint);
  font-weight: 400;
  line-height: 1.4;
`;


const AddmBody = styled.div<{ $open: boolean }>`
  max-height: ${(p) => (p.$open ? "60vh" : "0")};
  overflow-y: auto;
  transition: max-height 0.25s ease;
  padding: ${(p) => (p.$open ? "0.8rem" : "0 0.8rem")};
`;

const Article = styled.article`
  font-size: 0.78rem;
  line-height: 1.55;
  color: var(--t-text);
  h1 { font-size: 1rem; margin: 0 0 0.5rem; }
  h2 { font-size: 0.82rem; margin: 0.9rem 0 0.35rem; color: ${colors.violet}; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
  h3 { font-size: 0.76rem; margin: 0.7rem 0 0.3rem; }
  p { margin: 0 0 0.5rem; }
  ul, ol { margin: 0 0 0.55rem; padding-left: 1.1rem; }
  li { margin-bottom: 0.18rem; }
  code, .md-code { font-family: var(--font-geist-mono), monospace; font-size: 0.78em; background: rgba(${rgb.violet}, 0.08); border: 1px solid rgba(${rgb.violet}, 0.15); border-radius: 0.25rem; padding: 0.05em 0.3em; color: ${colors.violet}; }
  pre { background: rgba(0, 0, 0, 0.35); border: 1px solid var(--t-border); border-radius: 0.4rem; padding: 0.5rem 0.7rem; overflow-x: auto; font-family: var(--font-geist-mono), monospace; font-size: 0.72rem; margin: 0 0 0.55rem; }
  table { width: 100%; border-collapse: collapse; margin: 0.4rem 0 0.65rem; font-size: 0.72rem; }
  th, td { padding: 0.3rem 0.5rem; border: 1px solid var(--t-border); text-align: left; vertical-align: top; }
  th { background: rgba(${rgb.violet}, 0.08); font-weight: 700; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; }
  blockquote { border-left: 3px solid rgba(${rgb.violet}, 0.4); padding: 0.2rem 0.6rem; margin: 0.4rem 0; color: var(--t-textFaint); font-style: italic; }
  hr { border: 0; border-top: 1px solid var(--t-border); margin: 0.7rem 0; }
  strong { color: var(--t-text); }
`;

const GroupHeader = styled.div`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.66rem;
  font-weight: 700;
  color: ${colors.violet};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0.9rem 0 0.35rem;
  padding-bottom: 0.2rem;
  border-bottom: 1px dashed var(--t-border);
  &:first-of-type { margin-top: 0; }
`;

/* ── Component ────────────────────────────────────────────────────── */

export default function PlaybookLibraryModal({ onClose }: { onClose: () => void }) {
  useModalLifecycle();
  const [fullscreen, setFullscreen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [readmes, setReadmes] = useState<Record<string, string | "loading" | "error">>({});
  const scriptRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEscapeToClose({ open: true, onClose });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/playbooks/index");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as CatalogResponse;
        if (!cancelled) setCatalog(j);
      } catch (e) {
        if (!cancelled) setCatalogError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const ensureLoaded = useCallback(async (slug: string, readmeRel: string) => {
    if (readmes[slug] && readmes[slug] !== "error") return;
    setReadmes((prev) => ({ ...prev, [slug]: "loading" }));
    try {
      const res = await fetch(`/api/playbooks/readme?path=${encodeURIComponent(readmeRel)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { body: string };
      setReadmes((prev) => ({ ...prev, [slug]: j.body }));
    } catch {
      setReadmes((prev) => ({ ...prev, [slug]: "error" }));
    }
  }, [readmes]);

  const openScript = useCallback((slug: string, readmeRel: string) => {
    setOpenSlug((prev) => (prev === slug ? null : slug));
    void ensureLoaded(slug, readmeRel);
    requestAnimationFrame(() => {
      scriptRefs.current[slug]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [ensureLoaded]);

  const jumpToScript = useCallback((slug: string) => {
    if (!catalog) return;
    const found = catalog.groups.flatMap((g) => g.items).find((s) => s.slug === slug);
    if (!found) return;
    openScript(slug, found.readmeRel);
  }, [catalog, openScript]);

  return (
    <ModalBackdrop onClick={onClose}>
      <FsContainer $fs={fullscreen} $accent="violet" $maxWidth="56rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <DrawerTitle $accent="violet">📒 Playbook Library</DrawerTitle>
              <ModalSubtitle>
                Every RCS utils script + bash alias, with cross-links. Source of truth: <code>/srv/refusion-core/utils/</code>
              </ModalSubtitle>
            </div>
          </ModalHeaderLeft>
          <HeaderRight>
            <Tooltip accent={colors.violet} label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
              <CtrlBtn $active={fullscreen} onClick={() => setFullscreen((v) => !v)} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
                {fullscreen ? "⊡" : "⊞"}
              </CtrlBtn>
            </Tooltip>
            <Tooltip accent={colors.violet} label="Close (Esc)">
              <NeonX accent="violet" onClick={onClose} />
            </Tooltip>
          </HeaderRight>
        </ModalHeader>

        <ModalBody>
          {catalogError ? (
            <Loading>Couldn&apos;t load catalog: {catalogError}</Loading>
          ) : !catalog ? (
            <Loading>Loading catalog…</Loading>
          ) : (
            <>
              {/* Aliases */}
              <SectionTitle>
                Aliases
                <SectionCount>{catalog.counts.aliases}</SectionCount>
              </SectionTitle>
              {catalog.aliases.length === 0 ? (
                <Loading>No user aliases found in admin / marmar bashrcs.</Loading>
              ) : (
                <AliasTable>
                  <AliasHeaderCell>User</AliasHeaderCell>
                  <AliasHeaderCell>Alias</AliasHeaderCell>
                  <AliasHeaderCell>Expands to</AliasHeaderCell>
                  <AliasHeaderCell>Script</AliasHeaderCell>
                  {catalog.aliases.map((a) => (
                    <Row key={`${a.user}:${a.name}`}>
                      <AliasCell><AliasUserBadge $user={a.user}>{a.user}</AliasUserBadge></AliasCell>
                      <AliasCell $mono>{a.name}</AliasCell>
                      <AliasCell $mono>{a.expansion}</AliasCell>
                      <AliasCell>
                        {a.callsScript ? (
                          <ScriptLink onClick={() => jumpToScript(a.callsScript!)}>
                            ↳ {a.callsScript}
                          </ScriptLink>
                        ) : (
                          <span style={{ color: "var(--t-textFaint)", fontSize: "0.65rem" }}>—</span>
                        )}
                      </AliasCell>
                    </Row>
                  ))}
                </AliasTable>
              )}

              {/* Scripts */}
              <SectionTitle>
                Scripts
                <SectionCount>{catalog.counts.scripts} across {catalog.counts.groups} groups</SectionCount>
              </SectionTitle>
              {catalog.groups.map((group) => (
                <div key={group.name}>
                  <GroupHeader>{group.name}/</GroupHeader>
                  {group.items.map((s) => {
                    const isOpen = openSlug === s.slug;
                    const body = readmes[s.slug];
                    return (
                      <div
                        key={s.slug}
                        ref={(el) => { scriptRefs.current[s.slug] = el; }}
                      >
                        <AddmWrap>
                          <AddmHeader $open={isOpen} onClick={() => openScript(s.slug, s.readmeRel)} aria-expanded={isOpen}>
                            <AddmLabel>
                              <span>{s.name}</span>
                              <AddmBlurb>{s.summary || "—"}</AddmBlurb>
                            </AddmLabel>
                            <AddmToggle open={isOpen} />
                          </AddmHeader>
                          <AddmBody $open={isOpen}>
                            {isOpen && (
                              body === "loading" || body === undefined ? (
                                <Loading>Loading…</Loading>
                              ) : body === "error" ? (
                                <Loading>Couldn&apos;t load <code>{s.readmePath}</code></Loading>
                              ) : (
                                <Article dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
                              )
                            )}
                          </AddmBody>
                        </AddmWrap>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </ModalBody>
      </FsContainer>
    </ModalBackdrop>
  );
}

/** Inline fragment helper — keeps the alias-row 4 cells together as a logical row */
function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
