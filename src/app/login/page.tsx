"use client";

import { useState, FormEvent, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import styled from "styled-components";
import { colors, rgb } from "../theme";

type Method = "password" | "passkey" | "magic";

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
    rgba(${rgb.pink}, 0.12) 0%,
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
  margin-bottom: 40px;
`;

const CompanyLabel = styled.p`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.4em;
  color: var(--t-textGhost);
  margin-bottom: 12px;
`;

const BrandTitle = styled.h1`
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 4px;
  color: ${colors.pink};
  text-shadow: 0 0 12px #ff66cc, 0 0 30px ${colors.pink};
`;

const SubLabel = styled.p`
  font-size: 14px;
  font-weight: 600;
  color: var(--t-textMuted);
  letter-spacing: 0.05em;
`;

const FormCard = styled.div`
  border-radius: 12px;
  border: 1px solid rgba(${rgb.pink}, 0.2);
  padding: 32px;
  background: var(--t-surface);
  box-shadow: 0 0 30px rgba(${rgb.pink}, 0.08),
              inset 0 1px 0 rgba(255, 255, 255, 0.06);

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: rgba(${rgb.pink}, 0.25);
    box-shadow: 0 0 20px rgba(${rgb.pink}, 0.05);
  }
`;

const InternalNote = styled.p`
  font-size: 12px;
  color: var(--t-textMuted);
  text-align: center;
  margin-bottom: 20px;
  letter-spacing: 0.03em;
`;

const Footer = styled.p`
  text-align: center;
  font-size: 10px;
  color: var(--t-textGhost);
  margin-top: 24px;
  letter-spacing: 0.03em;
`;

const TabBar = styled.div`
  display: flex;
  border-radius: 8px;
  overflow: hidden;
  background: var(--t-inputBg);
`;

const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 6px 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
  border-bottom: 1px solid
    ${({ $active }) => ($active ? colors.pink : "transparent")};
  background: ${({ $active }) =>
    $active ? `rgba(${rgb.pink}, 0.15)` : "transparent"};
  color: ${({ $active }) =>
    $active ? colors.pink : "var(--t-textGhost)"};
`;

const FormCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormInner = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  transition: all 0.15s;
  background: var(--t-inputBg);
  border: 1px solid rgba(${rgb.pink}, 0.2);

  &:focus {
    border-color: rgba(${rgb.pink}, 0.6);
  }

  [data-theme="light"] & {
    background: var(--t-inputBg);
    border-color: rgba(${rgb.pink}, 0.25);

    &:focus {
      border-color: rgba(${rgb.pink}, 0.5);
    }
  }
`;

const ErrText = styled.p`
  font-size: 12px;
  text-align: center;
  color: ${colors.red};
`;

const InfoText = styled.p`
  font-size: 12px;
  text-align: center;
  color: ${colors.green};
`;

const GlowPinkBtn = styled.button`
  margin-top: 4px;
  padding: 10px 0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s;
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

const PasskeyBtn = styled.button`
  padding: 10px 0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s;
  background: linear-gradient(135deg, ${colors.cyan}, #0080ff);
  color: #fff;
  border: none;

  &:disabled {
    opacity: 0.5;
  }
`;

const HintText = styled.p`
  font-size: 10px;
  color: var(--t-textMuted);
  text-align: center;
`;

const PinkLink = styled.a`
  text-decoration: underline;
  color: ${colors.pink};
`;

/* ── Sub-components ────────────────────────────────────────── */

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <FieldWrap>
      <Label>{label}</Label>
      <Input
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </FieldWrap>
  );
}

function ErrMsg({ msg }: { msg: string }) {
  return <ErrText>{msg}</ErrText>;
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <GlowPinkBtn type="submit" disabled={loading}>
      {loading ? "Please wait…" : label}
    </GlowPinkBtn>
  );
}

/* ── LoginForm ─────────────────────────────────────────────── */

