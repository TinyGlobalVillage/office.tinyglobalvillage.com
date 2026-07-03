"use client";

// CourseControlModal — the operator MASTER console for the @tgv/module-course suite, opened from a
// Villagers tile. Built on the shared HardeningControlModal shell (sections + activity timeline +
// QMBM bubbles) and the shared SuiteControlKit (styled-components + useSuiteControl hook +
// KillswitchSection), like StudioControlModal. This is the convention from checklist
// `feature-suite-villagers-tiles`: every feature suite gets one Villagers tile → one master modal
// with ALL of its operator controls; the killswitch lives at the BOTTOM (rarely touched).
//
// Reads: cross-tenant usage (/api/admin/course/usage) + activity (/api/admin/course/audit-feed),
// both straight from tgv_db. Writes: the enablement/killswitch (/api/admin/course/config) to the
// Office-owned shared config file the tenant dispatchers read.

import { useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
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
  Row,
  RowMain,
  RowLabel,
  RowHelp,
  KillswitchSection,
  useSuiteControl,
} from "./_suite/SuiteControlKit";

/* ── Contract (mirror of lib/course-config + api/usage) ──────────────────────── */

type TenantConfig = SuiteTenantBase & { maxCourses?: number | null };
type CourseConfig = SuiteConfigBase<TenantConfig>;

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
  siteId: string;
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

/* ── Course-specific styled (the shared ones come from SuiteControlKit) ───────── */

const StatusTag = styled.span<{ $s: string }>`
  font-size: 0.6rem;
  font-weight: 700;
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
  color: ${(p) => (p.$s === "published" ? colors.green : p.$s === "draft" ? colors.gold : "var(--t-textFaint)")};
  background: ${(p) =>
    p.$s === "published" ? `rgba(${rgb.green}, 0.1)` : p.$s === "draft" ? `rgba(${rgb.gold}, 0.1)` : "transparent"};
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

/* ── Component ────────────────────────────────────────────────────────────────── */

export type CourseControlModalProps = { onClose: () => void };

export default function CourseControlModal({ onClose }: CourseControlModalProps) {
  useEscapeToClose({ open: true, onClose });

  const { config, usage, loading, loadErr, saving, switchErr, save } = useSuiteControl<
    CourseConfig,
    UsageTenant,
    TenantConfig
  >("course");

  // local maxCourses edit buffer, keyed by siteId
  const [capDraft, setCapDraft] = useState<Record<string, string>>({});

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
              <Dim>Every published course has at least one real enrollment.</Dim>
            )}
          </>
        )}
      </Body>
    );
  })();

  /* ── Enablement & killswitch section (BOTTOM) — shared shell + course's max-courses cap ── */
  const killBody = (
    <KillswitchSection<TenantConfig>
      config={config}
      saving={saving}
      switchErr={switchErr}
      suiteLabel="Course"
      featureNoun="course"
      onToggleGlobal={() => save({ globalKillswitch: !config?.globalKillswitch })}
      onToggleTenant={(siteId, tc) => save({ tenant: { siteId, enabled: !tc.enabled } })}
      renderTenantExtra={(siteId, tc) => {
        const capValue = capDraft[siteId] ?? String(tc.maxCourses ?? 0);
        const capDirty = capValue !== String(tc.maxCourses ?? 0);
        return (
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
                onChange={(e) => setCapDraft((d) => ({ ...d, [siteId]: e.target.value }))}
              />
              <SaveBtn
                type="button"
                disabled={saving || !capDirty}
                onClick={async () => {
                  const n = Math.max(0, Math.floor(Number(capValue) || 0));
                  const ok = await save({ tenant: { siteId, maxCourses: n === 0 ? null : n } });
                  if (ok) setCapDraft((d) => { const c = { ...d }; delete c[siteId]; return c; });
                }}
              >
                {capDirty ? "Save" : "Saved"}
              </SaveBtn>
            </CapRow>
          </Row>
        );
      }}
    />
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
