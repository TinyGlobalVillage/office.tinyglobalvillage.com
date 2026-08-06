"use client";

// DashboardConfigModal — GLOBAL dashboard feature killswitch (the soft-launch board).
// Admin flips each dashboard feature Off / Admin-preview / On for ALL members at once:
//   Off   — hidden for everyone (members AND admins)
//   Admin — only admins see it (test/preview before launch)
//   On    — each member's own dashboard toggle decides (normal behaviour)
// Backed by /api/admin/dashboard-config (platform_feature_flags); every change is
// audited. Enforcement lives in each tenant dashboard's feature resolution, which
// reads the same table (see docs/dashboard-feature-flags-enforcement.md).

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../NeonX";

type FlagState = "off" | "admin" | "on";
type Flag = {
  feature_key: string;
  state: FlagState;
  updated_at: string | null;
  updated_by: string | null;
};

// Friendly labels for the seeded launch features; unknown keys fall back to the key.
const FEATURE_LABELS: Record<string, string> = {
  storefront: "Store Front",
  members: "Members",
  yellowpages: "Yellow Pages",
  analytics: "Analytics",
  performers: "Performers",
  course: "Course",
  studio: "Studio",
  "domain-console": "Domain Console",
  payments: "Payments",
  wallet: "Wallet",
  support: "Staff Support",
};
const labelFor = (k: string) => FEATURE_LABELS[k] ?? k;

const SEG: { key: FlagState; label: string; color: string }[] = [
  { key: "off", label: "Off", color: colors.pink },
  { key: "admin", label: "Admin", color: colors.gold },
  { key: "on", label: "On", color: colors.cyan },
];

// ── Layout policy (Gio 2026-08-05) ──────────────────────────────────────────
// The feature flags above decide WHICH features exist. This decides WHOSE ARRANGEMENT of them
// everyone sees. Two different questions, one modal, because an operator asking "why does that
// tenant's dashboard look like that?" is looking for whichever of the two it turns out to be.
type LayoutMode = "overwritten" | "custom";
type LayoutState = {
  mode: LayoutMode;
  hasLayout: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
  personalLayouts: number;
};

const LAYOUT_SEG: { key: LayoutMode; label: string; color: string }[] = [
  { key: "overwritten", label: "Overwritten", color: colors.cyan },
  { key: "custom", label: "Custom", color: colors.gold },
];

