"use client";

// PerformersControlModal — the operator MASTER console for the @tgv/module-performers suite, opened
// from a Villagers tile. Built on the shared HardeningControlModal shell + SuiteControlKit
// (styled-components + useSuiteControl hook + KillswitchSection), like Course/Studio. Convention:
// checklist `feature-suite-villagers-tiles` — one Villagers tile → one master modal with ALL of a
// suite's operator controls; the killswitch lives at the BOTTOM (rarely touched).
//
// Reads: cross-tenant usage (/api/admin/performers/usage) + activity (/api/admin/performers/audit-feed),
// both straight from tgv_db. Writes: the enablement/killswitch (/api/admin/performers/config) to the
// Office-owned shared config file the tenant dispatchers read via isPerformersEnabled().

import { colors } from "../../theme";
import HardeningControlModal, { type HCMSection } from "../hardening/HardeningControlModal";
import AuditLogTimeline from "../hardening/_shared/AuditLogTimeline";
import {
  type SuiteConfigBase,
  type SuiteTenantBase,
  Body,
  Dim,
  Err,
  Card,
  CardHead,
  TenantName,
  Pill,
  Stats,
  Stat,
  StatN,
  StatL,
  Table,
  fmtWhen,
  KillswitchSection,
  useSuiteControl,
} from "./_suite/SuiteControlKit";

/* ── Contract (mirror of lib/performers-config + api/usage) ──────────────────── */

type TenantConfig = SuiteTenantBase;
type PerformersConfig = SuiteConfigBase<TenantConfig>;

type UpcomingGig = { id: string; performer: string | null; eventAt: string | null; status: string };

type UsageTenant = {
  siteId: string;
  label: string;
  schema: string;
  enabled: boolean;
  error?: string | null;
  profiles?: { total: number; active: number; featured: number };
  offerings?: { total: number; active: number };
  gigs?: { total: number; upcoming: number; completed: number; requested: number; dropped: number };
  revenue?: { paidCents: number; paidCount: number; pendingCount: number };
  earnings?: { grossCents: number; payoutCents: number };
  pools?: { total: number; open: number };
  payouts?: { unpaid: number; paid: number };
  upcomingGigs?: UpcomingGig[];
};

const AUDIT_KINDS = [
  "performers.killswitch_on",
  "performers.killswitch_off",
  "performers.tenant_enabled",
  "performers.tenant_disabled",
  "performers.gig",
  "performers.earning",
];

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/* ── Component ────────────────────────────────────────────────────────────────── */

export type PerformersControlModalProps = { onClose: () => void };

