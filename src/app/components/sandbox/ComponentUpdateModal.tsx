"use client";

// ComponentUpdateModal — Phase 4.6 blast-radius modal (office-sandbox-catalog-mirror).
//
// "Update available → review the blast radius before you apply." For one tenant's overlay of one
// catalog block, previews the 3-way reconciliation (POST /api/sandbox/component-update-apply
// {mode:'preview'}) and shows: the OUTCOME (clean reapply / surgical merge / structural conflict),
// which fields are PRESERVED, which are FLAGGED (dropped/retyped/new), and the BLAST RADIUS (pages
// that render this block). Apply persists the reconciled overlay (mode:'apply'); Ignore dismisses.

import React from "react";
import styled from "styled-components";

const ENDPOINT = "/api/sandbox/component-update-apply";

type Preview = {
  outcome: "CLEAN_REAPPLY" | "SURGICAL_MERGE" | "STRUCTURAL_CONFLICT" | "NO_OVERLAY";
  classification?: "cosmetic" | "structural";
  message?: string;
  preservedFields?: string[];
  flaggedFields?: { path: string; kind: "dropped" | "retyped" | "added"; detail: string }[];
  blastRadius?: { slug: string; lang: string; site: string; mode: string; title: string; sectionHits: number }[];
  baseSnapshotMissing?: boolean;
  fromVersion?: number | null;
  toVersion?: number;
};

