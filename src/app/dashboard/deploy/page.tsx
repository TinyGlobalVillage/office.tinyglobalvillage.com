"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import TopNav from "../../components/TopNav";
import { usePreview } from "../../components/PreviewDrawer";
import dynamic from "next/dynamic";
import TPG from "@tgv/module-component-library/components/ui/TPG";

const DeployTargetsControlModal = dynamic(
  () => import("../../components/hardening/deploy-targets/DeployTargetsControlModal"),
  { ssr: false }
);

type Project = {
  name: string;
  port: string | null;
  url: string;
  pm2Status: string | null;
  pm2Restarts: number;
  lastCommit: { timeAgo: string; author: string; subject: string } | null;
};

type DeployState = {
  jobId: string;
  client: string;
  startedBy: string;
  state: "resolving" | "building" | "done" | "failed";
  phase: string;
  detail?: string;
  finishedAt?: string;
};

const STATUS_COLOR: Record<string, string> = {
  online: "#00dc64",
  stopped: "#6b7280",
  errored: colors.red,
};

// TPG (Table Pagination Group) page-size options — multiples of the 3-col
// tile grid so rows stay square; default preserves the prior 9-per-page.
const DEFAULT_PAGE_SIZE = 9;
const PAGE_SIZE_OPTIONS = [9, 18, 27, 50];

/* ── Styled Components ─────────────────────────────────────────── */

const PageMain = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 7rem 1rem 4rem;
  max-width: 72rem;
  margin: 0 auto;
  width: 100%;
  gap: 1.5rem;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
`;

const PageSubtitle = styled.p`
  font-size: 0.875rem;
  color: var(--t-textGhost);

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const EditorLink = styled(Link)`
  padding: 0.5rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid rgba(${rgb.gold}, 0.35);
  color: ${colors.gold};
  background: rgba(${rgb.gold}, 0.08);
  text-decoration: none;
  transition: background 0.15s;

  &:hover {
    background: rgba(${rgb.gold}, 0.15);
  }
`;

const RefreshBtn = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid rgba(${rgb.pink}, 0.3);
  color: rgba(${rgb.pink}, 0.8);
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(${rgb.pink}, 0.1);
  }
`;

const DdmWrap = styled.div`
  position: relative;
  display: inline-block;
`;

const DdmTrigger = styled.button<{ $open: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  background: linear-gradient(135deg, rgba(${rgb.violet}, 0.18), rgba(${rgb.pink}, 0.14));
  border: 1px solid rgba(${rgb.violet}, 0.45);
  color: ${colors.violet};
  box-shadow: ${(p) => (p.$open ? `0 0 18px rgba(${rgb.violet}, 0.55)` : `0 0 10px rgba(${rgb.violet}, 0.25)`)};
  transition: background 0.15s, box-shadow 0.15s, transform 0.12s;

  &:hover {
    background: linear-gradient(135deg, rgba(${rgb.violet}, 0.28), rgba(${rgb.pink}, 0.2));
    box-shadow: 0 0 18px rgba(${rgb.violet}, 0.55);
  }

  &:active {
    transform: translateY(1px);
  }

  [data-theme="light"] & {
    background: linear-gradient(135deg, rgba(${rgb.violet}, 0.12), rgba(${rgb.pink}, 0.08));
    border-color: rgba(${rgb.violet}, 0.5);
  }
`;

const DdmLabel = styled.span`
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DdmTriangle = styled.span<{ $open: boolean }>`
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid ${colors.violet};
  filter: drop-shadow(0 0 3px rgba(${rgb.violet}, 0.7));
  transform: ${(p) => (p.$open ? "rotate(180deg)" : "rotate(0deg)")};
  transition: transform 0.15s;
`;

const DdmMenu = styled.div`
  position: absolute;
  left: 0;
  top: calc(100% + 0.5rem);
  min-width: 16rem;
  max-width: 24rem;
  z-index: 30;
  border-radius: 0.875rem;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(20, 12, 32, 0.98), rgba(10, 8, 20, 0.98));
  border: 1px solid rgba(${rgb.violet}, 0.4);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 28px rgba(${rgb.violet}, 0.22);
  backdrop-filter: blur(8px);
  animation: ddmFadeSlide 0.15s ease-out;

  @keyframes ddmFadeSlide {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: rgba(${rgb.violet}, 0.35);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);
  }
`;

const DdmHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-bottom: 1px solid rgba(${rgb.violet}, 0.2);
`;

