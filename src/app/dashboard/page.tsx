"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import styled from "styled-components";
import TopNav from "../components/TopNav";
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
import DashboardPageModal from "../components/DashboardPageModal";
import { DatabaseIcon, StorageIcon, EditorIcon, UtilsIcon, SuggestionIcon, ProcessesIcon, DeployIcon } from "../components/icons";
import { colors, rgb, type GlowColor } from "@/app/theme";

type DashTile = {
  key: string;
  title: string;
  subtitle: string;
  glow: GlowColor;
  icon: React.ReactNode;
  pageKey?: string;
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
const TILES_COLLAPSED_KEY = "tgv_dash_tiles_collapsed";
const TEAM_COLLAPSED_KEY = "tgv_dash_team_collapsed";
const ACTIVITY_COLLAPSED_KEY = "tgv_dash_activity_collapsed";
const MASTER_COLLAPSED_KEY = "tgv_dash_master_collapsed";

/* ── Styled ────────────────────────────────────────────────────── */

const Main = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 0 1rem 4rem;
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
  filter: url(#tgv-hero-outline);
  text-shadow:
    0 0 10px rgba(${rgb.pink}, 0.55),
    0 0 22px rgba(${rgb.pink}, 0.3);

  @media (min-width: 768px) {
    font-size: 3rem;
  }

  [data-theme="light"] & {
    color: ${colors.pink};
    filter: none;
    text-shadow: none;
  }
`;

/* SVG filter that rasterizes text then subtracts an eroded inner copy, so the
   outline is one unified hollow shape — adjacent glyph stems (e.g. "ff") merge
   instead of showing per-glyph outlines. */
const HeroFilterDefs = () => (
  <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
    <defs>
      <filter id="tgv-hero-outline" x="-5%" y="-5%" width="110%" height="110%">
        <feMorphology operator="erode" radius="1.5" in="SourceAlpha" result="inner" />
        <feComposite operator="out" in="SourceGraphic" in2="inner" />
      </filter>
    </defs>
  </svg>
);

const HeroSub = styled.p`
  color: ${colors.pink};
  font-size: 1rem;
  max-width: 32rem;
  margin: 0;
  text-shadow: 0 0 8px rgba(${rgb.pink}, 0.45);

  [data-theme="light"] & {
    color: ${colors.pink};
    text-shadow: none;
  }
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
  background: rgba(${rgb.pink}, 0.1);
  border: 1px solid rgba(${rgb.pink}, 0.4);
  color: ${colors.pink};
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;

  &:hover {
    background: rgba(${rgb.pink}, 0.18);
    box-shadow: 0 0 8px rgba(${rgb.pink}, 0.35);
  }
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
  color: ${colors.pink};
`;

const SectionTile = styled.section<{ $accent: GlowColor }>`
  position: relative;
  border-radius: 1rem;
  padding: 0.75rem;
  background: rgba(${(p) => rgb[p.$accent]}, 0.04);
  border: 1px solid rgba(${(p) => rgb[p.$accent]}, 0.15);
  box-shadow: 0 0 24px rgba(${(p) => rgb[p.$accent]}, 0.08);

  [data-theme="light"] & {
    background: rgba(${(p) => rgb[p.$accent]}, 0.03);
    border-color: rgba(${(p) => rgb[p.$accent]}, 0.1);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  }
`;

const TilesTile = styled(SectionTile)``;

const MasterAdl = styled(SectionTile)`
  padding: 0.75rem;
  margin-bottom: 1rem;
`;

const MasterBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 0.5rem;
`;

const SectionHeader = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.125rem 0.375rem 0.5rem;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
`;

const TilesHeader = SectionHeader;

const SectionTitle = styled.h2<{ $accent: GlowColor }>`
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${(p) => colors[p.$accent]};
  margin: 0;
`;

const TilesTitle = styled(SectionTitle)``;

const EclRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const EclLabel = styled.span`
  font-size: 0.5rem;
  color: var(--t-textGhost);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
`;

const EclSwitch = styled.button<{ $on: boolean; $accent: GlowColor }>`
  position: relative;
  display: inline-block;
  width: 28px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb[p.$accent]}, 0.7)` : "var(--t-borderStrong)")};
  background: ${(p) => (p.$on ? `rgba(${rgb[p.$accent]}, 0.2)` : "var(--t-inputBg)")};
  box-shadow: ${(p) => (p.$on ? `0 0 8px rgba(${rgb[p.$accent]}, 0.45)` : "none")};
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.18s;

  &::after {
    content: "";
    position: absolute;
    top: 1px;
    left: ${(p) => (p.$on ? "15px" : "1px")};
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${(p) => (p.$on ? colors[p.$accent] : "var(--t-textFaint)")};
    box-shadow: ${(p) =>
      p.$on
        ? `0 0 8px rgba(${rgb[p.$accent]}, 0.85), 0 0 2px rgba(${rgb[p.$accent]}, 1)`
        : "0 1px 2px rgba(0,0,0,0.3)"};
    transition: all 0.18s;
  }
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
    border-color: rgba(${rgb.pink}, 0.5);
    color: ${colors.pink};
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

const BottomGrid = styled.div<{ $teamFullRow: boolean }>`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  align-items: stretch;
  width: 100%;

  @media (min-width: 1024px) {
    grid-template-columns: ${(p) => (p.$teamFullRow ? "1fr" : "1fr 2fr")};
  }

  & > * {
    min-width: 0;
    height: 100%;
  }
