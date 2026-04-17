"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import styled from "styled-components";
import TopNav from "../components/TopNav";
import DashCard from "../components/DashCard";
import UsersCard from "../components/UsersCard";
import ActivityModal from "../components/ActivityModal";
import AnnouncementsPanel from "../components/AnnouncementsPanel";
import ClaudeIcon from "../components/claude/ClaudeIcon";
import ClaudeMenuModal from "../components/claude/ClaudeMenuModal";
import SandboxIcon from "../components/sandbox/SandboxIcon";
import SandboxModal from "../components/sandbox/SandboxModal";
import LibraryIcon from "../components/LibraryIcon";
import LibraryModal from "../components/LibraryModal";
import SuggestionBoxModal from "../components/suggestion/SuggestionBoxModal";
import Link from "next/link";
import { colors, rgb, type GlowColor } from "@/app/theme";

type DashTile = {
  key: string;
  title: string;
  subtitle: string;
  glow: GlowColor;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
};

type ActivityEvent = {
  timeLabel: string;
  actor: string;
  event: string;
  type: "pm2" | "git" | "system";
};

const TYPE_COLOR: Record<string, string> = {
  pm2: colors.gold,
  git: colors.pink,
  system: colors.green,
};

const TILE_LIMIT = 10;

/* ── Styled ────────────────────────────────────────────────────── */

const Main = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 7rem 1rem 4rem;
  max-width: 80rem;
  margin: 0 auto;
  width: 100%;
`;

const Hero = styled.section`
  margin-bottom: 1.5rem;
`;

const HeroTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1.15;
  margin: 1.25rem 0 0.75rem;
  color: ${colors.pink};
  text-shadow: 0 0 8px #ff66cc, 0 0 20px ${colors.pink};

  @media (min-width: 768px) {
    font-size: 3rem;
  }

  [data-theme="light"] & {
    text-shadow: none;
  }
`;

const HeroSub = styled.p`
  color: var(--t-textMuted);
  font-size: 1rem;
  max-width: 32rem;
  margin: 0;
`;

const SBDMWrap = styled.section`
  position: relative;
  margin-bottom: 0.75rem;
`;

const SBDMBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--t-inputBg);
  border: 1px solid rgba(${rgb.pink}, 0.22);
`;

const SBDMIcon = styled.span`
  font-size: 0.875rem;
  color: rgba(${rgb.pink}, 0.7);
`;

const SBDMInput = styled.input`
  flex: 1;
  background: transparent;
  outline: none;
  font-size: 0.875rem;
  color: var(--t-text);
  border: none;

  &::placeholder {
    color: var(--t-textGhost);
  }
`;

const SBDMArrow = styled.button`
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  border: none;
  background: none;
  color: ${colors.pink};
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(${rgb.pink}, 0.1);
  }
`;

const SBDMPanel = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  margin-top: 0.5rem;
  border-radius: 0.75rem;
  z-index: 30;
  overflow: hidden;
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.pink}, 0.28);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6), 0 0 24px rgba(${rgb.pink}, 0.12);
  backdrop-filter: blur(8px);

  [data-theme="light"] & {
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
  }
`;

const SBDMInnerBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-bottom: 1px solid var(--t-border);
`;

const SBDMInnerInput = styled.input`
  flex: 1;
  background: var(--t-inputBg);
  border-radius: 0.375rem;
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  color: var(--t-text);
  outline: none;
  border: none;

  &::placeholder {
    color: var(--t-textGhost);
  }
`;

const SBDMSortBtn = styled.button`
  padding: 0.375rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  background: rgba(${rgb.cyan}, 0.08);
  border: 1px solid rgba(${rgb.cyan}, 0.3);
  color: ${colors.cyan};
  cursor: pointer;
`;

const SBDMList = styled.div`
  max-height: 18rem;
  overflow-y: auto;
`;

const SBDMItem = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-size: 0.75rem;
  color: var(--t-textMuted);
  border: none;
  background: none;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--t-inputBg);
  }
`;