const DdmSearchInput = styled.input`
  flex: 1;
  background: rgba(${rgb.violet}, 0.08);
  border-radius: 9999px;
  padding: 0.4rem 0.8rem;
  font-size: 0.75rem;
  color: var(--t-text);
  outline: none;
  border: 1px solid rgba(${rgb.violet}, 0.25);

  &::placeholder {
    color: rgba(${rgb.violet}, 0.55);
  }
`;

const DdmSortBtn = styled.button`
  padding: 0.4rem 0.7rem;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  background: rgba(${rgb.violet}, 0.1);
  border: 1px solid rgba(${rgb.violet}, 0.35);
  color: ${colors.violet};
  cursor: pointer;

  &:hover {
    background: rgba(${rgb.violet}, 0.18);
  }
`;

const DdmList = styled.div`
  max-height: 20rem;
  overflow-y: auto;
`;

const DdmEmpty = styled.div`
  padding: 0.9rem 1rem;
  font-size: 0.75rem;
  color: rgba(${rgb.violet}, 0.7);
  text-align: center;
`;

const DdmItem = styled.button<{ $dotColor: string; $active?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.85rem;
  text-align: left;
  font-size: 0.75rem;
  color: ${(p) => (p.$active ? colors.violet : "var(--t-textMuted)")};
  background: ${(p) => (p.$active ? `rgba(${rgb.violet}, 0.15)` : "transparent")};
  border: none;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;

  &:hover {
    background: rgba(${rgb.violet}, 0.12);
    color: ${colors.violet};
  }

  &::before {
    content: "";
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 9999px;
    flex-shrink: 0;
    background: ${(p) => p.$dotColor};
    box-shadow: 0 0 4px ${(p) => p.$dotColor};
  }
`;

const TileGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const SkeletonTile = styled.div`
  height: 9rem;
  border-radius: 1rem;
  background: var(--t-inputBg);
  animation: pulse 2s ease-in-out infinite;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const EmptyMessage = styled.div`
  text-align: center;
  font-size: 0.75rem;
  color: var(--t-textGhost);
  padding: 3rem 0;
`;

/* ── Tile styled ───────────────────────────────────────────────── */

const TileButton = styled.button<{ $isOnline: boolean }>`
  text-align: left;
  border-radius: 1rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: all 0.2s;
  cursor: pointer;
  background: linear-gradient(44deg, hsla(190, 100%, 12%, 0.45), rgba(0, 0, 0, 0.8));
  border: 1px solid ${(p) => (p.$isOnline ? `rgba(${rgb.pink}, 0.18)` : "var(--t-border)")};

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: ${(p) => (p.$isOnline ? `rgba(${rgb.pink}, 0.25)` : "var(--t-border)")};
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(${rgb.pink}, 0.2);
  }
`;

const TileTopRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
`;

const TileName = styled.span<{ $isOnline: boolean }>`
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.25;
  word-break: break-all;
  color: ${(p) => (p.$isOnline ? "var(--t-text)" : "var(--t-textGhost)")};
`;

const TileStatusDot = styled.span<{ $color: string; $isOnline: boolean }>`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  flex-shrink: 0;
  margin-top: 0.25rem;
  background: ${(p) => p.$color};
  box-shadow: ${(p) => (p.$isOnline ? `0 0 6px ${p.$color}` : "none")};
  ${(p) =>
    p.$isOnline &&
    `animation: pulse-green 2.5s ease-in-out infinite;
     @keyframes pulse-green {
       0%, 100% { opacity: 1; }
       50% { opacity: 0.5; }
     }`}
`;

const TileMetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
`;

const TilePort = styled.span`
  font-family: monospace;
  color: ${colors.cyan};
`;

const TileStatus = styled.span<{ $color: string }>`
  color: ${(p) => p.$color};
`;

const TileRestarts = styled.span`
  color: rgba(${rgb.gold}, 0.6);
`;

const TileCommitInfo = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  line-height: 1.625;
`;

const TileCommitTime = styled.span`
  color: var(--t-textMuted);
`;

const TileNoCommits = styled.div`
  font-size: 0.75rem;
  color: var(--t-textGhost);
`;

const TileBottom = styled.div`
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const TilePreviewLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${colors.pink};
  opacity: 0;
  transition: opacity 0.2s;

  ${TileButton}:hover & {
    opacity: 1;
  }
`;

const TileActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  opacity: 0;
  transition: opacity 0.2s;

  ${TileButton}:hover & {
    opacity: 1;
  }
`;

const TileActionLink = styled(Link)<{ $bg: string; $border: string; $color: string }>`
  font-size: 10px;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  text-decoration: none;
  background: ${(p) => p.$bg};
  border: 1px solid ${(p) => p.$border};
  color: ${(p) => p.$color};
`;

const TileActionButton = styled.button<{ $bg: string; $border: string; $color: string }>`
  font-size: 10px;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
  background: ${(p) => p.$bg};
  border: 1px solid ${(p) => p.$border};
  color: ${(p) => p.$color};

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

/* ── Component ─────────────────────────────────────────────────── */

export default function DeployPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const { openPreview } = usePreview();

  // Deploy button state — which clients are deployable + each one's latest deploy status.
  const [deployable, setDeployable] = useState<string[]>([]);
  const [deploys, setDeploys] = useState<Record<string, DeployState | null>>({});
  const [targetsOpen, setTargetsOpen] = useState(false);

  const loadDeploys = useCallback(async () => {
    try {
      const r = await fetch("/api/deploy", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setDeployable(d.deployable ?? []);
        setDeploys(d.deploys ?? {});
      }
    } catch { /* */ }
  }, []);
  useEffect(() => { loadDeploys(); }, [loadDeploys]);

  const anyDeploying = useMemo(
    () => Object.values(deploys).some((d) => d && (d.state === "resolving" || d.state === "building")),
    [deploys]
  );
  useEffect(() => {
    if (!anyDeploying) return;
    const t = setInterval(loadDeploys, 4000);
    return () => clearInterval(t);
  }, [anyDeploying, loadDeploys]);

  const triggerDeploy = useCallback(async (name: string) => {
    setDeploys((prev) => ({
      ...prev,
      [name]: { jobId: "", client: name, startedBy: "", state: "resolving", phase: "queued" },
    }));
    try {
      await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: name }),
      });
    } finally {
      loadDeploys();
    }
  }, [loadDeploys]);

  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState("");
  const [asc, setAsc] = useState(true);
  const sbdmRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setProjects(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const filteredProjects = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase())),
    [projects, filter]
  );

  const panelList = useMemo(() => {
    const list = projects
      .filter((p) => p.name.toLowerCase().includes(inner.toLowerCase()))
      .slice()
      .sort((a, b) => asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    return list;
  }, [projects, inner, asc]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageProjects = filteredProjects.slice(safePage * pageSize, (safePage + 1) * pageSize);

  return (
    <>
      <TopNav />
      <PageMain>
        {/* Header */}
        <HeaderRow>
          <div>
            <PageSubtitle>
              {projects.length} projects — click any tile to preview the live deployment
            </PageSubtitle>
          </div>
          <HeaderActions>
            <EditorLink href="/dashboard/editor">✎ Editor</EditorLink>
            <RefreshBtn onClick={() => setTargetsOpen(true)}>⚙ Build Targets</RefreshBtn>
            <RefreshBtn onClick={load}>↺ Refresh</RefreshBtn>
          </HeaderActions>
        </HeaderRow>

        {/* DDM */}
        <DdmWrap ref={sbdmRef}>
          <DdmTrigger
            $open={open}
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <DdmLabel>{filter ? filter : "All Projects"}</DdmLabel>
            <DdmTriangle $open={open} />
          </DdmTrigger>

          {open && (
            <DdmMenu role="menu">
              <DdmHeader>
                <DdmSearchInput
                  value={inner}
                  onChange={(e) => setInner(e.target.value)}
                  placeholder="Search projects…"
                  autoFocus
                />
                <DdmSortBtn onClick={() => setAsc((v) => !v)}>
                  {asc ? "Z-A" : "A-Z"}
                </DdmSortBtn>
              </DdmHeader>
              <DdmList>
                {filter && (
                  <DdmItem
                    $dotColor="#6b7280"
                    onClick={() => { setFilter(""); setInner(""); setOpen(false); }}
                  >
                    <em style={{ fontStyle: "normal", opacity: 0.75 }}>Clear filter · All Projects</em>
                  </DdmItem>
                )}
                {panelList.length === 0 ? (
                  <DdmEmpty>No matches</DdmEmpty>
                ) : panelList.map((p) => {
                  const dot = p.pm2Status ? (STATUS_COLOR[p.pm2Status] ?? "#6b7280") : "#6b7280";
                  return (
                    <DdmItem
                      key={p.name}
                      $dotColor={dot}
                      $active={filter === p.name}
                      role="menuitem"
                      onClick={() => { setFilter(p.name); setInner(""); setOpen(false); }}
                    >
                      {p.name}
                    </DdmItem>
                  );
                })}
              </DdmList>
            </DdmMenu>
          )}
        </DdmWrap>

        {/* Grid */}
        {loading ? (
          <TileGrid>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonTile key={i} />)}
          </TileGrid>
        ) : pageProjects.length === 0 ? (
          <EmptyMessage>No projects match &ldquo;{filter}&rdquo;</EmptyMessage>
        ) : (
          <TileGrid>
            {pageProjects.map((proj) => (
              <ProjectTile
                key={proj.name}
                project={proj}
                onClick={() => openPreview(proj.name)}
                deployable={deployable.includes(proj.name)}
                deploy={deploys[proj.name] ?? null}
                onDeploy={() => triggerDeploy(proj.name)}
              />
            ))}
          </TileGrid>
        )}

        {/* TPG — Table Pagination Group (info · page-size DDM · reset · prev/next) */}
        {!loading && filteredProjects.length > 0 && (
          <TPG
            total={filteredProjects.length}
            page={safePage + 1}
            pageSize={pageSize}
            defaultPageSize={DEFAULT_PAGE_SIZE}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            itemNoun="project"
            onPageChange={(p) => setPage(p - 1)}
            onPageSizeChange={(n) => { setPageSize(n); setPage(0); }}
          />
        )}
      </PageMain>
      {targetsOpen && <DeployTargetsControlModal onClose={() => setTargetsOpen(false)} />}
    </>
  );
}

function ProjectTile({ project: p, onClick, deployable, deploy, onDeploy }: {
  project: Project;
  onClick: () => void;
  deployable: boolean;
  deploy: DeployState | null;
  onDeploy: () => void;
}) {
  const statusColor = p.pm2Status ? (STATUS_COLOR[p.pm2Status] ?? "#6b7280") : "#6b7280";
  const isOnline = p.pm2Status === "online";

  const dst = deploy?.state;
  const deployActive = dst === "resolving" || dst === "building";
  const deployLabel = deployActive ? "⟳ …" : dst === "done" ? "✓ Deployed" : dst === "failed" ? "✗ Retry" : "⟳ Deploy";
  const deployTone = dst === "failed"
    ? { bg: "rgba(255,90,90,0.12)", border: "rgba(255,90,90,0.35)", color: colors.red }
    : dst === "done"
    ? { bg: "rgba(0,220,100,0.12)", border: "rgba(0,220,100,0.35)", color: "#00dc64" }
    : { bg: "rgba(255,78,203,0.12)", border: "rgba(255,78,203,0.35)", color: colors.pink };

  return (
    <TileButton $isOnline={isOnline} onClick={onClick}>
      <TileTopRow>
        <TileName $isOnline={isOnline}>{p.name}</TileName>
        <TileStatusDot $color={statusColor} $isOnline={isOnline} />
      </TileTopRow>

      <TileMetaRow>
        {p.port && <TilePort>:{p.port}</TilePort>}
        {p.pm2Status && <TileStatus $color={statusColor}>{p.pm2Status}</TileStatus>}
        {p.pm2Restarts > 0 && <TileRestarts>↺ {p.pm2Restarts}</TileRestarts>}
      </TileMetaRow>

      {p.lastCommit ? (
        <TileCommitInfo>
          <TileCommitTime>{p.lastCommit.timeAgo}</TileCommitTime>
          {" · "}
          <span>{p.lastCommit.subject}</span>
        </TileCommitInfo>
      ) : (
        <TileNoCommits>No commits</TileNoCommits>
      )}

      <TileBottom>
        <TilePreviewLabel>🌐 Open Preview →</TilePreviewLabel>
        <TileActions>
          <TileActionLink
            href={`/dashboard/editor?project=${encodeURIComponent(p.name)}`}
            onClick={(e) => e.stopPropagation()}
            title={`Open ${p.name} in editor`}
            $bg={`rgba(${rgb.gold}, 0.1)`}
            $border={`rgba(${rgb.gold}, 0.3)`}
            $color={colors.gold}
          >
            ✎ Editor
          </TileActionLink>
          <TileActionLink
            href={`/dashboard/storage?project=${encodeURIComponent(p.name)}`}
            onClick={(e) => e.stopPropagation()}
            title={`Upload files to ${p.name} CDN bucket`}
            $bg={`rgba(${rgb.cyan}, 0.1)`}
            $border={`rgba(${rgb.cyan}, 0.3)`}
            $color={colors.cyan}
          >
            📁 Upload
          </TileActionLink>
          {deployable && (
            <TileActionButton
              type="button"
              disabled={deployActive}
              onClick={(e) => { e.stopPropagation(); onDeploy(); }}
              title={deploy?.phase ? `${deploy.state}: ${deploy.phase}` : `Build ${p.name} on Mac → ship to RCS`}
              $bg={deployTone.bg}
              $border={deployTone.border}
              $color={deployTone.color}
            >
              {deployLabel}
            </TileActionButton>
          )}
        </TileActions>
      </TileBottom>
    </TileButton>
  );
}
