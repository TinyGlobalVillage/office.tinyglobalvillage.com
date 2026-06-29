"use client";

// StudioControlModal — the operator MASTER console for the @tgv/module-studio suite, opened from a
// Villagers tile. Built on the shared HardeningControlModal shell + the shared SuiteControlKit
// (styled-components + useSuiteControl hook + KillswitchSection), like CourseControlModal. This is
// the convention from checklist `feature-suite-villagers-tiles`: every feature suite gets one
// Villagers tile → one master modal with ALL of its operator controls; the killswitch lives at the
// BOTTOM (rarely touched).
//
// Reads: cross-tenant usage (/api/admin/studio/usage) + activity (/api/admin/studio/audit-feed),
// both straight from tgv_db. Writes: the enablement/killswitch (/api/admin/studio/config) to the
// Office-owned shared config file the tenant dispatchers read via isStudioEnabled().

import { useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
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

/* ── Contract (mirror of lib/studio-config + api/usage) ──────────────────────── */

type TenantConfig = SuiteTenantBase & { lateCancelWindowHours?: number };
type StudioConfig = SuiteConfigBase<TenantConfig> & { lateCancelWindowHours?: number };

type UpcomingClass = { id: string; startAt: string; booked: number; capacity: number; name: string | null };

type UsageTenant = {
  memberId: string;
  label: string;
  schema: string;
  enabled: boolean;
  error?: string | null;
  catalog?: {
    serviceCategories: number;
    sessionTypes: number;
    appointmentTypes: number;
    pricingOptions: number;
    pricingActive: number;
  };
  classes?: { total: number; upcoming: number; past: number; canceled: number; seatsBooked: number };
  bookings?: {
    total: number;
    online: number;
    inHouse: number;
    clients: number;
    byStatus: {
      booked: number;
      waitlisted: number;
      checkedIn: number;
      completed: number;
      noShow: number;
      lateCancelled: number;
      cancelled: number;
    };
  };
  appointments?: { total: number; upcoming: number };
  entitlements?: { active: number; total: number; outstandingSessions: number };
  upcomingClasses?: UpcomingClass[];
  health?: { emptyUpcomingClasses: number; noShowRate: number | null };
};

const AUDIT_KINDS = [
  "studio.killswitch_on",
  "studio.killswitch_off",
  "studio.tenant_enabled",
  "studio.tenant_disabled",
  "studio.late_cancel_window_set",
  "studio.booking",
  "studio.entitlement",
];

/* ── Studio-specific styled (the shared ones come from SuiteControlKit) ───────── */

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0.15rem 0 0.4rem;
`;
const Chip = styled.span<{ $warn?: boolean }>`
  font-size: 0.64rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  color: ${(p) => (p.$warn ? colors.red : "var(--t-textFaint)")};
  background: ${(p) => (p.$warn ? `rgba(${rgb.red}, 0.1)` : "rgba(255,255,255,0.05)")};
  border: 1px solid ${(p) => (p.$warn ? `rgba(${rgb.red}, 0.3)` : `rgba(${rgb.gold}, 0.12)`)};
`;

const ForfRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin: 0.1rem 0 0.35rem;
`;
const NumInput = styled.input`
  width: 5rem;
  padding: 0.3rem 0.45rem;
  background: var(--t-surface);
  color: var(--t-text);
  border: 1px solid rgba(${rgb.gold}, 0.35);
  border-radius: 6px;
  font-size: 0.85rem;
  font-family: var(--font-geist-mono, monospace);
`;
const Unit = styled.span`
  font-size: 0.72rem;
  color: var(--t-textFaint);
`;
const SaveBtn = styled.button`
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  color: ${colors.gold};
  background: rgba(${rgb.gold}, 0.14);
  border: 1px solid rgba(${rgb.gold}, 0.45);
  cursor: pointer;
  &:hover:not(:disabled) {
    background: rgba(${rgb.gold}, 0.24);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;
const ResetBtn = styled.button`
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  font-size: 0.68rem;
  color: var(--t-textFaint);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  &:hover:not(:disabled) {
    color: var(--t-text);
    border-color: rgba(255, 255, 255, 0.25);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

/** One tenant's forfeiture-window editor: a number input + Save (enabled only when changed). */
function ForfeitureRow({
  label,
  current,
  globalDefault,
  saving,
  onSave,
}: {
  label: string;
  current: number | undefined;
  globalDefault: number;
  saving: boolean;
  onSave: (hours: number | null) => void;
}) {
  const effective = current ?? globalDefault;
  const [val, setVal] = useState(String(effective));
  // useState's initial arg is ignored on later renders, so after a save (the config refresh changes
  // `current`) re-sync the field to the persisted value — otherwise it would show the stale value.
  useEffect(() => {
    setVal(String(current ?? globalDefault));
  }, [current, globalDefault]);
  const n = Math.floor(Number(val));
  const dirty = val.trim() !== "" && Number.isFinite(n) && n >= 0 && n !== effective;
  return (
    <Card>
      <CardHead>
        <TenantName>{label}</TenantName>
      </CardHead>
      <ForfRow>
        <NumInput type="number" min={0} step={1} value={val} onChange={(e) => setVal(e.target.value)} />
        <Unit>hours</Unit>
        <SaveBtn disabled={!dirty || saving} onClick={() => onSave(n)}>
          {saving ? "Saving…" : "Save"}
        </SaveBtn>
        {current !== undefined && (
          <ResetBtn type="button" disabled={saving} onClick={() => onSave(null)}>
            Use default
          </ResetBtn>
        )}
      </ForfRow>
      <Dim>
        Cancel within this window forfeits the class credit (no refund); a no-show forfeits the same.{" "}
        {current === undefined ? `Using the platform default (${globalDefault}h).` : "Per-tenant override."}
      </Dim>
    </Card>
  );
}

/* ── Component ────────────────────────────────────────────────────────────────── */

export type StudioControlModalProps = { onClose: () => void };

export default function StudioControlModal({ onClose }: StudioControlModalProps) {
  const { config, usage, loading, loadErr, saving, switchErr, save } = useSuiteControl<
    StudioConfig,
    UsageTenant,
    TenantConfig
  >("studio");

  /* ── Usage section ── */
  const usageBody = (
    <Body>
      {loading && <Dim>Loading…</Dim>}
      {loadErr && <Err>Couldn&apos;t load usage — {loadErr}</Err>}
      {!loading && usage?.length === 0 && <Dim>No tenants registered.</Dim>}
      {usage?.map((t) => (
        <Card key={t.memberId}>
          <CardHead>
            <TenantName>{t.label}</TenantName>
            <Pill $on={t.enabled}>{t.enabled ? "ENABLED" : "DISABLED"}</Pill>
          </CardHead>
          {t.error ? (
            <Err>read failed — {t.error}</Err>
          ) : (
            <>
              <Stats>
                <Stat><StatN>{t.classes?.upcoming ?? 0}</StatN><StatL>upcoming classes</StatL></Stat>
                <Stat><StatN>{t.appointments?.upcoming ?? 0}</StatN><StatL>upcoming appts</StatL></Stat>
                <Stat><StatN>{t.bookings?.total ?? 0}</StatN><StatL>bookings</StatL></Stat>
                <Stat><StatN>{t.bookings?.clients ?? 0}</StatN><StatL>clients</StatL></Stat>
                <Stat><StatN>{t.entitlements?.active ?? 0}</StatN><StatL>active passes</StatL></Stat>
                <Stat><StatN>{t.catalog?.pricingActive ?? 0}</StatN><StatL>price options</StatL></Stat>
              </Stats>
              {t.bookings && t.bookings.total > 0 && (
                <Chips>
                  <Chip>online {t.bookings.online} · in-house {t.bookings.inHouse}</Chip>
                  <Chip>completed {t.bookings.byStatus.completed}</Chip>
                  <Chip>checked-in {t.bookings.byStatus.checkedIn}</Chip>
                  {t.bookings.byStatus.noShow > 0 && <Chip $warn>no-show {t.bookings.byStatus.noShow}</Chip>}
                  {t.bookings.byStatus.lateCancelled > 0 && (
                    <Chip $warn>late-cancel {t.bookings.byStatus.lateCancelled}</Chip>
                  )}
                </Chips>
              )}
              {t.upcomingClasses && t.upcomingClasses.length > 0 && (
                <Table>
                  <thead>
                    <tr>
                      <th>Upcoming class</th>
                      <th>When</th>
                      <th style={{ textAlign: "right" }}>Booked</th>
                      <th style={{ textAlign: "right" }}>Cap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.upcomingClasses.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name ?? "—"}</td>
                        <td>{fmtWhen(c.startAt)}</td>
                        <td className="num">{c.booked}</td>
                        <td className="num">{c.capacity}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <Dim style={{ marginTop: "0.35rem" }}>
                schema: {t.schema} · {t.classes?.total ?? 0} class instances · {t.catalog?.sessionTypes ?? 0} session
                types
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
    const emptyUpcoming = live.flatMap((t) =>
      (t.upcomingClasses ?? [])
        .filter((c) => c.booked === 0)
        .map((c) => ({ tenant: t.label, name: c.name ?? "—", when: c.startAt })),
    );
    const upcomingClasses = live.reduce((n, t) => n + (t.classes?.upcoming ?? 0), 0);
    const upcomingAppts = live.reduce((n, t) => n + (t.appointments?.upcoming ?? 0), 0);
    const activePasses = live.reduce((n, t) => n + (t.entitlements?.active ?? 0), 0);
    const outstanding = live.reduce((n, t) => n + (t.entitlements?.outstandingSessions ?? 0), 0);
    // weighted no-show across tenants
    const totNoShow = live.reduce((n, t) => n + (t.bookings?.byStatus.noShow ?? 0), 0);
    const totDone = live.reduce(
      (n, t) => n + (t.bookings?.byStatus.completed ?? 0) + (t.bookings?.byStatus.noShow ?? 0),
      0,
    );
    return (
      <Body>
        {loading ? (
          <Dim>Loading…</Dim>
        ) : (
          <>
            <Stats>
              <Stat><StatN>{upcomingClasses}</StatN><StatL>upcoming classes</StatL></Stat>
              <Stat><StatN>{upcomingAppts}</StatN><StatL>upcoming appts</StatL></Stat>
              <Stat><StatN>{activePasses}</StatN><StatL>active passes</StatL></Stat>
              <Stat><StatN>{outstanding}</StatN><StatL>sessions owed</StatL></Stat>
              <Stat>
                <StatN>{totDone > 0 ? `${Math.round((totNoShow / totDone) * 100)}%` : "—"}</StatN>
                <StatL>no-show rate</StatL>
              </Stat>
              <Stat><StatN>{emptyUpcoming.length}</StatN><StatL>empty classes</StatL></Stat>
            </Stats>
            {emptyUpcoming.length > 0 ? (
              <Card>
                <Dim style={{ marginBottom: "0.3rem", fontWeight: 700, color: colors.gold }}>
                  Upcoming classes with zero bookings
                </Dim>
                {emptyUpcoming.map((z, i) => (
                  <Dim key={i}>
                    • {z.tenant}: {z.name} — {fmtWhen(z.when)}
                  </Dim>
                ))}
              </Card>
            ) : (
              <Dim>Every upcoming class has at least one booking.</Dim>
            )}
          </>
        )}
      </Body>
    );
  })();

  /* ── Booking forfeiture (per-tenant late-cancel window) ── */
  const globalDefault = config?.lateCancelWindowHours ?? 12; // mirrors DEFAULT_LATE_CANCEL_WINDOW_HOURS
  const forfeitureBody = (
    <Body>
      {loading && <Dim>Loading…</Dim>}
      {loadErr && <Err>Couldn&apos;t load config — {loadErr}</Err>}
      {config &&
        Object.entries(config.perTenant).map(([memberId, tc]) => (
          <ForfeitureRow
            key={memberId}
            label={tc.label ?? memberId}
            current={tc.lateCancelWindowHours}
            globalDefault={globalDefault}
            saving={saving}
            onSave={(hours) => save({ tenant: { memberId, lateCancelWindowHours: hours } })}
          />
        ))}
    </Body>
  );

  /* ── Enablement & killswitch section (BOTTOM) — shared shell ── */
  const killBody = (
    <KillswitchSection<TenantConfig>
      config={config}
      saving={saving}
      switchErr={switchErr}
      suiteLabel="Studio"
      featureNoun="studio"
      onToggleGlobal={() => save({ globalKillswitch: !config?.globalKillswitch })}
      onToggleTenant={(memberId, tc) => save({ tenant: { memberId, enabled: !tc.enabled } })}
    />
  );

  const sections: HCMSection[] = [
    {
      id: "usage",
      title: "Usage (cross-tenant)",
      qmbm:
        "Live studio activity across every tenant on TGV — upcoming classes and appointments, total " +
        "bookings and distinct clients, active passes, and the price-option catalog. The booking " +
        "chips split online self-service from operator/walk-in bookings and flag no-shows and " +
        "late-cancels.",
      body: usageBody,
    },
    {
      id: "health",
      title: "Health",
      qmbm:
        "At-a-glance suite health: how many classes and appointments are coming up, how many passes " +
        "are still active (and the sessions still owed against them), the cross-tenant no-show rate, " +
        "and upcoming classes sitting at zero bookings (candidates to promote or cancel).",
      body: healthBody,
    },
    {
      id: "forfeiture",
      title: "Booking forfeiture",
      qmbm:
        "How late a customer can cancel before they forfeit the class credit. A cancel INSIDE this " +
        "window (hours before the class starts) is a late-cancel — the consumed credit is lost with " +
        "no refund; cancelling earlier returns the credit. A no-show forfeits the same way. Set it " +
        "per tenant; a tenant with no value uses the platform default (12h). Lose-credit only — no " +
        "extra wallet or token penalty.",
      body: forfeitureBody,
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
      title="Studio Suite"
      subtitle="Cross-tenant oversight for @tgv/module-studio — bookings, classes, passes, and the enablement killswitch."
      qmbm={
        "The master operator console for the Studio suite (the reinvented MindBody).\n\n" +
        "Top: a live activity feed (operator config changes + per-tenant bookings and pass ledger). " +
        "Then cross-tenant usage and health. The enablement killswitch sits at the very bottom — it's " +
        "the break-glass control you'll almost never touch."
      }
      onClose={onClose}
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/admin/studio/audit-feed" kinds={AUDIT_KINDS} />}
    />
  );
}
