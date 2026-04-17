"use client";

import { useState, useRef, useEffect } from "react";
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
  padding: 3rem 2rem;
`;

const Card = styled.div`
  width: 100%;
  max-width: 24rem;
  border-radius: 1rem;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.cyan}, 0.15);
  box-shadow: 0 8px 40px var(--t-overlay);

  [data-theme="light"] & {
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.12);
  }
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
`;

const IconBox = styled.div`
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  background: rgba(${rgb.cyan}, 0.1);
  border: 1px solid rgba(${rgb.cyan}, 0.2);
`;

const TitleBlock = styled.div`
  text-align: center;
`;

const Title = styled.div`
  color: var(--t-text);
  font-weight: 600;
  font-size: 0.875rem;
`;

const Subtitle = styled.div`
  font-size: 0.6875rem;
  margin-top: 0.125rem;
  color: var(--t-textGhost);
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
  color: var(--t-textFaint);
`;

const PinInput = styled.input<{ $hasError: boolean }>`
  width: 100%;
  border-radius: 0.5rem;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-family: monospace;
  letter-spacing: 0.2em;
  outline: none;
  transition: all 0.15s ease;
  background: var(--t-inputBg);
  border: 1px solid ${(p) => (p.$hasError ? `rgba(${rgb.red}, 0.5)` : "var(--t-border)")};
  color: var(--t-text);

  &::placeholder {
    color: var(--t-textGhost);
  }

  &:focus {
    border-color: rgba(${rgb.cyan}, 0.4);
  }
`;

const ErrorText = styled.div`
  font-size: 0.6875rem;
  color: rgba(${rgb.red}, 0.8);
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const CancelBtn = styled.button`
  flex: 1;
  padding: 0.5rem 0;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.15s ease;
  background: var(--t-surface);
  border: 1px solid var(--t-border);
  color: var(--t-textMuted);
  cursor: pointer;

  &:hover {
    background: var(--t-inputBg);
  }
`;

const UnlockBtn = styled.button`
  flex: 1;
  padding: 0.5rem 0;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.15s ease;
  background: rgba(${rgb.cyan}, 0.15);
  border: 1px solid rgba(${rgb.cyan}, 0.35);
  color: ${colors.cyan};
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  &:not(:disabled):hover {
    background: rgba(${rgb.cyan}, 0.25);
  }
`;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

type Props = {
  account: string;
  email: string;
  onVerified: () => void;
  onCancel: () => void;
};

export default function AccessGate({ account, email, onVerified, onCancel }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    if (!pin.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email/verify-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, pin }),
      });
      const data = await res.json();
      if (data.ok) {
        onVerified();
      } else {
        setError(data.error === "wrong_pin" ? "Incorrect PIN." : "Access denied.");
        setPin("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Wrapper>
      <Card>
        <Header>
          <IconBox>🔒</IconBox>
          <TitleBlock>
            <Title>Personal Inbox</Title>
            <Subtitle>{email}</Subtitle>
          </TitleBlock>
        </Header>

        <FieldGroup>
          <Label>Enter PIN</Label>
          <PinInput
            ref={inputRef}
            type="password"
            inputMode="numeric"
            maxLength={20}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="••••••••"
            $hasError={!!error}
          />
          {error && <ErrorText>{error}</ErrorText>}
        </FieldGroup>

        <ButtonRow>
          <CancelBtn onClick={onCancel}>Cancel</CancelBtn>
          <UnlockBtn onClick={submit} disabled={loading || !pin.trim()}>
            {loading ? "Verifying…" : "Unlock"}
          </UnlockBtn>
        </ButtonRow>
      </Card>
    </Wrapper>
  );
}
