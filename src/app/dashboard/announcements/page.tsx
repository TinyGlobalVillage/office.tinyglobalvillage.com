"use client";

import styled from "styled-components";
import { rgb } from "../../theme";
import AnnouncementsPanel from "../../components/AnnouncementsPanel";

const Shell = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--t-bg);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid rgba(${rgb.gold}, 0.2);
`;

const Title = styled.span`
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #f7b700;
  text-shadow: 0 0 8px rgba(${rgb.gold}, 0.6);
  display: flex;
  align-items: center;
  gap: 0.5rem;

  [data-theme="light"] & { text-shadow: none; }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
`;

export default function AnnouncementsPage() {
  return (
    <Shell>
      <Header>
        <Title>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          Alerts
        </Title>
      </Header>
      <Body>
        <AnnouncementsPanel />
      </Body>
    </Shell>
  );
}
