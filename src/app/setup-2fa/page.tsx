"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { colors, rgb } from "../theme";

type Step = "loading" | "scan" | "verify" | "done" | "error";

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

const CenterText = styled.p`
  font-size: 12px;
  color: var(--t-textGhost);
  text-align: center;
`;

const ErrText = styled.p`
  font-size: 14px;
  color: ${colors.red};
  margin-bottom: 16px;
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

const SmallPinkBtn = styled(GlowPinkBtn)`
  padding: 8px 24px;
  font-size: 12px;
  width: auto;
`;

const ScanCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
`;

const StepsBlock = styled.div`
  font-size: 12px;
  color: var(--t-textMuted);
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const StepLabel = styled.p`
  font-weight: 700;
  color: var(--t-textFaint);
  margin-bottom: 4px;
`;

const StepLabelLeft = styled.div`
  font-weight: 700;
  font-size: 12px;
  color: var(--t-textFaint);
  align-self: flex-start;
`;

const QrWrap = styled.div`
  border-radius: 12px;
  overflow: hidden;
  padding: 8px;
  background: #fff;
`;

const QrImg = styled.img`
  width: 192px;
  height: 192px;
`;

const SecretBlock = styled.div`
  width: 100%;
`;

const SecretHint = styled.p`
  font-size: 10px;
  color: var(--t-textGhost);
  margin-bottom: 4px;
`;

const SecretCode = styled.code`
  display: block;
  font-size: 12px;
  font-family: monospace;
  text-align: center;
  padding: 8px 12px;
  border-radius: 8px;
  word-break: break-all;
  background: var(--t-inputBg);
  color: ${colors.pink};
`;

const VerifyCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const HintText = styled.p`
  font-size: 12px;
  color: var(--t-textMuted);
`;

const CodeInput = styled.input`
  width: 100%;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 20px;
  text-align: center;
  font-family: monospace;
  color: var(--t-text);
  letter-spacing: 0.4em;
  outline: none;
  background: var(--t-inputBg);
  border: 1px solid rgba(${rgb.pink}, 0.3);

  [data-theme="light"] & {
    background: var(--t-inputBg);
    border-color: rgba(${rgb.pink}, 0.25);
  }
`;

const ErrorSmall = styled.p`
  font-size: 12px;
  color: ${colors.red};
  text-align: center;
`;

const BackLink = styled.button`
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

const DoneCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
`;

const BigEmoji = styled.div`
  font-size: 36px;
`;

const DoneTitle = styled.p`
  font-weight: 700;
  color: var(--t-text);
  margin-bottom: 4px;
`;

const DoneHint = styled.p`
  font-size: 12px;
  color: var(--t-textMuted);
`;

/* ── Component ─────────────────────────────────────────────── */

export default function Setup2FAPage() {
  const [step, setStep] = useState<Step>("loading");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/totp-setup")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setStep("error");
          return;
        }
        setQr(d.qr);
        setSecret(d.secret);
        setStep("scan");
      })
      .catch(() => setStep("error"));
  }, []);

  async function handleVerify() {
    if (code.replace(/\s/g, "").length !== 6) {
      setError("Enter the 6-digit code from your app.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/auth/totp-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, code }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setStep("done");
    } else {
      setError(data.error ?? "Code mismatch \u2014 try again.");
    }
  }

  return (
    <Main>
      <Inner>
        <BrandBlock>
          <PageTitle>Set Up Authenticator</PageTitle>
          <Subtitle>Two-factor authentication required for all logins</Subtitle>
        </BrandBlock>

        <Card>
          {step === "loading" && (
            <CenterText>Generating QR code&hellip;</CenterText>
          )}

          {step === "error" && (
            <div style={{ textAlign: "center" }}>
              <ErrText>Failed to load setup. Are you logged in?</ErrText>
              <SmallPinkBtn onClick={() => router.push("/login")}>
                Back to Login
              </SmallPinkBtn>
            </div>
          )}

          {step === "scan" && (
            <ScanCol>
              <StepsBlock>
                <StepLabel>Step 1 &mdash; Install an authenticator app</StepLabel>
                <p>&bull; Google Authenticator</p>
                <p>&bull; Authy</p>
                <p>&bull; 1Password</p>
                <p>&bull; Apple Passwords (iOS 18+)</p>
              </StepsBlock>

              <StepLabelLeft>Step 2 &mdash; Scan this QR code</StepLabelLeft>

              {qr && (
                <QrWrap>
                  <QrImg src={qr} alt="TOTP QR Code" />
                </QrWrap>
              )}

              <SecretBlock>
                <SecretHint>Or enter this key manually:</SecretHint>
                <SecretCode>{secret}</SecretCode>
              </SecretBlock>

              <GlowPinkBtn onClick={() => setStep("verify")}>
                I&apos;ve scanned it &rarr;
              </GlowPinkBtn>
            </ScanCol>
          )}

          {step === "verify" && (
            <VerifyCol>
              <HintText>
                Enter the 6-digit code from your authenticator app to confirm
                setup.
              </HintText>
              <CodeInput
                type="text"
                inputMode="numeric"
                placeholder="000 000"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/[^0-9\s]/g, ""))
                }
                maxLength={7}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                autoFocus
              />
              {error && <ErrorSmall>{error}</ErrorSmall>}
              <GlowPinkBtn onClick={handleVerify} disabled={saving}>
                {saving ? "Verifying…" : "Confirm & Enable 2FA"}
              </GlowPinkBtn>
              <BackLink onClick={() => setStep("scan")}>
                &larr; Back to QR code
              </BackLink>
            </VerifyCol>
          )}

          {step === "done" && (
            <DoneCol>
              <BigEmoji>&#x2705;</BigEmoji>
              <div>
                <DoneTitle>2FA enabled!</DoneTitle>
                <DoneHint>
                  You&apos;ll need your authenticator on every login from now on.
                </DoneHint>
              </div>
              <GlowPinkBtn onClick={() => router.push("/verify-2fa")}>
                Continue &rarr;
              </GlowPinkBtn>
            </DoneCol>
          )}
        </Card>
      </Inner>
    </Main>
  );
}
