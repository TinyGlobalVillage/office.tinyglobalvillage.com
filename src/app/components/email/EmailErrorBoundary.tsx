"use client";

import { Component, type ReactNode } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";

/* ------------------------------------------------------------------ */
/*  Styled                                                            */
/* ------------------------------------------------------------------ */

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
  padding: 0 1.5rem;
`;

const Icon = styled.div`
  font-size: 1.5rem;
`;

const TextBlock = styled.div`
  text-align: center;
`;

const ErrorTitle = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: rgba(${rgb.pink}, 0.8);
`;

const ErrorMessage = styled.div`
  font-size: 0.625rem;
  margin-bottom: 0.75rem;
  color: var(--t-textFaint);
`;

const RetryBtn = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  transition: all 0.15s ease;
  background: rgba(${rgb.pink}, 0.12);
  border: 1px solid rgba(${rgb.pink}, 0.35);
  color: ${colors.pink};
  cursor: pointer;

  &:hover {
    background: rgba(${rgb.pink}, 0.22);
  }
`;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class EmailErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[EmailClient] render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Wrapper>
          <Icon>⚠</Icon>
          <TextBlock>
            <ErrorTitle>Mail client error</ErrorTitle>
            <ErrorMessage>{this.state.error.message}</ErrorMessage>
          </TextBlock>
          <RetryBtn onClick={() => this.setState({ error: null })}>
            ↺ Retry
          </RetryBtn>
        </Wrapper>
      );
    }
    return this.props.children;
  }
}