export default function PerformersControlModal({ onClose }: PerformersControlModalProps) {
  const { config, usage, loading, loadErr, saving, switchErr, save } = useSuiteControl<
    PerformersConfig,
    UsageTenant,
    TenantConfig
  >("performers");

  /* ── Usage section ── */
  const usageBody = (
    <Body>
      {loading && <Dim>Loading…</Dim>}
      {loadErr && <Err>Couldn&apos;t load usage — {loadErr}</Err>}
      {!loading && usage?.length === 0 && <Dim>No tenants registered.</Dim>}
      {usage?.map((t) => (
        <Card key={t.siteId}>
          <CardHead>
            <TenantName>{t.label}</TenantName>
            <Pill $on={t.enabled}>{t.enabled ? "ENABLED" : "DISABLED"}</Pill>
          </CardHead>
          {t.error ? (
            <Err>read failed — {t.error}</Err>
          ) : (
            <>
              <Stats>
                <Stat><StatN>{t.profiles?.active ?? 0}</StatN><StatL>performers</StatL></Stat>
                <Stat><StatN>{t.gigs?.upcoming ?? 0}</StatN><StatL>upcoming gigs</StatL></Stat>
                <Stat><StatN>{t.offerings?.active ?? 0}</StatN><StatL>offerings</StatL></Stat>
                <Stat><StatN>{usd(t.revenue?.paidCents ?? 0)}</StatN><StatL>paid revenue</StatL></Stat>
                <Stat><StatN>{t.pools?.open ?? 0}</StatN><StatL>open pools</StatL></Stat>
                <Stat><StatN>{t.payouts?.unpaid ?? 0}</StatN><StatL>unpaid payouts</StatL></Stat>
              </Stats>
              {t.upcomingGigs && t.upcomingGigs.length > 0 && (
                <Table>
                  <thead>
                    <tr>
                      <th>Upcoming gig</th>
                      <th>When</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.upcomingGigs.map((g) => (
                      <tr key={g.id}>
                        <td>{g.performer ?? "—"}</td>
                        <td>{g.eventAt ? fmtWhen(g.eventAt) : "date TBD"}</td>
                        <td>{g.status.replaceAll("_", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <Dim style={{ marginTop: "0.35rem" }}>
                schema: {t.schema} · {t.profiles?.total ?? 0} profiles ({t.profiles?.featured ?? 0} featured) ·{" "}
                {t.gigs?.completed ?? 0} completed gigs
              </Dim>
            </>
          )}
        </Card>
      ))}
    </Body>
  );

  /* ── Health section ── */
  const healthBody = (() => {
    const live = (usage ?? []).filter((t) => !t.error);
    const performers = live.reduce((n, t) => n + (t.profiles?.active ?? 0), 0);
    const upcoming = live.reduce((n, t) => n + (t.gigs?.upcoming ?? 0), 0);
    const gross = live.reduce((n, t) => n + (t.earnings?.grossCents ?? 0), 0);
    const paidOut = live.reduce((n, t) => n + (t.earnings?.payoutCents ?? 0), 0);
    const unpaidRows = live.reduce((n, t) => n + (t.payouts?.unpaid ?? 0), 0);
    const pendingBuys = live.reduce((n, t) => n + (t.revenue?.pendingCount ?? 0), 0);
    const attention = live.filter((t) => (t.payouts?.unpaid ?? 0) > 0 || (t.revenue?.pendingCount ?? 0) > 0);
    return (
      <Body>
        {loading ? (
          <Dim>Loading…</Dim>
        ) : (
          <>
            <Stats>
              <Stat><StatN>{performers}</StatN><StatL>active performers</StatL></Stat>
              <Stat><StatN>{upcoming}</StatN><StatL>upcoming gigs</StatL></Stat>
              <Stat><StatN>{usd(gross)}</StatN><StatL>gross earned</StatL></Stat>
              <Stat><StatN>{usd(paidOut)}</StatN><StatL>paid out</StatL></Stat>
              <Stat><StatN>{unpaidRows}</StatN><StatL>unpaid rows</StatL></Stat>
              <Stat><StatN>{pendingBuys}</StatN><StatL>pending buys</StatL></Stat>
            </Stats>
            {attention.length > 0 ? (
              <Card>
                <Dim style={{ marginBottom: "0.3rem", fontWeight: 700, color: colors.gold }}>
                  Needs operator attention
                </Dim>
                {attention.map((t) => (
                  <Dim key={t.siteId}>
                    • {t.label}: {t.payouts?.unpaid ?? 0} unpaid payout row(s), {t.revenue?.pendingCount ?? 0} pending
                    purchase(s)
                  </Dim>
                ))}
              </Card>
            ) : (
              <Dim>No unpaid payout rows or pending purchases outstanding.</Dim>
            )}
          </>
        )}
      </Body>
    );
  })();

  /* ── Enablement & killswitch section (BOTTOM) — shared shell ── */
  const killBody = (
    <KillswitchSection<TenantConfig>
      config={config}
      saving={saving}
      switchErr={switchErr}
      suiteLabel="Performers"
      featureNoun="performers"
      onToggleGlobal={() => save({ globalKillswitch: !config?.globalKillswitch })}
      onToggleTenant={(siteId, tc) => save({ tenant: { siteId, enabled: !tc.enabled } })}
    />
  );

  const sections: HCMSection[] = [
    {
      id: "usage",
      title: "Usage (cross-tenant)",
      qmbm:
        "Live performers activity across every tenant on TGV — active performer roster, upcoming " +
        "gigs, the offering catalog, paid gig revenue, open income pools (the abundance model), and " +
        "unpaid payout rows. The table lists each tenant's next gigs.",
      body: usageBody,
    },
    {
      id: "health",
      title: "Health",
      qmbm:
        "At-a-glance suite health: roster size and upcoming gigs, gross performer earnings vs amount " +
        "already paid out, plus the two operator work-queues — unpaid payout rows and pending (unpaid) " +
        "gig purchases — surfaced per tenant so nothing sits uncollected.",
      body: healthBody,
    },
    {
      id: "enablement",
      title: "Enablement & Killswitch",
      qmbm:
        "The rarely-used emergency controls — kept at the bottom on purpose. The global killswitch " +
        "blocks the whole suite for everyone; per-tenant switches block one tenant. Both take effect " +
        "immediately (the tenant reads the shared config on the next call), and every change is " +
        "audited above. Default posture: everything ON.",
      body: killBody,
    },
  ];

  return (
    <HardeningControlModal
      title="Performers Suite"
      subtitle="Cross-tenant oversight for @tgv/module-performers — roster, gigs, pools/payouts, and the enablement killswitch."
      qmbm={
        "The master operator console for the Performers suite (talent booking + the abundance " +
        "split/payout model).\n\n" +
        "Top: a live activity feed (operator config changes + per-tenant gigs and the earnings " +
        "ledger). Then cross-tenant usage and health. The enablement killswitch sits at the very " +
        "bottom — it's the break-glass control you'll almost never touch."
      }
      onClose={onClose}
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/admin/performers/audit-feed" kinds={AUDIT_KINDS} />}
    />
  );
}