`;

const ActivitySub = styled.p`
  font-size: 0.75rem;
  color: rgba(${rgb.cyan}, 0.65);
  margin: 0 0 0.75rem;

  [data-theme="light"] & {
    color: rgba(${rgb.cyan}, 0.8);
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
  color: rgba(${rgb.cyan}, 0.55);
  width: 3rem;
  flex-shrink: 0;
  text-align: right;

  [data-theme="light"] & {
    color: rgba(${rgb.cyan}, 0.7);
  }
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
  color: rgba(${rgb.cyan}, 0.75);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  [data-theme="light"] & {
    color: rgba(${rgb.cyan}, 0.9);
  }
`;

const MoreLabel = styled.p`
  font-size: 0.625rem;
  color: rgba(${rgb.cyan}, 0.55);
  margin: 0.5rem 0 0;

  [data-theme="light"] & {
    color: rgba(${rgb.cyan}, 0.7);
  }
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
  const [teamPageSize, setTeamPageSize] = useState(5);
  const [modalPage, setModalPage] = useState<{ pageKey: string; title: string; glow: GlowColor } | null>(null);
  const [tilesExpanded, setTilesExpanded] = useState(true);
  const [teamExpanded, setTeamExpanded] = useState(true);
  const [activityExpanded, setActivityExpanded] = useState(true);
  const [masterExpanded, setMasterExpanded] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(TILES_COLLAPSED_KEY) === "1") setTilesExpanded(false);
      if (localStorage.getItem(TEAM_COLLAPSED_KEY) === "1") setTeamExpanded(false);
      if (localStorage.getItem(ACTIVITY_COLLAPSED_KEY) === "1") setActivityExpanded(false);
      if (localStorage.getItem(MASTER_COLLAPSED_KEY) === "1") setMasterExpanded(false);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(TILES_COLLAPSED_KEY, tilesExpanded ? "0" : "1"); } catch {}
  }, [tilesExpanded]);
  useEffect(() => {
    try { localStorage.setItem(TEAM_COLLAPSED_KEY, teamExpanded ? "0" : "1"); } catch {}
  }, [teamExpanded]);
  useEffect(() => {
    try { localStorage.setItem(ACTIVITY_COLLAPSED_KEY, activityExpanded ? "0" : "1"); } catch {}
  }, [activityExpanded]);
  useEffect(() => {
    try { localStorage.setItem(MASTER_COLLAPSED_KEY, masterExpanded ? "0" : "1"); } catch {}
  }, [masterExpanded]);

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => r.json())
      .then(setActivity)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handlers: Record<string, () => void> = {
      "open-claude": () => setClaudeOpen(true),
      "open-sandbox": () => setSandboxOpen(true),
      "open-library": () => setLibraryOpen(true),
    };
    const entries = Object.entries(handlers);
    entries.forEach(([ev, fn]) => window.addEventListener(ev, fn));
    return () => entries.forEach(([ev, fn]) => window.removeEventListener(ev, fn));
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
    { key: "Processes", title: "Processes", subtitle: "PM2", glow: "cyan", icon: <ProcessesIcon size={28} style={{ color: colors.cyan }} />, pageKey: "processes" },
    { key: "Deploy", title: "Deploy", subtitle: "Projects", glow: "pink", icon: <DeployIcon size={28} style={{ color: colors.pink }} />, pageKey: "deploy" },
    { key: "Database", title: "Database", subtitle: "PostgreSQL", glow: "gold", icon: <DatabaseIcon size={28} style={{ color: colors.gold }} />, pageKey: "database" },
    { key: "Storage", title: "Storage", subtitle: "Files", glow: "pink", icon: <StorageIcon size={28} style={{ color: colors.pink }} />, pageKey: "storage" },
    { key: "Editor", title: "Editor", subtitle: "Code", glow: "gold", icon: <EditorIcon size={28} style={{ color: colors.gold }} />, pageKey: "editor" },
    { key: "Utils", title: "Utils", subtitle: "Tooling", glow: "cyan", icon: <UtilsIcon size={28} style={{ color: colors.cyan }} />, pageKey: "utils" },
    { key: "Claude", title: "Claude", subtitle: "AI Assistant", glow: "orange", icon: <ClaudeIcon size={28} color={colors.orange} />, onClick: () => setClaudeOpen(true) },
    { key: "Sandbox", title: "Sandbox", subtitle: "Component Lab", glow: "pink", icon: <SandboxIcon size={28} color={colors.pink} />, onClick: () => setSandboxOpen(true) },
    { key: "Library", title: "Library", subtitle: "Catalog", glow: "violet", icon: <LibraryIcon size={28} color={colors.violet} />, onClick: () => setLibraryOpen(true) },
    { key: "Suggest", title: "Suggest", subtitle: "Feature ideas", glow: "pink", icon: <SuggestionIcon size={28} style={{ color: colors.pink }} />, onClick: () => setSuggestionOpen(true) },
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
      {modalPage && (
        <DashboardPageModal
          pageKey={modalPage.pageKey}
          title={modalPage.title}
          glow={modalPage.glow}
          onClose={() => setModalPage(null)}
        />
      )}
      <TopNav />
      <HeroFilterDefs />
      <Main>
        <Hero>
          <div style={{ height: "1.25rem" }} />
          <HeroTitle>TGV Office</HeroTitle>
          <HeroSub>
            Internal operations hub. Manage processes, deploys, and infrastructure
            for all TGV &amp; Refusionist projects.
          </HeroSub>
        </Hero>

        <div style={{ marginBottom: "1rem" }}><AnnouncementsPanel /></div>

        {(() => {
          const anyInnerExpanded = tilesExpanded || teamExpanded || activityExpanded;
          const toggleAll = () => {
            const next = !anyInnerExpanded;
            setTilesExpanded(next);
            setTeamExpanded(next);
            setActivityExpanded(next);
            setMasterExpanded(next);
          };
          const showBody = masterExpanded || anyInnerExpanded;
          return (
        <MasterAdl $accent="pink">
          <SectionHeader
            type="button"
            onClick={toggleAll}
            aria-expanded={anyInnerExpanded}
            aria-label={anyInnerExpanded ? "Collapse all" : "Expand all"}
          >
            <SectionTitle $accent="pink">Dashboard</SectionTitle>
            <EclRow>
              <EclLabel>{anyInnerExpanded ? "Collapse All" : "Expand All"}</EclLabel>
              <EclSwitch as="span" $on={anyInnerExpanded} $accent="pink" aria-hidden="true" />
            </EclRow>
          </SectionHeader>
          {showBody && (
            <MasterBody>

        <TilesTile $accent="orange">
          <TilesHeader
            type="button"
            onClick={() => setTilesExpanded((v) => !v)}
            aria-expanded={tilesExpanded}
            aria-label={tilesExpanded ? "Collapse Office tiles" : "Expand Office tiles"}
          >
            <TilesTitle $accent="orange">Office</TilesTitle>
            <EclRow>
              <EclLabel>{tilesExpanded ? "Collapse" : "Expand"}</EclLabel>
              <EclSwitch
                as="span"
                $on={tilesExpanded}
                $accent="orange"
                aria-hidden="true"
              />
            </EclRow>
          </TilesHeader>
          {tilesExpanded && (<>
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
              const handleClick = tile.pageKey
                ? () => setModalPage({ pageKey: tile.pageKey!, title: tile.title, glow: tile.glow })
                : tile.onClick;
              return (
                <button
                  key={tile.key}
                  onClick={handleClick}
                  style={{ padding: 0, background: "none", border: "none", textAlign: "left", cursor: "pointer" }}
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
          </>)}
        </TilesTile>

        <BottomGrid $teamFullRow={teamPageSize > 5}>
          <SectionTile $accent="violet">
            <SectionHeader
              type="button"
              onClick={() => setTeamExpanded((v) => !v)}
              aria-expanded={teamExpanded}
              aria-label={teamExpanded ? "Collapse Team" : "Expand Team"}
            >
              <SectionTitle $accent="violet">Team</SectionTitle>
              <EclRow>
                <EclLabel>{teamExpanded ? "Collapse" : "Expand"}</EclLabel>
                <EclSwitch as="span" $on={teamExpanded} $accent="violet" aria-hidden="true" />
              </EclRow>
            </SectionHeader>
            {teamExpanded && <UsersCard onPageSizeChange={setTeamPageSize} />}
          </SectionTile>

          <SectionTile $accent="cyan">
            <SectionHeader
              type="button"
              onClick={() => setActivityExpanded((v) => !v)}
              aria-expanded={activityExpanded}
              aria-label={activityExpanded ? "Collapse Recent Activity" : "Expand Recent Activity"}
            >
              <SectionTitle $accent="cyan">Recent Activity</SectionTitle>
              <EclRow>
                <EclLabel>{activityExpanded ? "Collapse" : "Expand"}</EclLabel>
                <EclSwitch as="span" $on={activityExpanded} $accent="cyan" aria-hidden="true" />
              </EclRow>
            </SectionHeader>
            {activityExpanded && (
              <button
                onClick={() => setActivityOpen(true)}
                style={{ textAlign: "left", width: "100%", padding: "0 0.375rem 0.375rem", background: "none", border: "none", cursor: "pointer" }}
              >
                <ActivitySub>Click to expand · PM2 + git</ActivitySub>
                <ActivityDivider>
                  {activity.length === 0 ? (
                    <div style={{ padding: "0.75rem 0", fontSize: "0.75rem", color: `rgba(${rgb.cyan}, 0.5)` }}>
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
              </button>
            )}
          </SectionTile>
        </BottomGrid>

            </MasterBody>
          )}
        </MasterAdl>
          );
        })()}
      </Main>
    </>
  );
}
