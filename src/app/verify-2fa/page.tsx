"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styled, { keyframes } from "styled-components";
import { colors, rgb } from "../theme";

/* ── Animations ────────────────────────────────────────────── */

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-8px); }
  40%      { transform: translateX(8px); }
  60%      { transform: translateX(-6px); }
  80%      { transform: translateX(6px); }
`;

/* ── Styled ────────────────────────────────────────────────── */

const Main = styled.main`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  background: var(--t-bg);
`;

const TopGlow = styled.div`
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 300px;
  pointer-events: none;
  background: radial-gradient(
    ellipse at 50% 0%,
    rgba(${rgb.pink}, 0.1) 0%,
    transparent 70%
  );
`;

const Inner = styled.div`
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 384px;
`;

const BrandBlock = styled.div`
  text-align: center;
  margin-bottom: 32px;
`;

const CompanyLabel = styled.p`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.4em;
  color: var(--t-textGhost);
  margin-bottom: 12px;
`;

const PageTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
  color: ${colors.pink};
  text-shadow: 0 0 12px #ff66cc;
`;

const Subtitle = styled.p`
  font-size: 12px;
  color: var(--t-textMuted);
`;

const Card = styled.div`
  border-radius: 12px;
  border: 1px solid rgba(${rgb.pink}, 0.2);
  padding: 32px;
  background: var(--t-surface);
  box-shadow: 0 0 30px rgba(${rgb.pink}, 0.08);

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: rgba(${rgb.pink}, 0.25);
    box-shadow: 0 0 20px rgba(${rgb.pink}, 0.05);
  }
`;

const FormCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const HintText = styled.p`
  font-size: 12px;
  color: var(--t-textMuted);
  text-align: center;
`;

const CodeInput = styled.input<{ $hasError: boolean; $shaking: boolean }>`
  width: 100%;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 24px;
  text-align: center;
  font-family: monospace;
  color: var(--t-text);
  letter-spacing: 0.5em;
  outline: none;
  transition: all 0.15s;
  background: var(--t-inputBg);
  border: 1px solid
    ${({ $hasError }) =>
      $hasError
        ? "rgba(255, 100, 100, 0.6)"
        : `rgba(${rgb.pink}, 0.3)`};
  animation: ${({ $shaking }) => ($shaking ? shake : "none")} 0.4s ease;

  [data-theme="light"] & {
    background: var(--t-inputBg);
    border-color: ${({ $hasError }) =>
      $hasError
        ? "rgba(255, 100, 100, 0.5)"
        : `rgba(${rgb.pink}, 0.25)`};
  }
`;

const ErrorText = styled.p`
  font-size: 12px;
  color: ${colors.red};
  text-align: center;
`;

const GlowPinkBtn = styled.button`
  padding: 10px 0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s;
  width: 100%;
  background: rgba(${rgb.pink}, 0.15);
  border: 1px solid rgba(${rgb.pink}, 0.35);
  color: ${colors.pink};

  &:hover {
    box-shadow: 0 0 16px rgba(${rgb.pink}, 0.25);
    background: rgba(${rgb.pink}, 0.22);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  [data-theme="light"] & {
    background: rgba(${rgb.pink}, 0.1);
    border-color: rgba(${rgb.pink}, 0.3);
  }
`;

const SignOutLink = styled.button`
  font-size: 12px;
  color: var(--t-textGhost);
  text-align: center;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s;

  &:hover {
    color: var(--t-textMuted);
  }
`;

const SetupCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
`;

const SetupText = styled.p`
  font-size: 14px;
  color: var(--t-textFaint);
`;

const SetupHint = styled.p`
  font-size: 12px;
  color: var(--t-textMuted);
`;

const LoadingText = styled.p`
  font-size: 12px;
  color: var(--t-textGhost);
  text-align: center;
`;

/* ── VerifyForm ────────────────────────────────────────────── */

function VerifyForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    fetch("/api/auth/totp-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "000000" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error === "2FA not configured") setNeedsSetup(true);
      })
      .catch(() => {});
  }, []);

  const handleVerify = useCallback(
    async (codeOverride?: string) => {
      const clean = (codeOverride ?? code).replace(/\s/g, "");
      if (clean.length !== 6) return;
      setLoading(true);
      setError("");
      const res = await fetch("/api/auth/totp-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: clean }),
      });
      const data = await res.json();
      setLoading(false);
      if (data.ok) {
        const redirectTo = searchParams.get("callbackUrl") || "/dashboard";
        router.push(redirectTo);
        router.refresh();
      } else {
        setError(data.error ?? "Invalid code. Try again.");
        setShaking(true);
        setTimeout(() => {
          setShaking(false);
          setCode("");
          setTimeout(() => inputRef.current?.focus(), 50);
        }, 500);
      }
    },
    [code, router, searchParams]
  );

  useEffect(() => {
    const clean = code.replace(/\s/g, "");
    if (clean.length === 6 && !loading) {
      handleVerify(clean);
    }
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (needsSetup) {
    return (
      <SetupCol>
        <SetupText>You haven&apos;t set up 2FA yet.</SetupText>
        <SetupHint>All accounts require an authenticator app.</SetupHint>
        <GlowPinkBtn onClick={() => router.push("/setup-2fa")}>
          Set Up Authenticator &rarr;
        </GlowPinkBtn>
      </SetupCol>
    );
  }

  return (
    <FormCol>
      <HintText>
        Open your authenticator app and enter the 6-digit code for{" "}
        <strong>TGV Office</strong>.
      </HintText>

      <CodeInput
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder="000 000"
        value={code}
        onChange={(e) => {
          setError("");
          setCode(e.target.value.replace(/[^0-9\s]/g, ""));
        }}
        maxLength={7}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleVerify();
        }}
        autoFocus
        disabled={loading}
        $hasError={!!error}
        $shaking={shaking}
      />

      {error && <ErrorText>{error}</ErrorText>}

      <GlowPinkBtn onClick={() => handleVerify()} disabled={loading}>
        {loading ? "Verifying…" : "Verify Code"}
      </GlowPinkBtn>

      <SignOutLink
        onClick={async () => {
          const { signOut } = await import("next-auth/react");
          signOut({ callbackUrl: "/login" });
        }}
      >
        Sign out &amp; start over
      </SignOutLink>
    </FormCol>
  );
}

/* ── Page ──────────────────────────────────────────────────── */

export default function VerifyTwoFactorPage() {
  return (
    <Main>
      <TopGlow />
      <Inner>
        <BrandBlock>
          <CompanyLabel>TGV Office</CompanyLabel>
          <PageTitle>Two-Factor Auth</PageTitle>
          <Subtitle>Required for all access</Subtitle>
        </BrandBlock>

        <Card>
          <Suspense fallback={<LoadingText>Loading&hellip;</LoadingText>}>
            <VerifyForm />
          </Suspense>
        </Card>
      </Inner>
    </Main>
  );
}
