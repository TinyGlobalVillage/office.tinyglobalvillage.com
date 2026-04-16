"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPasskeyPage() {
  const [deviceName, setDeviceName] = useState("");
  const [status, setStatus] = useState<"idle" | "registering" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  async function handleRegister() {
    if (!deviceName.trim()) { setErrorMsg("Give this device a name first."); return; }
    setStatus("registering");
    setErrorMsg("");

    try {
      // 1. Get registration options from server
      const optRes = await fetch("/api/auth/passkey-register-options", { method: "POST" });
      if (!optRes.ok) { setErrorMsg("Failed to start registration."); setStatus("error"); return; }
      const options = await optRes.json();

      // 2. Decode the challenge from base64url to ArrayBuffer
      const challenge = base64urlToBuffer(options.challenge);
      const userId = base64urlToBuffer(options.user.id);

      // 3. Call the browser WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge,
          user: { ...options.user, id: userId },
          excludeCredentials: options.excludeCredentials?.map((c: { id: string }) => ({
            ...c,
            id: base64urlToBuffer(c.id),
          })) ?? [],
        },
      }) as PublicKeyCredential;

      const response = credential.response as AuthenticatorAttestationResponse;

      // 4. Send to server for verification
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
              attestationObject: bufferToBase64url(response.attestationObject),
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
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0a0a0a]">
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "#00bfff", textShadow: "0 0 12px #00bfff" }}>
            Add a Passkey
          </h1>
          <p className="text-xs text-white/40">Face ID · Touch ID · Windows Hello · Hardware key</p>
        </div>

        <div className="rounded-xl border p-8" style={{
          background: "rgba(255,255,255,0.03)",
          borderColor: "rgba(0,191,255,0.2)",
          boxShadow: "0 0 30px rgba(0,191,255,0.06)",
        }}>
          {status === "done" ? (
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="text-4xl">🔑</div>
              <div>
                <p className="font-bold text-white mb-1">Passkey registered!</p>
                <p className="text-xs text-white/50">
                  &quot;{deviceName}&quot; is now available for login. Your passkey syncs via iCloud / Google Password Manager.
                </p>
              </div>
              <button onClick={() => router.push("/dashboard")} className="btn-glow w-full py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider">
                Back to Dashboard
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <p className="text-xs text-white/60">
                Passkeys let you sign in with Face ID, Touch ID, or your hardware key — no password needed.
                They sync automatically across your devices via iCloud or Google.
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                  Device name (e.g. &quot;Gio&apos;s MacBook&quot;)
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="My iPhone"
                  className="w-full rounded-lg px-4 py-2.5 text-sm text-white outline-none"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(0,191,255,0.2)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,191,255,0.6)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(0,191,255,0.2)")}
                />
              </div>

              {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}

              <button
                onClick={handleRegister}
                disabled={status === "registering"}
                className="btn-glow py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #00bfff, #0080ff)" }}
              >
                {status === "registering" ? "Follow browser prompt…" : "Register Passkey 🔑"}
              </button>

              <button onClick={() => router.back()} className="text-xs text-white/25 hover:text-white/50 text-center">
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

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
