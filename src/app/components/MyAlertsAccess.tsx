"use client";

/**
 * MyAlertsAccess — drop-in launcher for the personal alerts feature.
 *
 * Renders a single button that opens MyAlertsModal. The modal includes
 * its own "⚙" gear button that opens UserAlertSettingsModal. This component
 * owns both modals' open/close state so the host only has to drop one thing.
 *
 * Usage:
 *   import MyAlertsAccess from "@/app/components/MyAlertsAccess";
 *   <MyAlertsAccess />          // default button
 *   <MyAlertsAccess as="tile"/> // renders as a dashboard tile shell instead
 *
 * Onboarding wiring (separate task — Phase 5b in tgv-personal-alerts.md):
 *   in the new-user signup flow, render <UserAlertSettingsModal isOnboarding>
 *   directly with `open` controlled by the wizard step state.
 */
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { MyAlertsModal, UserAlertSettingsModal } from "@tgv/module-calendar/alerts/components";
import { getSettings } from "@tgv/module-calendar/alerts/client";
import type {
  AlertChannel,
  AlertRecurrence,
  AlertVisibility,
  EmailFromMode,
  AlertSettings,
} from "@tgv/module-calendar/alerts";

const LauncherBtn = styled.button`
  background: transparent;
  color: #f7b700;
  border: 1px solid #2a2a2e;
  border-radius: 8px;
  padding: 8px 14px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  &:hover {
    border-color: #f7b700;
  }
`;

type Props = {
  /** Optional className for layout overrides. */
  className?: string;
  /** Override label. Defaults to "🔔 My Alerts". */
  label?: React.ReactNode;
  /** When true, hides the launcher button — use this when the host is mounting the component
   *  globally (e.g. in ClientShell or a dashboard root) and triggering it via the
   *  `open-my-alerts` window event instead of a visible button. */
  headless?: boolean;
};

export default function MyAlertsAccess({ className, label = "🔔 My Alerts", headless = false }: Props) {
  const [openMain, setOpenMain] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [settings, setSettings] = useState<AlertSettings | null>(null);

  // Global trigger — any component (e.g. the dashboard tile array) can dispatch
  // window.dispatchEvent(new CustomEvent("open-my-alerts")) to open the modal.
  useEffect(() => {
    function onOpen() { setOpenMain(true); }
    window.addEventListener("open-my-alerts", onOpen);
    return () => window.removeEventListener("open-my-alerts", onOpen);
  }, []);

  // First-time setup wizard — if the user has no settings row, surface
  // UserAlertSettingsModal in onboarding mode the first time they click in.
  useEffect(() => {
    if (!openMain) return;
    (async () => {
      const s = await getSettings().catch(() => null);
      setSettings(s);
      if (!s) {
        setNeedsOnboarding(true);
        setOpenSettings(true);
        setOpenMain(false);
      }
    })();
  }, [openMain]);

  function handleSettingsSaved() {
    setNeedsOnboarding(false);
    setOpenSettings(false);
    // Re-fetch and re-open the main modal now that defaults exist.
    getSettings()
      .then((s) => setSettings(s))
      .finally(() => setOpenMain(true));
  }

  const defaults =
    settings && {
      channels: settings.default_channels as AlertChannel[],
      recurrence: settings.default_recurrence as AlertRecurrence,
      visibility: settings.default_visibility as AlertVisibility,
      emailFromMode: settings.default_email_from_mode as EmailFromMode,
    };

  return (
    <>
      {!headless && (
        <LauncherBtn className={className} onClick={() => setOpenMain(true)}>
          {label}
        </LauncherBtn>
      )}

      <MyAlertsModal
        open={openMain}
        onClose={() => setOpenMain(false)}
        timezone={settings?.timezone ?? "UTC"}
        defaults={defaults ?? undefined}
        onOpenSettings={() => setOpenSettings(true)}
      />

      <UserAlertSettingsModal
        open={openSettings}
        onClose={() => setOpenSettings(false)}
        isOnboarding={needsOnboarding}
        onSaved={handleSettingsSaved}
      />
    </>
  );
}
