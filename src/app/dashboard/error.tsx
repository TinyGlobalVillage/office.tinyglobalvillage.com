"use client";

import { useEffect } from "react";
import styled from "styled-components";
import { colors, rgb } from "../theme";

/* ── Styled ────────────────────────────────────────────────── */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--t-bg);
`;

const Box = styled.div`
  text-align: center;
  padding: 0 32px;
  max-width: 384px;
`;

const Icon = styled.div`
  font-size: 30px;
  margin-bottom: 16px;
`;

const Heading = styled.div`
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: rgba(${rgb.pink}, 0.8);
`;

const Message = styled.div`
  font-size: 11px;
  margin-bottom: 24px;
  font-family: monospace;
  color: var(--t-textGhost);
`;

const RetryBtn = styled.button`
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  transition: all 0.15s;
  cursor: pointer;
  background: rgba(${rgb.pink}, 0.12);
  border: 1px solid rgba(${rgb.pink}, 0.35);
  color: ${colors.pink};

  &:hover {
    filter: brightness(1.25);
  }

  [data-theme="light"] & {
    background: rgba(${rgb.pink}, 0.08);
    border-color: rgba(${rgb.pink}, 0.3);
  }
`;

/* ── Component ─────────────────────────────────────────────── */

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard] caught error:", error);
  }, [error]);

  return (
    <Overlay>
      <Box>
        <Icon>&#x26a0;</Icon>
        <Heading>Something went wrong</Heading>
        <Message>{error.message || "An unexpected error occurred."}</Message>
        <RetryBtn onClick={reset}>&#x21ba; Try again</RetryBtn>
      </Box>
    </Overlay>
  );
}
