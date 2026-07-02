"use client";

// SuiteControlKit — shared building blocks for every Villagers "feature suite" master modal
// (CourseControlModal, StudioControlModal, and future suites), per checklist
// `feature-suite-villagers-tiles`. Each suite tile is the same shape: cross-tenant usage + health
// sections on top, a per-tenant enablement killswitch at the BOTTOM, all on the HardeningControlModal
// shell with an Activity Timeline. This kit factors out the ~250 lines of identical styled-components,
// the data-loading hook, and the killswitch section that were copy-pasted between Course and Studio.
//
// Server-side counterparts live in src/lib/suite-oversight.ts (isSafeSchema, TimelineRow,
// fetchAdminAuditRows). Build-for-sharing: a new suite imports these, supplies its own usage/health
// section bodies + config type, and gets a consistent console for free.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../../theme";
import { BanIcon, CheckIcon } from "../../icons";

/* ── Shared contracts ─────────────────────────────────────────────────────────── */

/** The minimum shape every suite's per-tenant config row carries. Suites may extend it
 *  (e.g. Course adds `maxCourses`). */
export type SuiteTenantBase = { enabled: boolean; label?: string; schema: string };

/** The enablement config every suite tile reads/writes: a global killswitch + a per-tenant map
 *  keyed by site_id. */
export type SuiteConfigBase<TTenant extends SuiteTenantBase = SuiteTenantBase> = {
  globalKillswitch: boolean;
  perTenant: Record<string, TTenant>;
};

/* ── Shared styled-components ──────────────────────────────────────────────────── */

export const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
`;
export const Dim = styled.div`
  font-size: 0.8rem;
  color: var(--t-textFaint);
`;
export const Err = styled.div`
  font-size: 0.8rem;
  color: ${colors.red};
`;
export const Card = styled.div`
  border: 1px solid rgba(${rgb.gold}, 0.22);
  border-radius: 0.6rem;
  padding: 0.75rem 0.85rem;
  background: rgba(${rgb.gold}, 0.03);
`;
export const CardHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;
export const TenantName = styled.span`
  font-weight: 700;
  color: ${colors.gold};
  letter-spacing: 0.02em;
`;
export const Pill = styled.span<{ $on: boolean }>`
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.green}, 0.5)` : `rgba(${rgb.red}, 0.5)`)};
  color: ${(p) => (p.$on ? colors.green : colors.red)};
  background: ${(p) => (p.$on ? `rgba(${rgb.green}, 0.08)` : `rgba(${rgb.red}, 0.08)`)};
`;
export const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
  gap: 0.4rem 0.75rem;
  margin-bottom: 0.5rem;
`;
export const Stat = styled.div`
  display: flex;
  flex-direction: column;
`;
export const StatN = styled.span`
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--t-text);
`;
export const StatL = styled.span`
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--t-textFaint);
`;
export const Table = styled.table`
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
export const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.4rem 0;
`;
export const RowMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
`;
export const RowLabel = styled.span`
  font-weight: 600;
  color: var(--t-text);
  font-size: 0.85rem;
`;
export const RowHelp = styled.span`
  font-size: 0.72rem;
  color: var(--t-textFaint);
`;
export const Switch = styled.button<{ $on: boolean; $danger?: boolean }>`
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
export const Banner = styled.div<{ $danger: boolean }>`
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

/* ── Shared helpers ───────────────────────────────────────────────────────────── */

