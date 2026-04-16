"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Step = "loading" | "scan" | "verify" | "done" | "error";

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
        if (d.error) { setStep("error"); return; }
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
      setError(data.error ?? "Code mismatch — try again.");
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "#ff4ecb", textShadow: "0 0 12px #ff66cc" }}>
            Set Up Authenticator
          </h1>
          <p className="text-xs text-white/40">Two-factor authentication required for all logins</p>
        </div>

        <div className="rounded-xl border p-8" style={{
          background: "rgba(255,255,255,0.03)",
          borderColor: "rgba(255,78,203,0.2)",
          boxShadow: "0 0 30px rgba(255,78,203,0.08)",
        }}>
          {step === "loading" && (
            <p className="text-xs text-white/30 text-center">Generating QR code…</p>
          )}

          {step === "error" && (
            <div className="text-center">
              <p className="text-sm text-red-400 mb-4">Failed to load setup. Are you logged in?</p>
              <button onClick={() => router.push("/login")} className="btn-glow-pink px-6 py-2 rounded-lg text-xs font-bold">
                Back to Login
              </button>
            </div>
          )}

          {step === "scan" && (
            <div className="flex flex-col items-center gap-5">
              <div className="steps text-xs text-white/50 self-start flex flex-col gap-1">
                <p className="font-bold text-white/70 mb-1">Step 1 — Install an authenticator app</p>
                <p>• Google Authenticator</p>
                <p>• Authy</p>
                <p>• 1Password</p>
                <p>• Apple Passwords (iOS 18+)</p>
              </div>

              <div className="font-bold text-xs text-white/70 self-start">Step 2 — Scan this QR code</div>

              {qr && (
                <div className="rounded-xl overflow-hidden p-2 bg-white">
                  <img src={qr} alt="TOTP QR Code" className="w-48 h-48" />
                </div>
              )}

              <div className="w-full">
                <p className="text-[10px] text-white/30 mb-1">Or enter this key manually:</p>
                <code className="block text-xs font-mono text-center py-2 px-3 rounded-lg break-all" style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "#ff4ecb",
                }}>
                  {secret}
                </code>
              </div>

              <button
                onClick={() => setStep("verify")}
                className="btn-glow-pink w-full py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider"
              >
                I&apos;ve scanned it →
              </button>
            </div>
          )}

          {step === "verify" && (
            <div className="flex flex-col gap-5">
              <p className="text-xs text-white/60">
                Enter the 6-digit code from your authenticator app to confirm setup.
              </p>
              <input
                type="text"
                inputMode="numeric"
                placeholder="000 000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9\s]/g, ""))}
                maxLength={7}
                className="w-full rounded-lg px-4 py-3 text-xl text-center font-mono text-white tracking-[0.4em] outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,78,203,0.3)",
                }}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                autoFocus
              />
              {error && <p className="text-xs text-red-400 text-center">{error}</p>}
              <button
                onClick={handleVerify}
                disabled={saving}
                className="btn-glow-pink py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {saving ? "Verifying…" : "Confirm & Enable 2FA"}
              </button>
              <button
                onClick={() => setStep("scan")}
                className="text-xs text-white/30 hover:text-white/60 text-center transition-colors"
              >
                ← Back to QR code
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="text-4xl">✅</div>
              <div>
                <p className="font-bold text-white mb-1">2FA enabled!</p>
                <p className="text-xs text-white/50">You&apos;ll need your authenticator on every login from now on.</p>
              </div>
              <button
                onClick={() => router.push("/verify-2fa")}
                className="btn-glow-pink w-full py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider"
              >
                Continue →
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
