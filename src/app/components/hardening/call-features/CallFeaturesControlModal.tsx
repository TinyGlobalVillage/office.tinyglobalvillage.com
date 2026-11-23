"use client";
// CallFeaturesControlModal — one call package, switched per place (Gio 2026-11-23: "only in meetings
// can you record, but on calls from TIM you cannot … controls will live on Office where we can
// select on and off specific features for TIM versus Meetings"). One section per surface, one
// switch per feature; saved to tgv_db call_features via /api/admin/call-features and read live by
// every call (a call already running picks the change up on its next join).
import { useCallback, useEffect, useState } from "react";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import { Body, Dim, Err, Row, RowLabel, RowMain, Switch } from "../../villagers/_suite/SuiteControlKit";
import {
  CALL_FEATURE_KEYS,
  CALL_FEATURE_LABEL,
  CALL_SURFACES,
  CALL_SURFACE_LABEL,
  type CallFeatureKey,
  type CallFeatures,
  type CallSurface,
} from "@tgv/module-video-calls/features/callFeatureDefs";

const SURFACE_QMBM: Record<CallSurface, string> = {
  meet: "Instant Meetings — the link-based calls a host runs with a waiting room. Everything is on by default.",
  tim: "Member-to-member calls started from a TIM conversation. Ephemeral: no link to share, nobody to admit, and the TIM thread is the chat — so recording, share link, waiting room, breakouts, timer, call chat and people list start off.",
  session: "Booked sessions — clients join through their sessions link. Recording stays host-only on the server even when it is on here.",
};

export default function CallFeaturesControlModal({ onClose }: { onClose: () => void }) {
  const [all, setAll] = useState<Record<CallSurface, CallFeatures> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/call-features", { cache: "no-store", credentials: "same-origin" });
      if (!r.ok) throw new Error(`Could not load (${r.status})`);
      setAll(((await r.json()) as { surfaces: Record<CallSurface, CallFeatures> }).surfaces);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load");
    }
  }, []);
  useEffect(() => void load(), [load]);

  const flip = async (surface: CallSurface, key: CallFeatureKey) => {
    if (!all) return;
    const next = !all[surface][key];
    setBusy(`${surface}:${key}`);
    setErr(null);
    try {
      const r = await fetch("/api/admin/call-features", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ surface, features: { [key]: next } }),
      });
      if (!r.ok) throw new Error(`Could not save (${r.status})`);
      const j = (await r.json()) as { features: CallFeatures };
      setAll({ ...all, [surface]: j.features });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  };

  const sections: HCMSection[] = CALL_SURFACES.map((s) => ({
    id: s,
    title: CALL_SURFACE_LABEL[s],
    qmbm: SURFACE_QMBM[s],
    body: (
      <Body>
        {!all && !err && <Dim>Loading…</Dim>}
        {all &&
          CALL_FEATURE_KEYS.map((k) => (
            <Row key={k}>
              <RowMain>
                <RowLabel>{CALL_FEATURE_LABEL[k]}</RowLabel>
              </RowMain>
              <Switch
                $on={all[s][k]}
                disabled={busy !== null}
                aria-label={`${CALL_FEATURE_LABEL[k]} in ${CALL_SURFACE_LABEL[s]}`}
                aria-pressed={all[s][k]}
                onClick={() => void flip(s, k)}
              />
            </Row>
          ))}
        {err && <Err>{err}</Err>}
      </Body>
    ),
  }));

  return (
    <HardeningControlModal
      title="Call Features"
      subtitle="One call package — pick what Meetings, TIM calls and Sessions each offer."
      qmbm="Meetings, TIM calls and Sessions run the same call surface. Each switch shows or hides a control in that place. Servers still guard their own actions."
      onClose={onClose}
      sections={sections}
    />
  );
}