/** Compact "Jun 14, 3:05 PM"-style stamp; falls back to the raw string on parse failure. */
export function fmtWhen(iso: string): string {
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

/* ── Data-loading hook ────────────────────────────────────────────────────────── */

export type UseSuiteControl<TCfg, TUsage> = {
  config: TCfg | null;
  usage: TUsage[] | null;
  loading: boolean;
  loadErr: string | null;
  saving: boolean;
  switchErr: string | null;
  /** PUT a single-control patch to /api/admin/<prefix>/config; returns true on success. */
  save: (patch: Record<string, unknown>) => Promise<boolean>;
};

/**
 * Loads a suite's enablement config + cross-tenant usage from
 * /api/admin/<prefix>/{config,usage} and exposes a `save(patch)` writer. Identical fetch/abort/error
 * plumbing for every suite tile — only the `prefix` differs.
 */
export function useSuiteControl<TCfg extends SuiteConfigBase<TTenant>, TUsage, TTenant extends SuiteTenantBase = SuiteTenantBase>(
  prefix: string,
): UseSuiteControl<TCfg, TUsage> {
  const [config, setConfig] = useState<TCfg | null>(null);
  const [usage, setUsage] = useState<TUsage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [switchErr, setSwitchErr] = useState<string | null>(null);

  const loadConfig = useCallback(
    async (signal?: AbortSignal) => {
      const res = await fetch(`/api/admin/${prefix}/config`, { cache: "no-store", signal });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "config_load_failed");
      setConfig(d.config as TCfg);
    },
    [prefix],
  );

  const loadUsage = useCallback(
    async (signal?: AbortSignal) => {
      const res = await fetch(`/api/admin/${prefix}/usage`, { cache: "no-store", signal });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "usage_load_failed");
      setUsage(d.tenants as TUsage[]);
    },
    [prefix],
  );

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

  const save = useCallback(
    async (patch: Record<string, unknown>): Promise<boolean> => {
      setSaving(true);
      setSwitchErr(null);
      try {
        const res = await fetch(`/api/admin/${prefix}/config`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error ?? "save_failed");
        setConfig(d.config as TCfg);
        return true;
      } catch (e) {
        setSwitchErr(String((e as Error)?.message ?? e));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [prefix],
  );

  return { config, usage, loading, loadErr, saving, switchErr, save };
}

/* ── Killswitch section (BOTTOM of every suite modal) ─────────────────────────── */

export type KillswitchSectionProps<TTenant extends SuiteTenantBase> = {
  config: SuiteConfigBase<TTenant> | null;
  saving: boolean;
  switchErr: string | null;
  /** Capitalized suite name for the banner, e.g. "Course". */
  suiteLabel: string;
  /** Lower-case feature noun for per-tenant help, e.g. "course" → "course feature ON". */
  featureNoun: string;
  /** Flip the global killswitch. */
  onToggleGlobal: () => void;
  /** Flip one tenant's enablement. */
  onToggleTenant: (siteId: string, tc: TTenant) => void;
  /** Optional per-tenant extra control (e.g. Course's max-courses cap), rendered inside the card. */
  renderTenantExtra?: (siteId: string, tc: TTenant) => ReactNode;
};

export function KillswitchSection<TTenant extends SuiteTenantBase>({
  config,
  saving,
  switchErr,
  suiteLabel,
  featureNoun,
  onToggleGlobal,
  onToggleTenant,
  renderTenantExtra,
}: KillswitchSectionProps<TTenant>) {
  const tenantsCfg = useMemo(() => Object.entries(config?.perTenant ?? {}), [config]);
  const lower = suiteLabel.toLowerCase();
  return (
    <Body>
      {config && (
        <Banner $danger={config.globalKillswitch}>
          {config.globalKillswitch ? <BanIcon size={15} /> : <CheckIcon size={15} />}
          {config.globalKillswitch
            ? `GLOBAL KILLSWITCH ENGAGED — ${lower} suite blocked for ALL tenants`
            : `${suiteLabel} suite live (per-tenant settings below)`}
        </Banner>
      )}
      <Row>
        <RowMain>
          <RowLabel>Global killswitch</RowLabel>
          <RowHelp>
            Emergency master off-switch — instantly blocks every {lower} op for every tenant. Rarely
            used. Default OFF. Takes effect immediately, no redeploy.
          </RowHelp>
        </RowMain>
        <Switch
          $on={!!config?.globalKillswitch}
          $danger
          disabled={saving || !config}
          aria-label="Toggle global killswitch"
          onClick={onToggleGlobal}
        />
      </Row>

      {tenantsCfg.map(([siteId, tc]) => (
        <Card key={siteId}>
          <Row>
            <RowMain>
              <RowLabel>{tc.label ?? siteId}</RowLabel>
              <RowHelp>
                schema: {tc.schema} · {tc.enabled ? `${featureNoun} feature ON` : `${featureNoun} feature OFF`}
              </RowHelp>
            </RowMain>
            <Switch
              $on={tc.enabled}
              disabled={saving}
              aria-label={`Toggle ${featureNoun} for ${tc.label ?? siteId}`}
              onClick={() => onToggleTenant(siteId, tc)}
            />
          </Row>
          {renderTenantExtra?.(siteId, tc)}
        </Card>
      ))}
      {switchErr && <Err>Couldn&apos;t save — {switchErr}. The change did NOT take effect.</Err>}
    </Body>
  );
}