export default function ComponentUpdateModal({
  catalogId,
  tenantId,
  tenantLabel,
  fromVersion,
  toVersion,
  lang = "en",
  onClose,
  onApplied,
}: {
  catalogId: string;
  tenantId: string;
  tenantLabel: string;
  fromVersion: number;
  toVersion: number;
  lang?: string;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [busy, setBusy] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [applied, setApplied] = React.useState(false);

  const call = React.useCallback(
    async (mode: "preview" | "apply") => {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, catalogId, tenantId, lang, fromVersion, toVersion }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      return json as Preview & { applied?: boolean };
    },
    [catalogId, tenantId, lang, fromVersion, toVersion],
  );

  React.useEffect(() => {
    let alive = true;
    setBusy(true);
    setErr(null);
    call("preview")
      .then((p) => alive && setPreview(p))
      .catch((e) => alive && setErr((e as Error).message))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [call]);

  async function apply() {
    setBusy(true);
    setErr(null);
    try {
      await call("apply");
      setApplied(true);
      onApplied?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Backdrop onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Head>
          <div>
            <Kicker>Component update · v{fromVersion} → v{toVersion}</Kicker>
            <H>
              <code>{catalogId}</code> · {tenantLabel}
            </H>
          </div>
          <CloseBtn onClick={onClose}>✕</CloseBtn>
        </Head>

        {busy && !preview ? (
          <Note>Computing blast radius…</Note>
        ) : err ? (
          <FailNote>⚠ {err}</FailNote>
        ) : applied ? (
          <OkNote>✓ Applied — the tenant overlay is now at v{toVersion}.</OkNote>
        ) : preview ? (
          <>
            <OutcomeRow>
              <OutcomePill $o={preview.outcome}>{outcomeLabel(preview.outcome)}</OutcomePill>
              {preview.classification && <Dim>{preview.classification} change</Dim>}
              {preview.baseSnapshotMissing && <Dim>· no base snapshot (all edits preserved)</Dim>}
            </OutcomeRow>

            {preview.outcome === "NO_OVERLAY" ? (
              <Note>{preview.message ?? "Tenant has no overlay — the new default applies automatically."}</Note>
            ) : (
              <>
                {!!preview.preservedFields?.length && (
                  <Section>
                    <SecLabel>Preserved (your edits carry over)</SecLabel>
                    <Chips>
                      {preview.preservedFields.map((f) => (
                        <Chip key={f} $tone="ok">{f}</Chip>
                      ))}
                    </Chips>
                  </Section>
                )}
                {!!preview.flaggedFields?.length && (
                  <Section>
                    <SecLabel>Needs attention</SecLabel>
                    {preview.flaggedFields.map((f) => (
                      <FlagRow key={f.path}>
                        <Chip $tone={f.kind === "added" ? "info" : "warn"}>{f.kind}</Chip>
                        <code>{f.path}</code>
                        <FlagDetail>{f.detail}</FlagDetail>
                      </FlagRow>
                    ))}
                  </Section>
                )}
                <Section>
                  <SecLabel>Blast radius · {preview.blastRadius?.length ?? 0} page(s) render this block</SecLabel>
                  {preview.blastRadius?.length ? (
                    <RadiusList>
                      {preview.blastRadius.map((p, i) => (
                        <RadiusRow key={`${p.site}/${p.slug}/${p.lang}/${p.mode}/${i}`}>
                          <code>{p.site}</code> /{p.slug} · {p.lang} · {p.mode}
                          {p.title ? ` · ${p.title}` : ""} <Dim>×{p.sectionHits}</Dim>
                        </RadiusRow>
                      ))}
                    </RadiusList>
                  ) : (
                    <Dim>No published pages currently render this block.</Dim>
                  )}
                </Section>
              </>
            )}

            <Actions>
              <GhostBtn onClick={onClose}>Ignore</GhostBtn>
              {preview.outcome !== "NO_OVERLAY" && (
                <ApplyBtn onClick={apply} disabled={busy}>
                  {busy ? "Applying…" : `Apply → v${toVersion}`}
                </ApplyBtn>
              )}
            </Actions>
          </>
        ) : null}
      </Panel>
    </Backdrop>
  );
}

function outcomeLabel(o: Preview["outcome"]): string {
  switch (o) {
    case "CLEAN_REAPPLY": return "Clean reapply";
    case "SURGICAL_MERGE": return "Surgical merge";
    case "STRUCTURAL_CONFLICT": return "Structural — review needed";
    case "NO_OVERLAY": return "No overlay";
  }
}

// ── styles ──────────────────────────────────────────────────────────────────
const PINK = "#ff4ecb";
const Backdrop = styled.div`
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
`;
const Panel = styled.div`
  width: min(680px, 96vw); max-height: 88vh; overflow: auto;
  background: #111118; border: 1px solid rgba(255,255,255,0.14); border-radius: 14px;
  padding: 18px 20px; color: rgba(255,255,255,0.88);
`;
const Head = styled.div`display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px;`;
const Kicker = styled.div`font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.45);`;
const H = styled.div`font-size: 15px; margin-top: 2px; code { color: ${PINK}; }`;
const CloseBtn = styled.button`background: none; border: none; color: rgba(255,255,255,0.5); font-size: 16px; cursor: pointer;`;
const OutcomeRow = styled.div`display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;`;
const OutcomePill = styled.span<{ $o: Preview["outcome"] }>`
  font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px;
  color: ${(p) => (p.$o === "STRUCTURAL_CONFLICT" ? "#ffb86b" : p.$o === "NO_OVERLAY" ? "rgba(255,255,255,0.6)" : "#6ee7a8")};
  border: 1px solid currentColor;
`;
const Dim = styled.span`font-size: 12px; color: rgba(255,255,255,0.45);`;
const Section = styled.div`margin: 12px 0; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.07);`;
const SecLabel = styled.div`font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.4); margin-bottom: 8px;`;
const Chips = styled.div`display: flex; flex-wrap: wrap; gap: 6px;`;
const Chip = styled.span<{ $tone: "ok" | "warn" | "info" }>`
  font-size: 11px; padding: 2px 8px; border-radius: 6px;
  background: ${(p) => (p.$tone === "ok" ? "rgba(110,231,168,0.12)" : p.$tone === "warn" ? "rgba(255,184,107,0.14)" : "rgba(110,180,255,0.14)")};
  color: ${(p) => (p.$tone === "ok" ? "#6ee7a8" : p.$tone === "warn" ? "#ffb86b" : "#79b8ff")};
`;
const FlagRow = styled.div`display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 12px; code { color: ${PINK}; }`;
const FlagDetail = styled.span`color: rgba(255,255,255,0.55);`;
const RadiusList = styled.div`display: flex; flex-direction: column; gap: 4px; max-height: 180px; overflow: auto;`;
const RadiusRow = styled.div`font-size: 12px; color: rgba(255,255,255,0.7); code { color: ${PINK}; }`;
const Actions = styled.div`display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;`;
const btn = `font-size: 13px; padding: 8px 16px; border-radius: 8px; cursor: pointer; border: 1px solid rgba(255,255,255,0.18);`;
const GhostBtn = styled.button`${btn} background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.8);`;
const ApplyBtn = styled.button`${btn} background: ${PINK}; border-color: ${PINK}; color: #111; font-weight: 700; &:disabled { opacity: 0.5; }`;
const Note = styled.div`font-size: 13px; color: rgba(255,255,255,0.6); padding: 8px 0;`;
const OkNote = styled.div`font-size: 13px; color: #6ee7a8; padding: 8px 0;`;
const FailNote = styled.div`font-size: 13px; color: #ff9a9a; padding: 8px 0;`;
