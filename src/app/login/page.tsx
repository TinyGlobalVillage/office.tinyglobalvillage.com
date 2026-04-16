"use client";

import { useState, FormEvent, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";

type Method = "password" | "passkey" | "magic";

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

  // ── Password login ──────────────────────────────────────────
  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    const res = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid username or password.");
    } else {
      router.push("/verify-2fa");
    }
  }

  // ── Passkey login ────────────────────────────────────────────
  async function handlePasskey() {
    setError(""); setInfo(""); setLoading(true);
    try {
      if (!username.trim()) { setError("Enter your username first."); setLoading(false); return; }

      // 1. Get auth options
      const optRes = await fetch("/api/auth/passkey-auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const options = await optRes.json();

      // 2. Prompt browser
      const challenge = base64urlToBuffer(options.challenge);
      const allowCredentials = options.allowCredentials?.map((c: { id: string; transports?: string[] }) => ({
        ...c,
        id: base64urlToBuffer(c.id),
      })) ?? [];

      const credential = await navigator.credentials.get({
        publicKey: { ...options, challenge, allowCredentials },
      }) as PublicKeyCredential;

      const response = credential.response as AuthenticatorAssertionResponse;

      // 3. Verify with server
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
              userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
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

  // ── Magic link ────────────────────────────────────────────────
  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
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
        setInfo(`Check your inbox at ${magicEmail} — link expires in 15 minutes.`);
      }
    } catch {
      setError("Failed to send. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const tabStyle = (active: boolean) => ({
    flex: 1,
    padding: "6px 0",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    background: active ? "rgba(255,78,203,0.15)" : "transparent",
    color: active ? "#ff4ecb" : "rgba(255,255,255,0.3)",
    border: "none",
    borderBottom: active ? "1px solid #ff4ecb" : "1px solid transparent",
    cursor: "pointer",
    transition: "all 0.15s",
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Method tabs */}
      <div className="flex rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        <button style={tabStyle(method === "password")} onClick={() => { setMethod("password"); setError(""); setInfo(""); }}>
          Password
        </button>
        <button style={tabStyle(method === "passkey")} onClick={() => { setMethod("passkey"); setError(""); setInfo(""); }}>
          Passkey
        </button>
        <button style={tabStyle(method === "magic")} onClick={() => { setMethod("magic"); setError(""); setInfo(""); }}>
          Magic Link
        </button>
      </div>

      {/* ── Password form ── */}
      {method === "password" && (
        <form onSubmit={handlePassword} className="flex flex-col gap-4">
          <Field label="Username" type="text" value={username} onChange={setUsername} autoComplete="username" />
          <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
          {error && <ErrMsg msg={error} />}
          <SubmitBtn loading={loading} label="Sign In" />
        </form>
      )}

      {/* ── Passkey form ── */}
      {method === "passkey" && (
        <div className="flex flex-col gap-4">
          <Field label="Username" type="text" value={username} onChange={setUsername} autoComplete="username" />
          <p className="text-[10px] text-white/40 text-center">
            Your browser will prompt for Face ID, Touch ID, or your hardware key.
          </p>
          {error && <ErrMsg msg={error} />}
          <button
            onClick={handlePasskey}
            disabled={loading}
            className="py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider disabled:opacity-50 transition-all"
            style={{ background: "linear-gradient(135deg, #00bfff, #0080ff)", color: "#fff" }}
          >
            {loading ? "Waiting for browser…" : "🔑 Sign In with Passkey"}
          </button>
          <p className="text-[10px] text-white/30 text-center">
            Don&apos;t have a passkey yet?{" "}
            <a href="/login" className="underline" style={{ color: "#ff4ecb" }}>
              Use password first
            </a>
            , then add one from the dashboard.
          </p>
        </div>
      )}

      {/* ── Magic link form ── */}
      {method === "magic" && (
        <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
          <Field label="Email address" type="email" value={magicEmail} onChange={setMagicEmail} autoComplete="email" />
          {error && <ErrMsg msg={error} />}
          {info && <p className="text-xs text-green-400 text-center">{info}</p>}
          <SubmitBtn loading={loading} label="Send Magic Link ✉" />
        </form>
      )}
    </div>
  );
}

function Field({ label, type, value, onChange, autoComplete }: {
  label: string; type: string; value: string; onChange: (v: string) => void; autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] uppercase tracking-[0.2em] text-white/40">{label}</label>
      <input
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-4 py-2.5 text-sm text-white outline-none transition-all"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,78,203,0.2)" }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,78,203,0.6)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,78,203,0.2)")}
        required
      />
    </div>
  );
}

function ErrMsg({ msg }: { msg: string }) {
  return <p className="text-xs text-center" style={{ color: "#ff6b6b" }}>{msg}</p>;
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="btn-glow-pink mt-1 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Please wait…" : label}
    </button>
  );
}

// ── WebAuthn helpers ─────────────────────────────────────────────
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
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── Page ─────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0a0a0a]">
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,78,203,0.12) 0%, transparent 70%)" }}
      />
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/30 mb-3">Tiny Global Village LLC</p>
          <h1 className="text-4xl font-bold tracking-widest uppercase mb-1" style={{ color: "#ff4ecb", textShadow: "0 0 12px #ff66cc, 0 0 30px #ff4ecb" }}>
            TGV
          </h1>
          <p className="text-sm font-semibold text-white/50 tracking-wider">Office</p>
        </div>

        <div className="rounded-xl border p-8" style={{
          background: "rgba(255,255,255,0.03)",
          borderColor: "rgba(255,78,203,0.2)",
          boxShadow: "0 0 30px rgba(255,78,203,0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}>
          <p className="text-xs text-white/40 text-center mb-5 tracking-wide">Internal access only</p>
          <Suspense fallback={<p className="text-xs text-white/30 text-center">Loading…</p>}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-[10px] text-white/20 mt-6 tracking-wide">
          Authorized personnel only · 2FA required
        </p>
      </div>
    </main>
  );
}
