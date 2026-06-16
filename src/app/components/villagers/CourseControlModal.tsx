"use client";

// CourseControlModal — the operator MASTER console for the @tgv/module-course suite, opened from a
// Villagers tile. Built on the shared HardeningControlModal shell (sections + activity timeline +
// QMBM bubbles), like WalletControlModal. This is the convention seeded by checklist
// `feature-suite-villagers-tiles`: every feature suite gets one Villagers tile → one master modal
// with ALL of its operator controls; the killswitch lives at the BOTTOM (rarely touched).
//
// Reads: cross-tenant usage (/api/admin/course/usage) + activity (/api/admin/course/audit-feed),
// both straight from tgv_db. Writes: the enablement/killswitch (/api/admin/course/config) to the
// Office-owned shared config file the tenant dispatchers read.

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import HardeningControlModal, { type HCMSection } from "../hardening/HardeningControlModal";
import AuditLogTimeline from "../hardening/_shared/AuditLogTimeline";

/* ── Contract (mirror of lib/course-config + api/usage) ──────────────────────── */

type TenantConfig = { enabled: boolean; label?: string; schema: string; maxCourses?: number | null };
type CourseConfig = { globalKillswitch: boolean; perTenant: Record<string, TenantConfig> };

type PerCourse = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  enrollments: number;
  completions: number;
  certificates: number;
  attempts: number;
  passed: number;
};
type UsageTenant = {
  memberId: string;
  label: string;
  schema: string;
  enabled: boolean;
  error?: string | null;
  courses?: { draft: number; published: number; archived: number; total: number };
  enrollments?: number;
  completions?: number;
  certificates?: number;
  learners?: number;
  attempts?: { graded: number; passed: number };
  health?: { zeroEnrollPublished: number };
  perCourse?: PerCourse[];
};

