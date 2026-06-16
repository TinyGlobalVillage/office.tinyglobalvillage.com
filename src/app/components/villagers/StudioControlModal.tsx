"use client";

// StudioControlModal — the operator MASTER console for the @tgv/module-studio suite, opened from a
// Villagers tile. Built on the shared HardeningControlModal shell (sections + activity timeline +
// QMBM bubbles), like CourseControlModal / WalletControlModal. This is the convention from checklist
// `feature-suite-villagers-tiles`: every feature suite gets one Villagers tile → one master modal
// with ALL of its operator controls; the killswitch lives at the BOTTOM (rarely touched).
//
// Reads: cross-tenant usage (/api/admin/studio/usage) + activity (/api/admin/studio/audit-feed),
// both straight from tgv_db. Writes: the enablement/killswitch (/api/admin/studio/config) to the
// Office-owned shared config file the tenant dispatchers read via isStudioEnabled().

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import HardeningControlModal, { type HCMSection } from "../hardening/HardeningControlModal";
import AuditLogTimeline from "../hardening/_shared/AuditLogTimeline";

/* ── Contract (mirror of lib/studio-config + api/usage) ──────────────────────── */

type TenantConfig = { enabled: boolean; label?: string; schema: string };
type StudioConfig = { globalKillswitch: boolean; perTenant: Record<string, TenantConfig> };

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
  "studio.booking",
  "studio.entitlement",
];

/* ── Styled ──────────────────────────────────────────────────────────────────── */

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
`;
const Dim = styled.div`
  font-size: 0.8rem;
  color: var(--t-textFaint);
`;
const Err = styled.div`
  font-size: 0.8rem;
  color: ${colors.red};
`;
const Card = styled.div`
  border: 1px solid rgba(${rgb.gold}, 0.22);
  border-radius: 0.6rem;
  padding: 0.75rem 0.85rem;
  background: rgba(${rgb.gold}, 0.03);
`;
const CardHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;
const TenantName = styled.span`
  font-weight: 700;
  color: ${colors.gold};
  letter-spacing: 0.02em;
`;
const Pill = styled.span<{ $on: boolean }>`
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.green}, 0.5)` : `rgba(${rgb.red}, 0.5)`)};
  color: ${(p) => (p.$on ? colors.green : colors.red)};
  background: ${(p) => (p.$on ? `rgba(${rgb.green}, 0.08)` : `rgba(${rgb.red}, 0.08)`)};
`;
const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
  gap: 0.4rem 0.75rem;
  margin-bottom: 0.5rem;
`;
const Stat = styled.div`
  display: flex;
  flex-direction: column;
`;
const StatN = styled.span`
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--t-text);
`;
const StatL = styled.span`
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--t-textFaint);
`;
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.74rem;
  th,
  td {
    text-align: left;
    padding: 0.28rem 0.4rem;
    border-bottom: 1px solid rgba(${rgb.gold}, 0.1);
  }
  th {
    color: var(--t-textFaint);
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.6rem;
    letter-spacing: 0.05em;
  }
  td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
`;
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
const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.4rem 0;
`;
const RowMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
`;
const RowLabel = styled.span`
  font-weight: 600;
  color: var(--t-text);
  font-size: 0.85rem;
`;
const RowHelp = styled.span`
  font-size: 0.72rem;
  color: var(--t-textFaint);
`;
const Switch = styled.button<{ $on: boolean; $danger?: boolean }>`
  position: relative;
  width: 44px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 999px;
  border: 1px solid
    ${(p) => (p.$on ? `rgba(${p.$danger ? rgb.red : rgb.green}, 0.6)` : `rgba(${rgb.gold}, 0.3)`)};
  background: ${(p) =>
    p.$on ? `rgba(${p.$danger ? rgb.red : rgb.green}, 0.25)` : "rgba(255,255,255,0.06)"};
  cursor: pointer;
  transition: all 0.15s;
  &::after {
    content: "";
    position: absolute;
    top: 2px;
    left: ${(p) => (p.$on ? "22px" : "2px")};
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: ${(p) => (p.$on ? (p.$danger ? colors.red : colors.green) : colors.gold)};
    transition: left 0.15s;
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;
const Banner = styled.div<{ $danger: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.7rem;
  border-radius: 0.5rem;
  margin-bottom: 0.6rem;
  border: 1px solid ${(p) => (p.$danger ? `rgba(${rgb.red}, 0.55)` : `rgba(${rgb.green}, 0.4)`)};
  background: ${(p) => (p.$danger ? `rgba(${rgb.red}, 0.1)` : `rgba(${rgb.green}, 0.06)`)};
  color: ${(p) => (p.$danger ? colors.red : colors.green)};
  font-weight: 700;
  font-size: 0.82rem;
`;

