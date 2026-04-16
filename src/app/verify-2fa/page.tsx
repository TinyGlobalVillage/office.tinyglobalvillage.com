"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if user needs to set up 2FA first
    fetch("/api/auth/totp-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "000000" }), // probe
    }).then((r) => r.json()).then((d) => {
      if (d.error === "2FA not configured") setNeedsSetup(true);
    }).catch(() => {});
  }, []);

  const handleVerify = useCallback(async (codeOverride?: string) => {
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
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setCode("");
        setTimeout(() => inputRef.current?.focus(), 50);
      }, 500);
    }
  }, [code, router, searchParams]);

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    const clean = code.replace(/\s/g, "");
    if (clean.length === 6 && !loading) {
      handleVerify(clean);
    }
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (needsSetup) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-white/70">You haven&apos;t set up 2FA yet.</p>
        <p className="text-xs text-white/40">All accounts require an authenticator app.</p>
        <button
          onClick={() => router.push("/setup-2fa")}
          className="btn-glow-pink w-full py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider"
        >
          Set Up Authenticator →
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-white/60 text-center">
        Open your authenticator app and enter the 6-digit code for <strong>TGV Office</strong>.
      </p>

      <input
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
        className="w-full rounded-lg px-4 py-3 text-2xl text-center font-mono text-white tracking-[0.5em] outline-none transition-all"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${error ? "rgba(255,100,100,0.6)" : "rgba(255,78,203,0.3)"}`,
          animation: shake ? "shake 0.4s ease" : undefined,
        }}
        onKeyDown={(e) => { if (e.key === "Enter") handleVerify(); }}
        autoFocus
        disabled={loading}
      />
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
      `}</style>

      {error && <p className="text-xs text-red-400 text-center">{error}</p>}

      <button
        onClick={() => handleVerify()}
        disabled={loading}
        className="btn-glow-pink py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider disabled:opacity-50"
      >
        {loading ? "Verifying…" : "Verify Code"}
      </button>

      <button
        onClick={async () => {
          const { signOut } = await import("next-auth/react");
          signOut({ callbackUrl: "/login" });
        }}
        className="text-xs text-white/25 hover:text-white/50 text-center transition-colors"
      >
        Sign out &amp; start over
      </button>
    </div>
  );
}

export default function VerifyTwoFactorPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0a0a0a]">
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,78,203,0.1) 0%, transparent 70%)" }}
      />
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/30 mb-3">TGV Office</p>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "#ff4ecb", textShadow: "0 0 12px #ff66cc" }}>
            Two-Factor Auth
          </h1>
          <p className="text-xs text-white/40">Required for all access</p>
        </div>

        <div className="rounded-xl border p-8" style={{
          background: "rgba(255,255,255,0.03)",
          borderColor: "rgba(255,78,203,0.2)",
          boxShadow: "0 0 30px rgba(255,78,203,0.08)",
        }}>
          <Suspense fallback={<p className="text-xs text-white/30 text-center">Loading…</p>}>
            <VerifyForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