export default function DashboardConfigModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutState | null>(null);
  const [layoutBusy, setLayoutBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/admin/dashboard-config", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) setFlags(Array.isArray(d.flags) ? d.flags : []);
      else setError(d.error ?? `HTTP ${r.status}`);
    } catch {
      setError("Couldn't reach the server.");
    }
  }, []);

  const loadLayout = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/dashboard-layout", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        setLayout({
          mode: d.mode === "custom" ? "custom" : "overwritten",
          hasLayout: Boolean(d.hasLayout),
          updatedBy: d.updatedBy ?? null,
          updatedAt: d.updatedAt ?? null,
          personalLayouts: Number(d.personalLayouts ?? 0),
        });
      }
    } catch {
      /* the flags board still works without it; the section just stays quiet */
    }
  }, []);

  useEffect(() => {
    void load();
    void loadLayout();
  }, [load, loadLayout]);

  const setLayoutMode = async (mode: LayoutMode) => {
    setLayoutBusy(true);
    try {
      const r = await fetch("/api/admin/dashboard-layout", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.ok === false) setError(d.error ?? `Set failed (HTTP ${r.status}).`);
      else await loadLayout();
    } catch {
      setError("Set failed — couldn't reach the server.");
    } finally {
      setLayoutBusy(false);
    }
  };

  const clearPublishedLayout = async () => {
    setLayoutBusy(true);
    try {
      const r = await fetch("/api/admin/dashboard-layout", { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.ok === false) setError(d.error ?? `Reset failed (HTTP ${r.status}).`);
      else await loadLayout();
    } catch {
      setError("Reset failed — couldn't reach the server.");
    } finally {
      setLayoutBusy(false);
    }
  };

  const setState = async (featureKey: string, state: FlagState) => {
    setBusyKey(featureKey);
    const prev = flags;
    // Optimistic flip.
    setFlags(
      (f) => f?.map((x) => (x.feature_key === featureKey ? { ...x, state } : x)) ?? f,
    );
    try {
      const r = await fetch("/api/admin/dashboard-config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ featureKey, state }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.ok === false) {
        setFlags(prev ?? null);
        setError(d.error ?? `Set failed (HTTP ${r.status}).`);
      } else {
        setError(null);
        await load();
      }
    } catch {
      setFlags(prev ?? null);
      setError("Set failed — couldn't reach the server.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" $maxWidth="46rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>Dashboard Config</ModalTitle>
              <Sub>
                Turn dashboard features on or off for every member — the soft-launch board
              </Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          {/* The layout switch leads, above the feature board. It answers the question an operator
              usually arrives with — "why does that dashboard look like that?" — and the answer is
              this one before it's ever the twenty flags below. */}
          {layout && (
            <LayoutBox>
              <LayoutHead>
                <div>
                  <FName>Dashboard layout</FName>
                  <FMeta>
                    {layout.hasLayout
                      ? `published from HQ${layout.updatedBy ? ` by ${layout.updatedBy}` : ""}`
                      : "built from the feature registry"}
                  </FMeta>
                </div>
                <Seg>
                  {LAYOUT_SEG.map((s) => (
                    <SegBtn
                      key={s.key}
                      type="button"
                      $active={layout.mode === s.key}
                      $color={s.color}
                      disabled={layoutBusy}
                      onClick={() => layout.mode !== s.key && void setLayoutMode(s.key)}
                    >
                      {s.label}
                    </SegBtn>
                  ))}
                </Seg>
              </LayoutHead>
              <LayoutNote>
                {layout.mode === "overwritten" ? (
                  <>
                    <strong>Overwritten</strong> — every dashboard in the fleet renders the same
                    layout. Arrange it once on HQ&apos;s own dashboard and save; the next load carries
                    it everywhere. The {layout.personalLayouts} personal{" "}
                    {layout.personalLayouts === 1 ? "layout" : "layouts"} on file{" "}
                    {layout.personalLayouts === 1 ? "is" : "are"} ignored, not deleted.
                  </>
                ) : (
                  <>
                    <strong>Custom</strong> — a member who has arranged their own dashboard gets that
                    arrangement back ({layout.personalLayouts} on file). Everyone else still opens
                    onto the shared layout.
                  </>
                )}
              </LayoutNote>
              {layout.hasLayout && (
                <LayoutReset type="button" disabled={layoutBusy} onClick={() => void clearPublishedLayout()}>
                  Reset to the built-in layout
                </LayoutReset>
              )}
            </LayoutBox>
          )}

          <Legend>
            <LegendItem>
              <Dot style={{ background: colors.pink }} /> <strong>Off</strong> — hidden for
              everyone
            </LegendItem>
            <LegendItem>
              <Dot style={{ background: colors.gold }} /> <strong>Admin</strong> — only admins
              see it (preview before launch)
            </LegendItem>
            <LegendItem>
              <Dot style={{ background: colors.cyan }} /> <strong>On</strong> — each member&apos;s
              own toggle decides
            </LegendItem>
          </Legend>

          {error && <ErrText>{error}</ErrText>}

          {!flags ? (
            <Dim>Loading…</Dim>
          ) : flags.length === 0 ? (
            <Dim>No features configured.</Dim>
          ) : (
            <List>
              {flags.map((f) => (
                <Row key={f.feature_key}>
                  <RowLeft>
                    <FName>{labelFor(f.feature_key)}</FName>
                    <FMeta>
                      {f.feature_key}
                      {f.updated_by ? ` · last set by ${f.updated_by}` : ""}
                    </FMeta>
                  </RowLeft>
                  <Seg>
                    {SEG.map((s) => (
                      <SegBtn
                        key={s.key}
                        type="button"
                        $active={f.state === s.key}
                        $color={s.color}
                        disabled={busyKey === f.feature_key}
                        onClick={() =>
                          f.state !== s.key && void setState(f.feature_key, s.key)
                        }
                      >
                        {s.label}
                      </SegBtn>
                    ))}
                  </Seg>
                </Row>
              ))}
            </List>
          )}

          <Note>
            Changes apply to every member&apos;s dashboard. Each tenant dashboard reads these
            flags when it builds its tab bar; a feature with no row here is treated as{" "}
            <strong>On</strong>. Every change is audited.
          </Note>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

/* ── styles ─────────────────────────────────────────────────────────────── */
const LayoutBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.75rem 0.85rem;
  margin-bottom: 1rem;
  border: 1px solid rgba(${rgb.cyan}, 0.22);
  border-radius: 0.5rem;
  background: rgba(${rgb.cyan}, 0.05);
`;
const LayoutHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
`;
const LayoutNote = styled.div`
  font-size: 0.72rem;
  line-height: 1.5;
  color: var(--t-textFaint);
  strong {
    color: var(--t-text);
  }
`;
const LayoutReset = styled.button`
  align-self: flex-start;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  cursor: pointer;
  background: transparent;
  color: var(--t-textFaint);
  border: 1px solid var(--t-border);
  &:hover:not(:disabled) {
    border-color: ${colors.pink};
    color: ${colors.pink};
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
const Sub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  letter-spacing: 0.04em;
  margin-top: 0.125rem;
`;
const Legend = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.7rem 0.85rem;
  margin-bottom: 1rem;
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
`;
const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.74rem;
  color: var(--t-textFaint);
  strong {
    color: var(--t-text);
  }
`;
const Dot = styled.span`
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 999px;
  display: inline-block;
  flex: 0 0 auto;
`;
const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;
const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(${rgb.gold}, 0.16);
  border-radius: 0.5rem;
  background: rgba(${rgb.gold}, 0.04);
`;
const RowLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
`;
const FName = styled.div`
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--t-text);
`;
const FMeta = styled.div`
  font-size: 0.68rem;
  color: var(--t-textFaint);
  font-family: var(--font-geist-mono), monospace;
`;
const Seg = styled.div`
  display: flex;
  gap: 0.25rem;
  flex: 0 0 auto;
`;
const SegBtn = styled.button<{ $active: boolean; $color: string }>`
  padding: 0.25rem 0.7rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: 999px;
  cursor: pointer;
  background: ${(p) => (p.$active ? p.$color : "transparent")};
  color: ${(p) => (p.$active ? "#0a0a0a" : "var(--t-textFaint)")};
  border: 1px solid ${(p) => (p.$active ? p.$color : "var(--t-border)")};
  transition: all 0.12s;
  &:hover:not(:disabled) {
    border-color: ${(p) => p.$color};
    color: ${(p) => (p.$active ? "#0a0a0a" : p.$color)};
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
const Dim = styled.div`
  color: var(--t-textFaint);
  font-size: 0.78rem;
`;
const Note = styled.div`
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--t-textFaint);
  margin-top: 1rem;
`;
const ErrText = styled.div`
  font-size: 0.75rem;
  color: ${colors.pink};
  margin-bottom: 0.6rem;
`;
