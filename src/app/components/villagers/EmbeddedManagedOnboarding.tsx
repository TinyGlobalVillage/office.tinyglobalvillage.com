"use client";
// EmbeddedManagedOnboarding — Office-local thin mount of Stripe's embedded Connect onboarding.
//
// Mirrors the canonical package component @tgv/module-stripe/connect/components/ManagedAccountOnboarding
// (which is consumed by the TENANT dashboard on tgv.com via that app's path alias). Office keeps a
// local copy ON PURPOSE: a bare cross-package subpath import of a `.tsx` (`@tgv/module-stripe/connect/
// components/…`) doesn't reliably resolve the extension under tsc bundler resolution (see memory
// feedback_module_editor_exports_need_extensions), and Office otherwise has no module-stripe dep. The
// flow is ~40 lines of @stripe/connect-js, so a local mount is cheaper + safer than wiring an alias.
//
// THEMING: Stripe renders the onboarding in an iframe, so it can't read Office's `--t-*` CSS vars.
// We map the SAME dark/light token objects Office uses (src/app/theme.ts) into Stripe's appearance
// API with RESOLVED colors, and re-apply via instance.update() when the operator flips light/dark —
// without re-initialising (that would refetch the account session + restart the flow).
import { useEffect, useRef, useState } from "react";
import {
  loadConnectAndInitialize,
  type StripeConnectInstance,
  type AppearanceOptions,
} from "@stripe/connect-js";
import { ConnectComponentsProvider, ConnectAccountOnboarding } from "@stripe/react-connect-js";
import { useTheme } from "../ThemeProvider";
import { colors } from "@/app/theme";

// Geist is loaded via next/font in the parent app; we can't push a self-hosted next/font face into
// the Stripe iframe without a public cssSrc, so we pass the family stack and let it fall back to a
// clean system sans inside the frame (close enough; a `fonts` loader is an optional follow-up).
const FONT_STACK = "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// Office theme → Stripe Connect appearance. Resolved colors only (no var() — iframe can't see them).
function buildAppearance(isDark: boolean): AppearanceOptions {
  const link = isDark ? colors.cyan : "#0277a8"; // cyan reads on dark; deepen it for white bg contrast
  const shared = {
    // Connect overlays are position:fixed full-viewport iframes appended to <body> with z-index = THIS
    // value (verified in Stripe's connect.js: overlay opener `Te` sets `l.style.zIndex = n`). Parked at
    // the 32-bit max purely as hygiene so the picker is always on top. NOTE: this was NOT the fix for the
    // "country picker won't open inside the Office modal" bug — a live test proved nothing on the dashboard
    // exceeds z-index 110, so a z-1000 overlay was already on top. That bug (overlay opens but shows no
    // content) is still open; the hosted-onboarding fallback button is the reliable path meanwhile.
    overlayZIndex: 2147483647,
    fontFamily: FONT_STACK,
    fontSizeBase: "15px",
    spacingUnit: "10px",
    borderRadius: "10px",
    colorPrimary: colors.gold,
    colorDanger: colors.red,
    // Inputs focus to cyan in Office — mirror that here.
    formHighlightColorBorder: colors.cyan,
    formAccentColor: colors.cyan,
    // Primary buttons = gold pill with dark ink (matches the modal's PrimaryBtn intent).
    buttonPrimaryColorBackground: colors.gold,
    buttonPrimaryColorBorder: colors.gold,
    buttonPrimaryColorText: "#1a1a1a",
    actionPrimaryColorText: link,
    actionSecondaryColorText: link,
    // Status badges → Office accent palette.
    badgeSuccessColorText: colors.green,
    badgeWarningColorText: colors.gold,
    badgeDangerColorText: colors.red,
  };

  if (isDark) {
    return {
      overlays: "dialog",
      variables: {
        ...shared,
        colorBackground: "#0c0d11",
        offsetBackgroundColor: "#0a0a0a", // matches --t-bg (dark) so the outer band blends with the modal
        formBackgroundColor: "#15151b",
        colorText: "#ededed",
        colorSecondaryText: "rgba(255,255,255,0.6)",
        colorBorder: "rgba(255,255,255,0.12)",
        overlayBackdropColor: "rgba(0,0,0,0.6)",
        buttonSecondaryColorBackground: "rgba(255,255,255,0.06)",
        buttonSecondaryColorBorder: "rgba(255,255,255,0.14)",
        buttonSecondaryColorText: "#ededed",
      },
    };
  }
  return {
    overlays: "dialog",
    variables: {
      ...shared,
      colorBackground: "#ffffff",
      offsetBackgroundColor: "#f8f6f3", // matches --t-bg (light)
      formBackgroundColor: "#ffffff",
      colorText: "#1a1a2e",
      colorSecondaryText: "rgba(26,26,46,0.6)",
      colorBorder: "rgba(0,0,0,0.12)",
      overlayBackdropColor: "rgba(26,26,46,0.25)",
      buttonSecondaryColorBackground: "rgba(0,0,0,0.04)",
      buttonSecondaryColorBorder: "rgba(0,0,0,0.12)",
      buttonSecondaryColorText: "#1a1a2e",
    },
  };
}

export default function EmbeddedManagedOnboarding({
  publishableKey,
  fetchClientSecret,
  onExit = () => {},
}: {
  publishableKey: string;
  fetchClientSecret: () => Promise<string>;
  onExit?: () => void;
}) {
  const { isDark } = useTheme();
  const [instance, setInstance] = useState<StripeConnectInstance | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fetchRef = useRef(fetchClientSecret);
  fetchRef.current = fetchClientSecret;

  // Initialise once per publishable key. Theme is NOT a dependency here — flipping it re-applies via
  // update() below, so we never refetch the account session or restart onboarding on a theme toggle.
  useEffect(() => {
    let cancelled = false;
    try {
      const inst = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: () => fetchRef.current(),
        appearance: buildAppearance(isDark),
      });
      if (!cancelled) setInstance(inst);
    } catch (e) {
      if (!cancelled) setErr((e as Error).message || "Failed to initialize onboarding.");
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishableKey]);

  // Re-theme live when the operator toggles Office light/dark.
  useEffect(() => {
    if (instance) instance.update({ appearance: buildAppearance(isDark) });
  }, [instance, isDark]);

  if (err) return <div style={{ fontSize: 13, color: colors.red, padding: 12 }}>Couldn’t start onboarding: {err}</div>;
  if (!instance) return <div style={{ fontSize: 13, color: "var(--t-textFaint)", padding: 12 }}>Loading secure onboarding…</div>;

  return (
    <ConnectComponentsProvider connectInstance={instance}>
      <ConnectAccountOnboarding onExit={onExit} />
    </ConnectComponentsProvider>
  );
}
