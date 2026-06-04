"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import styled from "styled-components";
import { startAuthentication } from "@simplewebauthn/browser";
import { colors, rgb } from "../theme";

type Method = "passkey" | "password" | "magic" | "recovery";

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

const RememberRow = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--t-textMuted);
  cursor: pointer;
  user-select: none;
`;

const RememberCheck = styled.input`
  width: 14px;
  height: 14px;
  accent-color: ${colors.pink};
  cursor: pointer;
`;

const LinkBtn = styled.button`
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
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

const REMEMBER_USER_KEY = "tgv-office-remember-user";
const REMEMBER_FLAG_KEY = "tgv-office-remember-enabled";

function LoginForm() {
  const [method, setMethod] = useState<Method>("passkey");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [magicEmail, setMagicEmail] = useState("");
  const [recoveryUsername, setRecoveryUsername] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  // Hydrate pre-fill + remember preference from localStorage on mount.
  useEffect(() => {
    try {
      const savedFlag = window.localStorage.getItem(REMEMBER_FLAG_KEY);
      const flag = savedFlag === null ? true : savedFlag === "1";
      setRemember(flag);
      if (flag) {
        const savedUser = window.localStorage.getItem(REMEMBER_USER_KEY);
        if (savedUser) {
          setUsername(savedUser);
          setMagicEmail(savedUser.includes("@") ? savedUser : "");
        }
      }
    } catch { /* ignore */ }
  }, []);

  const persistRemember = (u: string) => {
    try {
      window.localStorage.setItem(REMEMBER_FLAG_KEY, remember ? "1" : "0");
      if (remember && u) window.localStorage.setItem(REMEMBER_USER_KEY, u);
      else window.localStorage.removeItem(REMEMBER_USER_KEY);
    } catch { /* ignore */ }
  };

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
      persistRemember(username);
      // Carry the intended destination through the 2FA step so we don't strand
      // the user on /verify-2fa afterwards.
      router.push(`/verify-2fa?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
  }

  async function handlePasskey() {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      // Usernameless / discoverable: no username needed. The browser offers the
      // resident passkeys for this site and the server resolves the account
      // from the assertion's userHandle. A typed username (optional) just
      // narrows allowCredentials.
      const optRes = await fetch("/api/auth/passkey-auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(username.trim() ? { username: username.trim() } : {}),
      });
      const options = await optRes.json();

      // @simplewebauthn/browser handles all encoding + the ceremony.
      const authResponse = await startAuthentication(options);

      const verifyRes = await fetch("/api/auth/passkey-auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim() || undefined,
          callbackUrl,
          response: authResponse,
        }),
      });

      const data = await verifyRes.json();
      setLoading(false);
      if (data.ok) {
        if (username.trim()) persistRemember(username.trim());
        // Passkey fully authenticates (server set the 2FA cookie) — go straight
        // to the destination instead of the TOTP screen.
        router.push(data.redirectTo || "/dashboard");
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
        persistRemember(magicEmail);
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

  async function handleRecovery(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recovery/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: recoveryUsername.trim(),
          code: recoveryCode.trim(),
          callbackUrl,
        }),
      });
      const data = await res.json();
      setLoading(false);
      if (data.ok) {
        if (recoveryUsername.trim()) persistRemember(recoveryUsername.trim());
        if (data.low) {
          // Non-blocking heads-up; the dashboard can prompt to regenerate.
          try { window.sessionStorage.setItem("tgv-recovery-low", "1"); } catch { /* ignore */ }
        }
        router.push(data.redirectTo || "/dashboard");
        router.refresh();
      } else {
        setError(data.error ?? "Invalid recovery code.");
      }
    } catch {
      setLoading(false);
      setError("Something went wrong. Try again.");
    }
  }

  return (
    <FormCol>
      {/* Passkey is the SINGLE standing login (passkey-only cutover, 2026-06-04).
          Password + magic-link tabs removed — those are no longer standing
          logins. Break-glass is the "Use a recovery code" link below + audited
          admin reset; the password credentials provider is gated off in
          auth.ts (ALLOW_PASSWORD_LOGIN env, default off). */}
      <TabBar>
        <Tab
          $active={method === "passkey" || method === "recovery"}
          onClick={() => { setMethod("passkey"); setError(""); setInfo(""); }}
        >
          Passkey
        </Tab>
      </TabBar>

      {method === "passkey" && (
        <FormCol>
          <HintText>
            Tap below and confirm with Face ID, Touch ID, your device PIN, or
            your phone. No username or password needed.
          </HintText>
          {error && <ErrMsg msg={error} />}
          <PasskeyBtn onClick={handlePasskey} disabled={loading}>
            {loading ? "Waiting for browser…" : "🔑 Sign In with Passkey"}
          </PasskeyBtn>
          <HintText>
            Lost your device?{" "}
            <LinkBtn
              type="button"
              onClick={() => { setMethod("recovery"); setError(""); setInfo(""); }}
            >
              Use a recovery code
            </LinkBtn>
          </HintText>
        </FormCol>
      )}

      {/* Password + magic-link login forms removed in the passkey-only cutover
          (2026-06-04). Their backends are gated off (auth.ts ALLOW_PASSWORD_LOGIN,
          magic-link routes ALLOW_MAGIC_LINK). Recovery codes (below) + audited
          admin reset are the break-glass. */}

      {method === "recovery" && (
        <FormInner onSubmit={handleRecovery}>
          <HintText>
            Enter your username and one of your saved recovery codes. Each code
            works once.
          </HintText>
          <Field
            label="Username"
            type="text"
            value={recoveryUsername}
            onChange={setRecoveryUsername}
            autoComplete="username"
          />
          <Field
            label="Recovery code"
            type="text"
            value={recoveryCode}
            onChange={setRecoveryCode}
            autoComplete="one-time-code"
          />
          {error && <ErrMsg msg={error} />}
          <SubmitBtn loading={loading} label="Sign In with Recovery Code" />
          <HintText>
            <LinkBtn
              type="button"
              onClick={() => { setMethod("passkey"); setError(""); setInfo(""); }}
            >
              ← Back to passkey
            </LinkBtn>
          </HintText>
        </FormInner>
      )}
    </FormCol>
  );
}

/* ── Page ──────────────────────────────────────────────────── */

export default function LoginPage() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN) {
      signIn("dev", { callbackUrl: "/dashboard" });
    }
  }, []);

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