const AUDIT_KINDS = [
  "course.killswitch_on",
  "course.killswitch_off",
  "course.tenant_enabled",
  "course.tenant_disabled",
  "course.config_update",
  "course.course_created",
  "course.course_published",
  "course.tree_changed",
  "course.page_saved",
  "course.media_changed",
  "course.assessment_changed",
  "course.enrollment_changed",
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
const StatusTag = styled.span<{ $s: string }>`
  font-size: 0.6rem;
  font-weight: 700;
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
  color: ${(p) => (p.$s === "published" ? colors.green : p.$s === "draft" ? colors.gold : "var(--t-textFaint)")};
  background: ${(p) =>
    p.$s === "published" ? `rgba(${rgb.green}, 0.1)` : p.$s === "draft" ? `rgba(${rgb.gold}, 0.1)` : "transparent"};
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
const CapRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;
const NumInput = styled.input`
  width: 5rem;
  padding: 0.25rem 0.4rem;
  font-size: 0.8rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(${rgb.gold}, 0.3);
  background: rgba(0, 0, 0, 0.15);
  color: var(--t-text);
`;
const SaveBtn = styled.button`
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(${rgb.gold}, 0.45);
  background: rgba(${rgb.gold}, 0.12);
  color: ${colors.gold};
  cursor: pointer;
  &:disabled {
    opacity: 0.4;
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

/* ── Component ────────────────────────────────────────────────────────────────── */

export type CourseControlModalProps = { onClose: () => void };

export default function CourseControlModal({ onClose }: CourseControlModalProps) {
  const [config, setConfig] = useState<CourseConfig | null>(null);
  const [usage, setUsage] = useState<UsageTenant[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [switchErr, setSwitchErr] = useState<string | null>(null);
  // local maxCourses edit buffer, keyed by memberId
  const [capDraft, setCapDraft] = useState<Record<string, string>>({});

  const loadConfig = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch("/api/admin/course/config", { cache: "no-store", signal });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? "config_load_failed");
    setConfig(d.config as CourseConfig);
  }, []);

  const loadUsage = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch("/api/admin/course/usage", { cache: "no-store", signal });
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

  const save = useCallback(
    async (patch: Record<string, unknown>): Promise<boolean> => {
      setSaving(true);
      setSwitchErr(null);
      try {
        const res = await fetch("/api/admin/course/config", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error ?? "save_failed");
        setConfig(d.config as CourseConfig);
        return true;
      } catch (e) {
        setSwitchErr(String((e as Error)?.message ?? e));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

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
                <Stat><StatN>{t.courses?.published ?? 0}</StatN><StatL>published</StatL></Stat>
                <Stat><StatN>{t.courses?.draft ?? 0}</StatN><StatL>draft</StatL></Stat>
                <Stat><StatN>{t.enrollments ?? 0}</StatN><StatL>enrolled</StatL></Stat>
                <Stat><StatN>{t.completions ?? 0}</StatN><StatL>completed</StatL></Stat>
                <Stat><StatN>{t.learners ?? 0}</StatN><StatL>learners</StatL></Stat>
                <Stat><StatN>{t.certificates ?? 0}</StatN><StatL>certs</StatL></Stat>
              </Stats>
              {t.perCourse && t.perCourse.length > 0 && (
                <Table>
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Enr.</th>
                      <th style={{ textAlign: "right" }}>Compl.</th>
                      <th style={{ textAlign: "right" }}>Pass</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.perCourse.map((c) => (
                      <tr key={c.id}>
                        <td>{c.title}</td>
                        <td><StatusTag $s={c.status}>{c.status}</StatusTag></td>
                        <td className="num">{c.enrollments}</td>
                        <td className="num">{c.completions}</td>
                        <td className="num">{c.attempts > 0 ? `${Math.round((c.passed / c.attempts) * 100)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <Dim style={{ marginTop: "0.35rem" }}>real learners only — operator preview runs excluded</Dim>
            </>
          )}
        </Card>
      ))}
    </Body>
  );

  /* ── Health section ── */
  const healthBody = (() => {
    const live = (usage ?? []).filter((t) => !t.error);
    const zeroPub = live.flatMap((t) =>
      (t.perCourse ?? [])
        .filter((c) => c.status === "published" && c.enrollments === 0)
        .map((c) => ({ tenant: t.label, title: c.title })),
    );
    const draft = live.reduce((n, t) => n + (t.courses?.draft ?? 0), 0);
    const published = live.reduce((n, t) => n + (t.courses?.published ?? 0), 0);
    const att = live.reduce((n, t) => n + (t.attempts?.graded ?? 0), 0);
    const pass = live.reduce((n, t) => n + (t.attempts?.passed ?? 0), 0);
    return (
      <Body>
        {loading ? (
          <Dim>Loading…</Dim>
        ) : (
          <>
            <Stats>
              <Stat><StatN>{published}</StatN><StatL>published</StatL></Stat>
              <Stat><StatN>{draft}</StatN><StatL>draft</StatL></Stat>
              <Stat><StatN>{att > 0 ? `${Math.round((pass / att) * 100)}%` : "—"}</StatN><StatL>pass-rate</StatL></Stat>
              <Stat><StatN>{zeroPub.length}</StatN><StatL>0-enroll pub.</StatL></Stat>
            </Stats>
            {zeroPub.length > 0 ? (
              <Card>
                <Dim style={{ marginBottom: "0.3rem", fontWeight: 700, color: colors.gold }}>
                  Published with zero enrollments
                </Dim>
                {zeroPub.map((z, i) => (
                  <Dim key={i}>• {z.tenant}: {z.title}</Dim>
                ))}
              </Card>
            ) : (
              <Dim>Every published course has at least one real enrollment. 🎉</Dim>
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
            ? "⛔ GLOBAL KILLSWITCH ENGAGED — course suite blocked for ALL tenants"
            : "✓ Course suite live (per-tenant settings below)"}
        </Banner>
      )}
      <Row>
        <RowMain>
          <RowLabel>Global killswitch</RowLabel>
          <RowHelp>
            Emergency master off-switch — instantly blocks every course op for every tenant. Rarely
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

      {tenantsCfg.map(([memberId, tc]) => {
        const capValue = capDraft[memberId] ?? String(tc.maxCourses ?? 0);
        const capDirty = capValue !== String(tc.maxCourses ?? 0);
        return (
          <Card key={memberId}>
            <Row>
              <RowMain>
                <RowLabel>{tc.label ?? memberId}</RowLabel>
                <RowHelp>schema: {tc.schema} · {tc.enabled ? "course feature ON" : "course feature OFF"}</RowHelp>
              </RowMain>
              <Switch
                $on={tc.enabled}
                disabled={saving}
                aria-label={`Toggle course for ${tc.label ?? memberId}`}
                onClick={() => save({ tenant: { memberId, enabled: !tc.enabled } })}
              />
            </Row>
            <Row>
              <RowMain>
                <RowLabel style={{ fontSize: "0.78rem" }}>Max courses</RowLabel>
                <RowHelp>0 = unlimited. Caps active (non-archived) courses this tenant can create.</RowHelp>
              </RowMain>
              <CapRow>
                <NumInput
                  type="number"
                  min={0}
                  value={capValue}
                  onChange={(e) => setCapDraft((d) => ({ ...d, [memberId]: e.target.value }))}
                />
                <SaveBtn
                  type="button"
                  disabled={saving || !capDirty}
                  onClick={async () => {
                    const n = Math.max(0, Math.floor(Number(capValue) || 0));
                    const ok = await save({ tenant: { memberId, maxCourses: n === 0 ? null : n } });
                    if (ok) setCapDraft((d) => { const c = { ...d }; delete c[memberId]; return c; });
                  }}
                >
                  {capDirty ? "Save" : "Saved"}
                </SaveBtn>
              </CapRow>
            </Row>
          </Card>
        );
      })}
      {switchErr && <Err>Couldn&apos;t save — {switchErr}. The change did NOT take effect.</Err>}
    </Body>
  );

  const sections: HCMSection[] = [
    {
      id: "usage",
      title: "Usage (cross-tenant)",
      qmbm:
        "Real-learner course activity across every tenant on TGV — courses by status, enrollments, " +
        "completions, certificates, and per-course pass-rates. Operator 'take as student' preview " +
        "runs are excluded so the numbers reflect actual members.",
      body: usageBody,
    },
    {
      id: "health",
      title: "Health",
      qmbm:
        "At-a-glance suite health: the published-vs-draft mix, the overall assessment pass-rate, and " +
        "published courses sitting at zero real enrollments (candidates to promote or unpublish).",
      body: healthBody,
    },
    {
      id: "enablement",
      title: "Enablement & Killswitch",
      qmbm:
        "The rarely-used emergency controls — kept at the bottom on purpose. The global killswitch " +
        "blocks the whole suite for everyone; per-tenant switches block one tenant; Max courses caps " +
        "creation. All take effect immediately (the tenant reads the shared config on the next call), " +
        "every change is audited above. Default posture: everything ON.",
      body: killBody,
    },
  ];

  return (
    <HardeningControlModal
      title="Course Suite"
      subtitle="Cross-tenant oversight for @tgv/module-course — usage, health, and the enablement killswitch."
      qmbm={
        "The master operator console for the Course suite.\n\n" +
        "Top: a live activity feed (operator config changes + per-tenant course events). Then " +
        "cross-tenant usage and health. The enablement killswitch sits at the very bottom — it's the " +
        "break-glass control you'll almost never touch."
      }
      onClose={onClose}
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/admin/course/audit-feed" kinds={AUDIT_KINDS} />}
    />
  );
}