const SBDMDot = styled.span<{ $glow: GlowColor }>`
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(p) => colors[p.$glow]};
`;

const SBDMSub = styled.span`
  margin-left: auto;
  font-size: 0.625rem;
  color: var(--t-textFaint);
`;

const TileGrid = styled.section`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-bottom: 0.75rem;

  @media (min-width: 600px) { grid-template-columns: repeat(2, 1fr); }
  @media (min-width: 900px) { grid-template-columns: repeat(3, 1fr); }
  @media (min-width: 1200px) { grid-template-columns: repeat(5, 1fr); }
`;

const TileOuter = styled.div<{ $glow: GlowColor; $isSuggest?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 1rem;
  padding: 1.25rem 0.75rem;
  transition: all 0.2s;
  height: 100%;
  cursor: pointer;
  background: ${(p) => (p.$isSuggest ? "transparent" : `rgba(${rgb[p.$glow]}, 0.06)`)};
  border: ${(p) => (p.$isSuggest ? `2px dashed rgba(${rgb[p.$glow]}, 0.35)` : `1px solid rgba(${rgb[p.$glow]}, 0.18)`)};

  &:hover {
    background: rgba(${(p) => rgb[p.$glow]}, 0.1);
    box-shadow: 0 0 18px rgba(${(p) => rgb[p.$glow]}, 0.18);
  }

  [data-theme="light"] & {
    background: ${(p) => (p.$isSuggest ? "transparent" : `rgba(${rgb[p.$glow]}, 0.03)`)};
    border-color: ${(p) => (p.$isSuggest ? `rgba(${rgb[p.$glow]}, 0.25)` : `rgba(${rgb[p.$glow]}, 0.1)`)};

    &:hover {
      background: rgba(${(p) => rgb[p.$glow]}, 0.06);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
    }
  }
`;

const TileLabel = styled.span<{ $glow: GlowColor }>`
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${(p) => colors[p.$glow]};
`;

const TileSub = styled.span`
  font-size: 0.625rem;
  color: var(--t-textFaint);
`;

const EmptyTiles = styled.div`
  grid-column: 1 / -1;
  text-align: center;
  font-size: 0.75rem;
  color: var(--t-textFaint);
  padding: 2rem 0;
`;

const PagerRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const PagerBtn = styled.button`
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  transition: all 0.15s;
  cursor: pointer;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);
  color: var(--t-textMuted);

  &:hover {
    border-color: rgba(${rgb.cyan}, 0.5);
    color: ${colors.cyan};
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const PagerInfo = styled.span`
  font-size: 0.75rem;
  font-family: var(--font-geist-mono), monospace;
  color: var(--t-textMuted);
  font-variant-numeric: tabular-nums;
`;

const BottomGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;

  @media (min-width: 1024px) {
    grid-template-columns: 1fr 2fr;
  }
`;

const ActivityDivider = styled.div`
  display: flex;
  flex-direction: column;
  border-color: var(--t-border);
`;

const ActivityRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.375rem 0;
`;

const ActivityTime = styled.span`
  font-size: 0.625rem;
  font-family: var(--font-geist-mono), monospace;
  color: var(--t-textGhost);
  width: 3rem;
  flex-shrink: 0;
  text-align: right;
`;

const ActivityType = styled.span<{ $type: string }>`
  font-size: 0.625rem;
  font-weight: 700;
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  width: 2rem;
  color: ${(p) => TYPE_COLOR[p.$type] ?? "var(--t-text)"};
`;

const ActivityText = styled.span`
  font-size: 0.75rem;
  color: var(--t-textMuted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MoreLabel = styled.p`
  font-size: 0.625rem;
  color: var(--t-textGhost);
  margin: 0.5rem 0 0;
`;

/* ── Component ─────────────────────────────────────────────────── */

export default function Home() {
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [claudeOpen, setClaudeOpen] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);

  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState("");
  const [asc, setAsc] = useState(true);
  const sbdmRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => r.json())
      .then(setActivity)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (sbdmRef.current && !sbdmRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => { setPage(0); }, [filter]);

  const tiles: DashTile[] = useMemo(() => [
    { key: "Processes", title: "Processes", subtitle: "PM2", glow: "cyan", icon: <span style={{ fontSize: "1.5rem" }}>⚡</span>, href: "/dashboard/processes" },
    { key: "Deploy", title: "Deploy", subtitle: "Projects", glow: "pink", icon: <span style={{ fontSize: "1.5rem" }}>🚀</span>, href: "/dashboard/deploy" },
    { key: "Database", title: "Database", subtitle: "PostgreSQL", glow: "gold", icon: <span style={{ fontSize: "1.5rem" }}>🗄️</span>, href: "/dashboard/database" },
    { key: "Storage", title: "Storage", subtitle: "Files", glow: "pink", icon: <span style={{ fontSize: "1.5rem" }}>📦</span>, href: "/dashboard/storage" },
    { key: "Editor", title: "Editor", subtitle: "Code", glow: "gold", icon: <span style={{ fontSize: "1.5rem" }}>✎</span>, href: "/dashboard/editor" },
    { key: "Utils", title: "Utils", subtitle: "Tooling", glow: "cyan", icon: <span style={{ fontSize: "1.5rem" }}>🔧</span>, href: "/dashboard/utils" },
    { key: "Claude", title: "Claude", subtitle: "AI Assistant", glow: "orange", icon: <ClaudeIcon size={28} color={colors.orange} />, onClick: () => setClaudeOpen(true) },
    { key: "Sandbox", title: "Sandbox", subtitle: "Component Lab", glow: "pink", icon: <SandboxIcon size={28} color={colors.pink} />, onClick: () => setSandboxOpen(true) },
    { key: "Library", title: "Library", subtitle: "Catalog", glow: "violet", icon: <LibraryIcon size={28} color={colors.violet} />, onClick: () => setLibraryOpen(true) },
    { key: "Suggest", title: "Suggest", subtitle: "Feature ideas", glow: "pink", icon: <span style={{ fontSize: "1.5rem" }}>💡</span>, onClick: () => setSuggestionOpen(true) },
  ], []);

  const filteredTiles = useMemo(
    () => tiles.filter((t) => t.title.toLowerCase().includes(filter.toLowerCase())),
    [tiles, filter]
  );

  const panelList = useMemo(() => {
    return tiles
      .filter((t) => t.title.toLowerCase().includes(inner.toLowerCase()))
      .slice()
      .sort((a, b) => (asc ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)));
  }, [tiles, inner, asc]);

  const paginationActive = filteredTiles.length > TILE_LIMIT;
  const totalPages = paginationActive ? Math.ceil(filteredTiles.length / TILE_LIMIT) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const pageTiles = paginationActive
    ? filteredTiles.slice(safePage * TILE_LIMIT, (safePage + 1) * TILE_LIMIT)
    : filteredTiles;

  return (
    <>
      {activityOpen && <ActivityModal onClose={() => setActivityOpen(false)} />}
      {claudeOpen && <ClaudeMenuModal onClose={() => setClaudeOpen(false)} />}
      {sandboxOpen && <SandboxModal onClose={() => setSandboxOpen(false)} />}
      {libraryOpen && <LibraryModal onClose={() => setLibraryOpen(false)} />}
      {suggestionOpen && <SuggestionBoxModal onClose={() => setSuggestionOpen(false)} />}
      <TopNav />
      <Main>
        <Hero>
          <div style={{ height: "1.25rem" }} />
          <HeroTitle>TGV Office</HeroTitle>
          <HeroSub>
            Internal operations hub. Manage processes, deploys, and infrastructure
            for all TGV &amp; Refusionist projects.
          </HeroSub>
        </Hero>

        <SBDMWrap ref={sbdmRef}>
          <SBDMBar>
            <SBDMIcon>🔍</SBDMIcon>
            <SBDMInput
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter dash…"
            />
            <SBDMArrow onClick={() => setOpen((v) => !v)} aria-label="Open tile list">
              ▾
            </SBDMArrow>
          </SBDMBar>
          {open && (
            <SBDMPanel>
              <SBDMInnerBar>
                <SBDMInnerInput
                  value={inner}
                  onChange={(e) => setInner(e.target.value)}
                  placeholder="Search…"
                  autoFocus
                />
                <SBDMSortBtn onClick={() => setAsc((v) => !v)}>
                  {asc ? "Z-A" : "A-Z"}
                </SBDMSortBtn>
              </SBDMInnerBar>
              <SBDMList>
                {panelList.length === 0 ? (
                  <div style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "var(--t-textFaint)", textAlign: "center" }}>
                    No matches
                  </div>
                ) : (
                  panelList.map((t) => (
                    <SBDMItem key={t.key} onClick={() => { setFilter(t.title); setOpen(false); }}>
                      <SBDMDot $glow={t.glow} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
                      <SBDMSub>{t.subtitle}</SBDMSub>
                    </SBDMItem>
                  ))
                )}
              </SBDMList>
            </SBDMPanel>
          )}
        </SBDMWrap>

        <TileGrid>
          {pageTiles.length === 0 ? (
            <EmptyTiles>No tiles match &ldquo;{filter}&rdquo;</EmptyTiles>
          ) : (
            pageTiles.map((tile) => {
              const isSuggest = tile.key === "Suggest";
              const inner = (
                <TileOuter $glow={tile.glow} $isSuggest={isSuggest}>
                  {tile.icon}
                  <TileLabel $glow={tile.glow}>{tile.title}</TileLabel>
                  <TileSub>{tile.subtitle}</TileSub>
                </TileOuter>
              );
              if (tile.href) {
                return (
                  <Link key={tile.key} href={tile.href} style={{ textDecoration: "none" }}>
                    {inner}
                  </Link>
                );
              }
              return (
                <button
                  key={tile.key}
                  onClick={tile.onClick}
                  style={{ padding: 0, background: "none", border: "none", textAlign: "left" }}
                >
                  {inner}
                </button>
              );
            })
          )}
        </TileGrid>

        {totalPages > 1 && (
          <PagerRow>
            <PagerBtn
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              ‹
            </PagerBtn>
            <PagerInfo>
              {safePage + 1} / {totalPages}
            </PagerInfo>
            <PagerBtn
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage === totalPages - 1}
            >
              ›
            </PagerBtn>
          </PagerRow>
        )}

        <div style={{ marginBottom: "1rem" }}><AnnouncementsPanel /></div>

        <BottomGrid>
          <UsersCard />
          <button
            onClick={() => setActivityOpen(true)}
            style={{ textAlign: "left", width: "100%", padding: 0, background: "none", border: "none" }}
          >
            <DashCard title="Recent Activity" subtitle="Click to expand · PM2 + git" glow="cyan" >
              <ActivityDivider>
                {activity.length === 0 ? (
                  <div style={{ padding: "0.75rem 0", fontSize: "0.75rem", color: "var(--t-textGhost)" }}>
                    Loading activity…
                  </div>
                ) : (
                  activity.slice(0, 5).map((item, i) => (
                    <ActivityRow key={i}>
                      <ActivityTime>{item.timeLabel}</ActivityTime>
                      <ActivityType $type={item.type}>{item.type}</ActivityType>
                      <ActivityText>{item.event}</ActivityText>
                    </ActivityRow>
                  ))
                )}
              </ActivityDivider>
              {activity.length > 5 && (
                <MoreLabel>+{activity.length - 5} more · click to view all</MoreLabel>
              )}
            </DashCard>
          </button>
        </BottomGrid>
      </Main>
    </>
  );
}
