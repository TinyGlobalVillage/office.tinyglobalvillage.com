"use client";

// FeatureOverridesModal — operator view of ONE villager site's dashboard features: what their TGV
// plan includes (plan ∪ active add-ons), plus a per-feature allow / deny override (HQ migration
// 0172, villager_feature_overrides). Opened from a site row in MemberLookupModal.
//
// Each row is the shared FeatureSwitchRow (@tgv/module-dashboard) — the same row HQ's Dashboard
// Editor overrides panel and Settings → Dashboard Features wear. A switch shows the answer; flipping
// it against the plan's base writes an override, flipping it back to the plan clears it.
//
// Reads + writes /api/admin/villagers/villager-features, which proxies to HQ's
// /api/user/admin/villager-features (internal-secret seam) so the plan resolver lives only on HQ.

import { useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import FeatureSwitchRow from "@tgv/module-dashboard/components/FeatureSwitchRow";
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

type Feature = { key: string; label: string; group: string };
type Override = { key: string; mode: "allow" | "deny"; note: string | null };
type FeatureSet = {
  basis: "plan" | "grandfathered";
  reason: string;
  planName: string | null;
  addonKeys: string[];
  baseKeys: string[];
  overrides: Override[];
  included: string[];
};

const API = "/api/admin/villagers/villager-features";

export default function FeatureOverridesModal({
  siteId,
  siteLabel,
  onClose,
}: {
  siteId: string;
  siteLabel: string;
  onClose: () => void;
}) {
  useEscapeToClose({ open: true, onClose });

  const [catalog, setCatalog] = useState<Feature[]>([]);
  const [set, setSet] = useState<FeatureSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setErr(null);
    void (async () => {
      try {
        const r = await fetch(`${API}?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok) throw new Error(d.error || `Couldn't load features (${r.status}).`);
        setCatalog(Array.isArray(d.catalog) ? d.catalog : []);
        setSet(d.features ?? null);
      } catch (e) {
        if (live) setErr((e as Error).message);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [siteId]);

  const flip = async (key: string, next: boolean) => {
    if (!set) return;
    const base = set.baseKeys.includes(key);
    setBusy(key);
    setErr(null);
    try {
      const r = await fetch(API, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId, key, mode: next === base ? null : next ? "allow" : "deny" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't save the override.");
      setSet(d.features);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const overrideOf = new Map((set?.overrides ?? []).map((o) => [o.key, o]));
  const groups = Array.from(new Set(catalog.map((f) => f.group)));
  const summary = !set
    ? null
    : set.basis === "grandfathered"
      ? `Every feature — ${set.reason}.`
      : `Plan: ${set.planName ?? "?"}${set.addonKeys.length ? ` + ${set.addonKeys.join(", ")}` : ""}.`;

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer
        $accent="gold"
        $maxWidth="34rem"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-overrides-title"
      >
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle id="feature-overrides-title" $color={colors.gold}>
              Feature overrides
            </ModalTitle>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            <SiteLine>{siteLabel}</SiteLine>
            {summary && (
              <Note>
                {summary} {set?.included.length ?? 0} of {catalog.length} features on. A switch set
                against the plan becomes an override for this villager only; setting it back clears
                the override.
              </Note>
            )}
            {err && <ErrText role="alert">{err}</ErrText>}
            {loading && <Note>Loading…</Note>}
            {set &&
              groups.map((g) => (
                <Group key={g}>
                  <GroupHead>{g}</GroupHead>
                  {catalog
                    .filter((f) => f.group === g)
                    .map((f) => {
                      const on = set.included.includes(f.key);
                      const o = overrideOf.get(f.key);
                      return (
                        <FeatureSwitchRow
                          key={f.key}
                          dataKey={f.key}
                          label={f.label}
                          description={
                            o
                              ? o.mode === "allow"
                                ? "Override: allowed"
                                : "Override: denied"
                              : set.baseKeys.includes(f.key)
                                ? "In their plan"
                                : "Not in their plan"
                          }
                          on={on}
                          locked={busy !== null}
                          tooltip={o ? "Overridden" : on ? "In their plan" : "Not in their plan"}
                          onChange={(next) => void flip(f.key, next)}
                        />
                      );
                    })}
                </Group>
              ))}
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

const Stack = styled.div`
  display: grid;
  gap: 10px;
`;
const SiteLine = styled.div`
  font-size: 0.85rem;
  font-weight: 700;
  color: ${colors.gold};
`;
const Note = styled.p`
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--t-textFaint);
`;
const Group = styled.div`
  display: grid;
  gap: 6px;
`;
const GroupHead = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--t-textFaint);
  margin-top: 4px;
`;
const ErrText = styled.div`
  font-size: 0.78rem;
  color: rgba(${rgb.red}, 0.9);
`;
