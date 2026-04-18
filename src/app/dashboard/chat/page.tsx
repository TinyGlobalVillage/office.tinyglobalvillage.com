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
  border-bottom: 1px solid rgba(${rgb.green}, 0.2);
`;

const Title = styled.span`
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #4ade80;
  text-shadow: 0 0 8px rgba(${rgb.green}, 0.6);
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

export default function ChatPopoutPage() {
  return (
    <Shell>
      <Header>
        <Title>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Chats
        </Title>
      </Header>
      <Body>
        <Placeholder>
          Chat popout — full-window mode is a work in progress.<br/>
          For now, use the Chats drawer from the left-side tab pill.
        </Placeholder>
      </Body>
    </Shell>
  );
}
