"use client";

// Phase 4.2 — "Sync versions" control (office-sandbox-catalog-mirror).
//
// Computes the CURRENT version snapshot for every catalog block IN THE BROWSER
// (versionSync.currentSnapshots — the catalog only resolves to real objects client-side; a
// server route would get client-reference proxies, verified by the Phase 4.2 probe) and POSTs
// them to /api/sandbox/component-versions, which validates + upserts into component_versions.
//
// Run this BEFORE bumping any component's version for the first time, so each block's prior-
// version prop-shape + default values are captured (the baseN side of Phase 4.4 reconciliation).
// Idempotent — safe to re-run; an unchanged (id, version) row is just refreshed.

import { useState } from "react";
import styled from "styled-components";
import { PanelActionBtn } from "../../styled";
import { currentSnapshots } from "@/lib/domains/editor/component-library/versionSync";

const Status = styled.span`
  font-size: 0.625rem;
  font-family: var(--font-geist-mono), monospace;
  margin-left: 0.375rem;
  color: var(--t-textMuted);
`;

export default function ComponentVersionsSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState("");

  const run = async () => {
    setSyncing(true);
    setStatus("");
    try {
      const snapshots = currentSnapshots();
      const res = await fetch("/api/sandbox/component-versions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshots }),
      });
      const json = (await res.json().catch(() => ({}))) as { upserted?: number; error?: string; synced?: boolean };
      setStatus(
        res.ok && json.synced !== false
          ? `Synced ${json.upserted ?? snapshots.length} versions`
          : `Failed: ${json.error ?? `HTTP ${res.status}`}`,
      );
    } catch (e) {
      setStatus(`Failed: ${e instanceof Error ? e.message : "sync error"}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setStatus(""), 5000);
    }
  };

  return (
    <>
      <PanelActionBtn
        $variant="ghost"
        onClick={run}
        disabled={syncing}
        title="Snapshot every catalog block's current version (prop-shape + defaults) into component_versions — run before bumping a version"
      >
        📌 {syncing ? "Syncing…" : "Sync versions"}
      </PanelActionBtn>
      {status && <Status>{status}</Status>}
    </>
  );
}
