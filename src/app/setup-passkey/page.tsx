"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { colors, rgb } from "../theme";

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
  color: ${colors.cyan};
  text-shadow: 0 0 12px ${colors.cyan};
`;

const Subtitle = styled.p`
  font-size: 12px;
  color: var(--t-textMuted);
`;

const Card = styled.div`
  border-radius: 12px;
  border: 1px solid rgba(${rgb.cyan}, 0.2);
  padding: 32px;
  background: var(--t-surface);
  box-shadow: 0 0 30px rgba(${rgb.cyan}, 0.06);

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: rgba(${rgb.cyan}, 0.25);
    box-shadow: 0 0 20px rgba(${rgb.cyan}, 0.04);
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

const GlowBtn = styled.button`
  padding: 10px 0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s;
  width: 100%;
  background: rgba(${rgb.cyan}, 0.15);
  border: 1px solid rgba(${rgb.cyan}, 0.35);
  color: ${colors.cyan};

  &:hover {
    box-shadow: 0 0 16px rgba(${rgb.cyan}, 0.25);
    background: rgba(${rgb.cyan}, 0.22);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  [data-theme="light"] & {
    background: rgba(${rgb.cyan}, 0.1);
    border-color: rgba(${rgb.cyan}, 0.3);
  }
`;

const GradientBtn = styled.button`
  padding: 10px 0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s;
  width: 100%;
  background: linear-gradient(135deg, ${colors.cyan}, #0080ff);
  color: #fff;
  border: none;

  &:disabled {
    opacity: 0.5;
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
`;

const FieldWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--t-textMuted);
`;

const Input = styled.input`
  width: 100%;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 14px;
  color: var(--t-text);
  outline: none;
  background: var(--t-inputBg);
  border: 1px solid rgba(${rgb.cyan}, 0.2);

  &:focus {
    border-color: rgba(${rgb.cyan}, 0.6);
  }

  [data-theme="light"] & {
    background: var(--t-inputBg);
    border-color: rgba(${rgb.cyan}, 0.25);

    &:focus {
      border-color: rgba(${rgb.cyan}, 0.5);
    }
  }
`;

const ErrorText = styled.p`
  font-size: 12px;
  color: ${colors.red};
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

/* ── Component ─────────────────────────────────────────────── */

export default function SetupPasskeyPage() {
  const [deviceName, setDeviceName] = useState("");
  const [status, setStatus] = useState<
    "idle" | "registering" | "done" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  async function handleRegister() {
    if (!deviceName.trim()) {
      setErrorMsg("Give this device a name first.");
      return;
    }
    setStatus("registering");
    setErrorMsg("");

    try {
      const optRes = await fetch("/api/auth/passkey-register-options", {
        method: "POST",
      });
      if (!optRes.ok) {
        setErrorMsg("Failed to start registration.");
        setStatus("error");
        return;
      }
      const options = await optRes.json();

      const challenge = base64urlToBuffer(options.challenge);
      const userId = base64urlToBuffer(options.user.id);

      const credential = (await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge,
          user: { ...options.user, id: userId },
          excludeCredentials:
            options.excludeCredentials?.map((c: { id: string }) => ({
              ...c,
              id: base64urlToBuffer(c.id),
            })) ?? [],
        },
      })) as PublicKeyCredential;

      const response =
        credential.response as AuthenticatorAttestationResponse;

      const verifyRes = await fetch("/api/auth/passkey-register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceName: deviceName.trim(),
          response: {
            id: credential.id,
            rawId: bufferToBase64url(credential.rawId),
            type: credential.type,
            response: {
              clientDataJSON: bufferToBase64url(response.clientDataJSON),
              attestationObject: bufferToBase64url(
                response.attestationObject
              ),
            },
          },
        }),
      });

      const data = await verifyRes.json();
      if (data.ok) {
        setStatus("done");
      } else {
        setErrorMsg(data.error ?? "Registration failed.");
        setStatus("error");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("NotAllowedError") || msg.includes("cancelled")) {
        setErrorMsg("Registration cancelled.");
      } else {
        setErrorMsg(msg);
      }
      setStatus("error");
    }
  }

  return (
    <Main>
      <Inner>
        <BrandBlock>
          <PageTitle>Add a Passkey</PageTitle>
          <Subtitle>
            Face ID &middot; Touch ID &middot; Windows Hello &middot; Hardware
            key
          </Subtitle>
        </BrandBlock>

        <Card>
          {status === "done" ? (
            <DoneCol>
              <BigEmoji>&#x1f511;</BigEmoji>
              <div>
                <DoneTitle>Passkey registered!</DoneTitle>
                <DoneHint>
                  &quot;{deviceName}&quot; is now available for login. Your
                  passkey syncs via iCloud / Google Password Manager.
                </DoneHint>
              </div>
              <GlowBtn onClick={() => router.push("/dashboard")}>
                Back to Dashboard
              </GlowBtn>
            </DoneCol>
          ) : (
            <FormCol>
              <HintText>
                Passkeys let you sign in with Face ID, Touch ID, or your
                hardware key &mdash; no password needed. They sync automatically
                across your devices via iCloud or Google.
              </HintText>

              <FieldWrap>
                <Label>
                  Device name (e.g. &quot;Gio&apos;s MacBook&quot;)
                </Label>
                <Input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="My iPhone"
                />
              </FieldWrap>

              {errorMsg && <ErrorText>{errorMsg}</ErrorText>}

              <GradientBtn
                onClick={handleRegister}
                disabled={status === "registering"}
              >
                {status === "registering"
                  ? "Follow browser prompt…"
                  : "Register Passkey \ud83d\udd11"}
              </GradientBtn>

              <BackLink onClick={() => router.back()}>
                &larr; Back
              </BackLink>
            </FormCol>
          )}
        </Card>
      </Inner>
    </Main>
  );
}

/* ── WebAuthn helpers ──────────────────────────────────────── */

function base64urlToBuffer(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  return buffer.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
