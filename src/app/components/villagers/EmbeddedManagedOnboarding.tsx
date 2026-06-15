"use client";
// EmbeddedManagedOnboarding — Office-local thin mount of Stripe's embedded Connect onboarding.
//
// Mirrors the canonical package component @tgv/module-stripe/connect/components/ManagedAccountOnboarding
// (which is consumed by the TENANT dashboard on tgv.com via that app's path alias). Office keeps a
// local copy ON PURPOSE: a bare cross-package subpath import of a `.tsx` (`@tgv/module-stripe/connect/
// components/…`) doesn't reliably resolve the extension under tsc bundler resolution (see memory
// feedback_module_editor_exports_need_extensions), and Office otherwise has no module-stripe dep. The
// flow is ~40 lines of @stripe/connect-js, so a local mount is cheaper + safer than wiring an alias.
import { useEffect, useRef, useState } from "react";
import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js";
import { ConnectComponentsProvider, ConnectAccountOnboarding } from "@stripe/react-connect-js";

export default function EmbeddedManagedOnboarding({
  publishableKey,
  fetchClientSecret,
  onExit,
  accentColor = "#f59e0b",
}: {
  publishableKey: string;
  fetchClientSecret: () => Promise<string>;
  onExit?: () => void;
  accentColor?: string;
}) {
  const [instance, setInstance] = useState<StripeConnectInstance | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fetchRef = useRef(fetchClientSecret);
  fetchRef.current = fetchClientSecret;

  useEffect(() => {
    let cancelled = false;
    try {
      const inst = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: () => fetchRef.current(),
        appearance: { overlays: "dialog", variables: { colorPrimary: accentColor } },
      });
      if (!cancelled) setInstance(inst);
    } catch (e) {
      if (!cancelled) setErr((e as Error).message || "Failed to initialize onboarding.");
    }
    return () => {
      cancelled = true;
    };
  }, [publishableKey, accentColor]);

  if (err) return <div style={{ fontSize: 13, color: "#ff6b6b", padding: 12 }}>Couldn’t start onboarding: {err}</div>;
  if (!instance) return <div style={{ fontSize: 13, color: "var(--t-textFaint)", padding: 12 }}>Loading secure onboarding…</div>;

  return (
    <ConnectComponentsProvider connectInstance={instance}>
      <ConnectAccountOnboarding onExit={onExit} />
    </ConnectComponentsProvider>
  );
}