function LoginForm() {
  const [method, setMethod] = useState<Method>("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [magicEmail, setMagicEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const callbackUrl = searchParams.get("callbackUrl") || "/verify-2fa";

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    const res = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid username or password.");
    } else {
      router.push("/verify-2fa");
    }
  }

  async function handlePasskey() {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (!username.trim()) {
        setError("Enter your username first.");
        setLoading(false);
        return;
      }

      const optRes = await fetch("/api/auth/passkey-auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const options = await optRes.json();

      const challenge = base64urlToBuffer(options.challenge);
      const allowCredentials =
        options.allowCredentials?.map(
          (c: { id: string; transports?: string[] }) => ({
            ...c,
            id: base64urlToBuffer(c.id),
          })
        ) ?? [];

      const credential = (await navigator.credentials.get({
        publicKey: { ...options, challenge, allowCredentials },
      })) as PublicKeyCredential;

      const response = credential.response as AuthenticatorAssertionResponse;

      const verifyRes = await fetch("/api/auth/passkey-auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          response: {
            id: credential.id,
            rawId: bufferToBase64url(credential.rawId),
            type: credential.type,
            response: {
              clientDataJSON: bufferToBase64url(response.clientDataJSON),
              authenticatorData: bufferToBase64url(response.authenticatorData),
              signature: bufferToBase64url(response.signature),
              userHandle: response.userHandle
                ? bufferToBase64url(response.userHandle)
                : null,
            },
          },
        }),
      });

      const data = await verifyRes.json();
      setLoading(false);
      if (data.ok) {
        router.push("/verify-2fa");
        router.refresh();
      } else {
        setError(data.error ?? "Passkey verification failed.");
      }
    } catch (e: unknown) {
      setLoading(false);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("NotAllowedError") || msg.includes("cancelled")) {
        setError("Passkey prompt cancelled.");
      } else {
        setError(msg);
      }
    }
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: magicEmail }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setInfo(
          `Check your inbox at ${magicEmail} — link expires in 15 minutes.`
        );
      }
    } catch {
      setError("Failed to send. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormCol>
      <TabBar>
        <Tab
          $active={method === "password"}
          onClick={() => {
            setMethod("password");
            setError("");
            setInfo("");
          }}
        >
          Password
        </Tab>
        <Tab
          $active={method === "passkey"}
          onClick={() => {
            setMethod("passkey");
            setError("");
            setInfo("");
          }}
        >
          Passkey
        </Tab>
        <Tab
          $active={method === "magic"}
          onClick={() => {
            setMethod("magic");
            setError("");
            setInfo("");
          }}
        >
          Magic Link
        </Tab>
      </TabBar>

      {method === "password" && (
        <FormInner onSubmit={handlePassword}>
          <Field
            label="Username"
            type="text"
            value={username}
            onChange={setUsername}
            autoComplete="username"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          {error && <ErrMsg msg={error} />}
          <SubmitBtn loading={loading} label="Sign In" />
        </FormInner>
      )}

      {method === "passkey" && (
        <FormCol>
          <Field
            label="Username"
            type="text"
            value={username}
            onChange={setUsername}
            autoComplete="username"
          />
          <HintText>
            Your browser will prompt for Face ID, Touch ID, or your hardware
            key.
          </HintText>
          {error && <ErrMsg msg={error} />}
          <PasskeyBtn onClick={handlePasskey} disabled={loading}>
            {loading ? "Waiting for browser…" : "🔑 Sign In with Passkey"}
          </PasskeyBtn>
          <HintText>
            Don&apos;t have a passkey yet?{" "}
            <PinkLink href="/login">Use password first</PinkLink>, then add one
            from the dashboard.
          </HintText>
        </FormCol>
      )}

      {method === "magic" && (
        <FormInner onSubmit={handleMagicLink}>
          <Field
            label="Email address"
            type="email"
            value={magicEmail}
            onChange={setMagicEmail}
            autoComplete="email"
          />
          {error && <ErrMsg msg={error} />}
          {info && <InfoText>{info}</InfoText>}
          <SubmitBtn loading={loading} label="Send Magic Link ✉" />
        </FormInner>
      )}
    </FormCol>
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

/* ── Page ──────────────────────────────────────────────────── */

export default function LoginPage() {
  return (
    <Main>
      <TopGlow />
      <Inner>
        <BrandBlock>
          <CompanyLabel>Tiny Global Village LLC</CompanyLabel>
          <BrandTitle>TGV</BrandTitle>
          <SubLabel>Office</SubLabel>
        </BrandBlock>

        <FormCard>
          <InternalNote>Internal access only</InternalNote>
          <Suspense
            fallback={
              <HintText>Loading&hellip;</HintText>
            }
          >
            <LoginForm />
          </Suspense>
        </FormCard>

        <Footer>Authorized personnel only &middot; 2FA required</Footer>
      </Inner>
    </Main>
  );
}