/* ── Helpers ──────────────────────────────────────────────────────────────────── */

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* ── Component ────────────────────────────────────────────────────────────────── */

export type StudioControlModalProps = { onClose: () => void };

export default function StudioControlModal({ onClose }: StudioControlModalProps) {
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [usage, setUsage] = useState<UsageTenant[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [switchErr, setSwitchErr] = useState<string | null>(null);

  const loadConfig = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch("/api/admin/studio/config", { cache: "no-store", signal });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "config_load_failed");
    setConfig(d.config as StudioConfig);
  }, []);

  const loadUsage = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch("/api/admin/studio/usage", { cache: "no-store", signal });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "usage_load_failed");
    setUsage(d.tenants as UsageTenant[]);
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      setLoadErr(null);
      try {
        await Promise.all([loadConfig(ac.signal), loadUsage(ac.signal)]);
      } catch (e) {
        if (!ac.signal.aborted) setLoadErr(String((e as Error)?.message ?? e));
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [loadConfig, loadUsage]);

  const save = useCallback(async (patch: Record<string, unknown>): Promise<boolean> => {
    setSaving(true);
    setSwitchErr(null);
    try {
      const res = await fetch("/api/admin/studio/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "save_failed");
      setConfig(d.config as StudioConfig);
      return true;
    } catch (e) {
      setSwitchErr(String((e as Error)?.message ?? e));
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const tenantsCfg = useMemo(() => Object.entries(config?.perTenant ?? {}), [config]);

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
              <Dim>Every upcoming class has at least one booking. 🎉</Dim>
            )}
          </>
        )}
      </Body>
    );
  })();

  /* ── Enablement & killswitch section (BOTTOM) ── */
  const killBody = (
    <Body>
      {config && (
        <Banner $danger={config.globalKillswitch}>
          {config.globalKillswitch
            ? "⛔ GLOBAL KILLSWITCH ENGAGED — studio suite blocked for ALL tenants"
            : "✓ Studio suite live (per-tenant settings below)"}
        </Banner>
      )}
      <Row>
        <RowMain>
          <RowLabel>Global killswitch</RowLabel>
          <RowHelp>
            Emergency master off-switch — instantly blocks every studio op for every tenant. Rarely
            used. Default OFF. Takes effect immediately, no redeploy.
          </RowHelp>
        </RowMain>
        <Switch
          $on={!!config?.globalKillswitch}
          $danger
          disabled={saving || !config}
          aria-label="Toggle global killswitch"
          onClick={() => save({ globalKillswitch: !config?.globalKillswitch })}
        />
      </Row>

      {tenantsCfg.map(([memberId, tc]) => (
        <Card key={memberId}>
          <Row>
            <RowMain>
              <RowLabel>{tc.label ?? memberId}</RowLabel>
              <RowHelp>schema: {tc.schema} · {tc.enabled ? "studio feature ON" : "studio feature OFF"}</RowHelp>
            </RowMain>
            <Switch
              $on={tc.enabled}
              disabled={saving}
              aria-label={`Toggle studio for ${tc.label ?? memberId}`}
              onClick={() => save({ tenant: { memberId, enabled: !tc.enabled } })}
            />
          </Row>
        </Card>
      ))}
      {switchErr && <Err>Couldn&apos;t save — {switchErr}. The change did NOT take effect.</Err>}
    </Body>
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
