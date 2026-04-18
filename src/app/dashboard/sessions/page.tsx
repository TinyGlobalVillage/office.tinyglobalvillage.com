"use client";

import styled from "styled-components";
import { rgb } from "../../theme";

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
  border-bottom: 1px solid rgba(${rgb.pink}, 0.2);
`;

const Title = styled.span`
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #ff4ecb;
  text-shadow: 0 0 8px rgba(${rgb.pink}, 0.6);
  display: flex;
  align-items: center;
  gap: 0.5rem;

  [data-theme="light"] & { text-shadow: none; }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Placeholder = styled.div`
  text-align: center;
  color: var(--t-textGhost);
  font-size: 0.9375rem;
  max-width: 32rem;
  line-height: 1.6;
`;

export default function SessionsPopoutPage() {
  return (
    <Shell>
      <Header>
        <Title>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
          </svg>
          Sessions
        </Title>
      </Header>
      <Body>
        <Placeholder>
          Sessions popout — full-window video room mode is a work in progress.<br/>
          For now, use the Sessions drawer from the left-side tab pill.
        </Placeholder>
      </Body>
    </Shell>
  );
}
