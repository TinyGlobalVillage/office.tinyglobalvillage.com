"use client";

import { useEffect, useState, useCallback } from "react";
import styled, { keyframes } from "styled-components";
import { colors, rgb } from "../theme";

/* ── Types ─────────────────────────────────────────────────── */

type DepUpdate = {
  package: string;
  current: string;
  latest: string;
  type: string;
};

type ProjectUpdates = {
  name: string;
  dir: string;
  updates: DepUpdate[];
};

type Announcement = {
  id: string;
  created_at: string;
  title: string;
  type: "dep-update";
  status: "pending" | "dismissed";
  dismissed_by?: string;
  dismissed_at?: string;
  data: {
    projects: ProjectUpdates[];
    total_updates: number;
  };
};

/* ── Animations ────────────────────────────────────────────── */

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
`;

/* ── Styled ────────────────────────────────────────────────── */

const Card = styled.div`
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.gold}, 0.25);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 0 24px rgba(${rgb.gold}, 0.08),
              0 0 60px rgba(${rgb.gold}, 0.04);

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: rgba(${rgb.gold}, 0.35);
    box-shadow: 0 0 16px rgba(${rgb.gold}, 0.06);
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Emoji = styled.span`
  font-size: 16px;
`;

const Title = styled.h3`
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${colors.gold};
`;

const CountLabel = styled.span`
  font-size: 12px;
  color: var(--t-textGhost);
`;

const SkeletonBar = styled.div`
  height: 40px;
  border-radius: 8px;
  background: rgba(${rgb.gold}, 0.04);
  animation: ${pulse} 2s ease-in-out infinite;

  [data-theme="light"] & {
    background: rgba(${rgb.gold}, 0.08);
  }
`;

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const AnnouncementCard = styled.div`
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(${rgb.gold}, 0.05);
  border: 1px solid rgba(${rgb.gold}, 0.2);

  [data-theme="light"] & {
    background: rgba(${rgb.gold}, 0.06);
    border-color: rgba(${rgb.gold}, 0.25);
  }
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const InfoCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const AnnTitle = styled.p`
  font-size: 14px;
  font-weight: 600;
  color: var(--t-text);
  line-height: 1.4;
`;

const AnnDate = styled.p`
  font-size: 10px;
  color: var(--t-textGhost);
  font-family: monospace;
`;

const DismissBtn = styled.button`
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 6px 12px;
  border-radius: 8px;
  flex-shrink: 0;
  transition: all 0.15s;
  background: rgba(${rgb.gold}, 0.12);
  border: 1px solid rgba(${rgb.gold}, 0.35);
  color: ${colors.gold};
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
  }

  &:hover:not(:disabled) {
    filter: brightness(1.25);
  }
`;

const ProjectName = styled.p`
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--t-textMuted);
  margin-bottom: 6px;
`;

const ProjectGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const PillWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Pill = styled.span<{ $isMajor: boolean }>`
  font-size: 10px;
  font-family: monospace;
  padding: 2px 8px;
  border-radius: 6px;
  background: ${({ $isMajor }) =>
    $isMajor ? `rgba(${rgb.pink}, 0.1)` : `rgba(${rgb.cyan}, 0.08)`};
  border: 1px solid
    ${({ $isMajor }) =>
      $isMajor ? `rgba(${rgb.pink}, 0.3)` : `rgba(${rgb.cyan}, 0.2)`};
  color: ${({ $isMajor }) => ($isMajor ? colors.pink : colors.cyan)};
`;

const Arrow = styled.span`
  color: var(--t-textGhost);
`;

const MajorTag = styled.span`
  margin-left: 4px;
  font-size: 9px;
  font-weight: 700;
  color: ${colors.pink};
`;

/* ── Component ─────────────────────────────────────────────── */

export default function AnnouncementsPanel({
  className = "",
}: {
  className?: string;
}) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const pending = items.filter((a) => a.status === "pending");

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, [poll]);

  const dismiss = async (id: string) => {
    setDismissing(id);
    try {
      const res = await fetch("/api/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, status: "dismissed" as const } : a
          )
        );
      }
    } finally {
      setDismissing(null);
    }
  };

  if (!loading && pending.length === 0) return null;

  return (
    <Card className={className}>
      <Header>
        <HeaderLeft>
          <Emoji>&#x1f4e6;</Emoji>
          <Title>Pending Updates</Title>
        </HeaderLeft>
        {!loading && (
          <CountLabel>
            {pending.length} announcement{pending.length !== 1 ? "s" : ""}
          </CountLabel>
        )}
      </Header>

      {loading ? (
        <SkeletonBar />
      ) : (
        <ItemList>
          {pending.map((ann) => (
            <AnnouncementCard key={ann.id}>
              <HeaderRow>
                <InfoCol>
                  <AnnTitle>{ann.title}</AnnTitle>
                  <AnnDate>
                    {new Date(ann.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </AnnDate>
                </InfoCol>
                <DismissBtn
                  onClick={() => dismiss(ann.id)}
                  disabled={dismissing === ann.id}
                >
                  {dismissing === ann.id ? "…" : "Dismiss"}
                </DismissBtn>
              </HeaderRow>

              {ann.type === "dep-update" &&
                ann.data?.projects?.length > 0 && (
                  <ProjectGroup>
                    {ann.data.projects.map((proj) => (
                      <div key={proj.name}>
                        <ProjectName>{proj.name}</ProjectName>
                        <PillWrap>
                          {proj.updates.map((u) => {
                            const isMajor = u.type === "major";
                            return (
                              <Pill
                                key={u.package}
                                $isMajor={isMajor}
                                title={`${u.package}: ${u.current} \u2192 ${u.latest}`}
                              >
                                {u.package}{" "}
                                <Arrow>
                                  {u.current} &rarr;
                                </Arrow>{" "}
                                {u.latest}
                                {isMajor && <MajorTag>MAJOR</MajorTag>}
                              </Pill>
                            );
                          })}
                        </PillWrap>
                      </div>
                    ))}
                  </ProjectGroup>
                )}
            </AnnouncementCard>
          ))}
        </ItemList>
      )}
    </Card>
  );
}
