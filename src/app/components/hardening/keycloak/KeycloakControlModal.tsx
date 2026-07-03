"use client";

// KeycloakControlModal — the Keycloak IdP hardening surface (E17,
// villager-identity-convergence). HCM shape: activity timeline on top,
// QMBM-explained sections, audit-logged mutations via
// /api/hardening/keycloak/*.
//
// Realm truth lives in Keycloak (read/written over admin REST as
// office-admin-svc); the only Office-side state is the runtime config
// (kill-switch + enrollment-email return target).

import { useCallback, useEffect, useState } from "react";
import HardeningControlModal, {
  type HCMSection,
} from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import {
  RealmStatusPanel,
  LifetimesPanel,
  BruteForcePanel,
  ClientsPanel,
  MembersPanel,
  OfficeConfigPanel,
  type KcStatusView,
} from "./KeycloakPanels";

export type KeycloakControlModalProps = {
  onClose: () => void;
};

export default function KeycloakControlModal({ onClose }: KeycloakControlModalProps) {
  const [status, setStatus] = useState<KcStatusView | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/hardening/keycloak/status", {
        credentials: "same-origin", cache: "no-store",
      });
      if (!res.ok) return;
      setStatus(await res.json());
    } catch { /* swallow — modal renders with prior or null status */ }
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const sections: HCMSection[] = [
    {
      id: "realm-status",
      title: "Realm Status & Health",
      qmbm:
        "Keycloak at id.tinyglobalvillage.com is THE fleet login — every app (tgv.com, Office, " +
        "refusionist, giocoelho, resonantweaver) redirects /login to it (AUTH_IDP=keycloak) and mints " +
        "its LOCAL member session from the OIDC callback.\n\n" +
        "Health is read from the loopback management port (3012). The login flow must stay " +
        "tgv-passkey-browser (passkey-only, zero-click-first; the recovery subflow is deliberately " +
        "DISABLED — Keycloak would render a username form first, which broke the ceremony live on " +
        "2026-07-03). Member recovery is app-side: /login?recovery=1 on every app.\n\n" +
        "If the container is DOWN: cd /srv/refusion-core/data/keycloak && docker compose up -d. " +
        "Per-app rollback: AUTH_IDP=local + pm2 reload <app> --update-env (local passkeys stay valid " +
        "until F19 retires them).",
      body: <RealmStatusPanel status={status} />,
    },
    {
      id: "lifetimes",
      title: "Session & Token Lifetimes",
      qmbm:
        "SSO idle = how long between visits before the IdP session dies; SSO max = its hard cap; " +
        "access token = the short-lived bearer minted per app (canon: 14d / 30d / 5min, 2026-07-02).\n\n" +
        "Longer SSO = fewer passkey ceremonies when switching dashboards; shorter = tighter exposure " +
        "window if a device is lost. App-local sessions (member_sessions, 30d) are NOT affected by " +
        "these — a member stays signed in to an app until ITS session ends; these lifetimes govern " +
        "how long dashboard-switching stays silent.",
      body: <LifetimesPanel status={status} onSave={refreshStatus} />,
    },
    {
      id: "brute-force",
      title: "Brute-Force Protection",
      qmbm:
        "Keycloak-side lockout: after N failures the account waits (escalating), capped at max wait. " +
        "Members are passkey-only — a passkey can't be brute-forced — so this mostly guards the " +
        "KC-native recovery-code credential (enrolled for the future conditional-LoA branch) and any " +
        "future form-based flow. Settings apply realm-wide on the next failed attempt.",
      body: <BruteForcePanel status={status} onSave={refreshStatus} />,
    },
    {
      id: "clients",
      title: "OIDC Clients",
      qmbm:
        "One confidential client per site (the relying-parties) + service accounts (tgv-admin-svc = " +
        "tgv.com wizard/Settings, users-only; office-admin-svc = THIS surface, realm+clients+users; " +
        "orakle-svc / cospro = the Orakle S2S handshake).\n\n" +
        "Redirect URIs are registered in slashed AND unslashed forms because 4 of 5 apps run " +
        "trailingSlash:true (Office is the unslashed exception). New tenant RPs are wired from " +
        "Villagers → Wire Client to Keycloak — never by hand-editing here.",
      body: <ClientsPanel status={status} />,
    },
    {
      id: "members",
      title: "Members (Realm Users)",
      qmbm:
        "The realm's user directory — one entry per person, joined to the members row by " +
        "keycloak_sub (Model B: Keycloak owns credentials, members owns profile/app data).\n\n" +
        "Resend enrollment = the C8/D12 execute-actions email (passkey + recovery-code setup, " +
        "one-time themed link; return target set in Office-side Config below). Sign out everywhere = " +
        "ends all Keycloak SSO sessions AND the shared tgv.com/Office session; tenant apps keep " +
        "their local session until it idles out, but can mint no new ones. 'Enrollment pending' " +
        "means required actions are still queued (the member hasn't completed passkey setup).",
      body: <MembersPanel onAction={refreshStatus} />,
    },
    {
      id: "office-config",
      title: "Office-side Config",
      qmbm:
        "The only state this surface keeps OUTSIDE Keycloak (data/keycloak/keycloak-config.json, " +
        "hot-reloaded). The kill-switch turns the whole surface read-only for realm mutations — " +
        "flip it if operators shouldn't touch lifetimes/brute-force for a while. The enrollment " +
        "return block controls where a re-sent enrollment email lands after setup; the URI must be " +
        "registered as a redirect URI on that client.",
      body: <OfficeConfigPanel status={status} onSave={refreshStatus} />,
    },
  ];

  return (
    <HardeningControlModal
      title="Keycloak Identity Provider"
      subtitle="id.tinyglobalvillage.com — realm tgv · fleet login · lifetimes, brute-force, clients, members."
      qmbm={
        "The self-hosted OIDC IdP behind every /login on the platform. This surface reads and " +
        "writes the realm over admin REST as office-admin-svc; every mutation lands in the " +
        "Activity Timeline. Infra truth + gotchas: rcs-stack/keycloak.md."
      }
      onClose={onClose}
      sections={sections}
      auditLogView={
        <AuditLogTimeline
          endpoint="/api/hardening/keycloak/audit-log"
          kinds={["realm", "user", "client", "config"]}
        />
      }
    />
  );
}
