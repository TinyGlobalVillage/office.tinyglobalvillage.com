// Domain DNS Health — Hardening Control Modal for the NS-drift watchdog (task E).
//
// Every TGV-managed domain (nameserver_mode="tgv") should have its registrar delegation
// pointed at its own Cloudflare zone. Register/transfer now wire that automatically; this
// tile is the visible, actionable surface for when reality drifts — a manual NS change at
// the registrar, a deleted zone, or a failed auto-wire. That drift is what silently lapsed
// resonantweaver.com's zone past Cloudflare's ~4-week activation window.
//
// Per Gio's decision the watchdog FLAGS ONLY; repair is this modal's explicit one-click
// "Re-wire to CF" (a live registrar + Cloudflare write), never automatic.
"use client";

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import HardeningControlModal from "../HardeningControlModal";

type Report = {
  fqdn: string;
  domainId: string;
  drift: boolean;
  reason: "ok" | "zone_missing" | "cf_no_nameservers" | "delegation_mismatch" | "check_failed";
  cfNameservers: string[];
  registrarNameservers: string[];
};

const REASON_COPY: Record<Report["reason"], string> = {
  ok: "Delegated to its Cloudflare zone.",
  zone_missing: "No Cloudflare zone exists for this domain.",
  cf_no_nameservers: "The Cloudflare zone has no assigned nameservers yet.",
  delegation_mismatch: "The registrar's nameservers don't match the Cloudflare zone.",
  check_failed: "Couldn't read the registrar or Cloudflare to compare.",
};

export default function DomainDnsControlModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/hardening/domain-dns", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setRows(Array.isArray(j.domains) ? j.domains : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to check DNS health.");
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rewire = async (fqdn: string) => {
    setBusy(fqdn);
    setNote(null);
    try {
      const r = await fetch("/api/hardening/domain-dns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fqdn }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setNote(`${fqdn} re-wired to ${(j.nameservers ?? []).join(", ") || "its Cloudflare zone"}.`);
      await load();
    } catch (e) {
      setNote(`Couldn't re-wire ${fqdn}: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setBusy(null);
    }
  };

  const drifted = (rows ?? []).filter((r) => r.drift);

  return (
    <HardeningControlModal
      title="Domain DNS Health"
      subtitle="Registrar delegation vs. Cloudflare zone for every TGV-managed domain"
      qmbm="TGV registers domains at OpenSRS and serves their DNS from one Cloudflare account. A domain only actually uses its Cloudflare zone once the registrar's nameservers point at that zone. Register and transfer now do this automatically; this tile catches the cases that drift afterwards — and lets you repair one in a click."
      onClose={onClose}
      sections={[
        {
          id: "status",
          title: loading
            ? "Checking…"
            : drifted.length === 0
              ? `All good — ${rows?.length ?? 0} domain(s) correctly delegated`
              : `${drifted.length} domain(s) drifted`,
          qmbm: "Read-only comparison. Nothing is changed until you press Re-wire to CF, which is a live registrar + Cloudflare write.",
          body: (
            <>
              {error && <Msg $err>Couldn’t check: {error}</Msg>}
              {note && <Msg>{note}</Msg>}
              {!loading && rows && rows.length === 0 && (
                <Msg>No TGV-managed domains to check (domains on custom nameservers are skipped).</Msg>
              )}
              {rows?.map((d) => (
                <Row key={d.fqdn} $drift={d.drift}>
                  <RowTop>
                    <Fqdn>{d.fqdn}</Fqdn>
                    <Pill $drift={d.drift}>{d.drift ? "DRIFT" : "OK"}</Pill>
                  </RowTop>
                  <Reason>{REASON_COPY[d.reason]}</Reason>
                  <Ns>
                    <NsLabel>Cloudflare</NsLabel>
                    <NsVal>{d.cfNameservers.join(", ") || "—"}</NsVal>
                  </Ns>
                  <Ns>
                    <NsLabel>Registrar</NsLabel>
                    <NsVal>{d.registrarNameservers.join(", ") || "—"}</NsVal>
                  </Ns>
                  {d.drift && (
                    <Fix type="button" disabled={busy === d.fqdn} onClick={() => void rewire(d.fqdn)}>
                      {busy === d.fqdn ? "Re-wiring…" : "Re-wire to CF"}
                    </Fix>
                  )}
                </Row>
              ))}
              <Refresh type="button" onClick={() => void load()} disabled={loading}>
                {loading ? "Checking…" : "Re-check now"}
              </Refresh>
            </>
          ),
        },
      ]}
    />
  );
}

const Msg = styled.p<{ $err?: boolean }>`
  margin: 0 0 10px;
  font-size: 12.5px;
  color: ${({ $err }) => ($err ? "#ff9a9a" : "rgba(255,255,255,0.7)")};
`;

const Row = styled.div<{ $drift: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 10px;
  border: 1px solid ${({ $drift }) => ($drift ? "rgba(255,154,154,0.45)" : "rgba(255,255,255,0.12)")};
  background: ${({ $drift }) => ($drift ? "rgba(255,80,80,0.07)" : "rgba(255,255,255,0.03)")};
`;

const RowTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const Fqdn = styled.span`
  font-weight: 700;
  font-size: 13px;
  color: #e6ffff;
`;

const Pill = styled.span<{ $drift: boolean }>`
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 2px 8px;
  border-radius: 999px;
  color: ${({ $drift }) => ($drift ? "#ffb4b4" : "#9ff0c4")};
  background: ${({ $drift }) => ($drift ? "rgba(255,80,80,0.16)" : "rgba(80,255,160,0.12)")};
`;

const Reason = styled.span`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.66);
`;

const Ns = styled.div`
  display: flex;
  gap: 8px;
  font-size: 11.5px;
`;

const NsLabel = styled.span`
  min-width: 74px;
  color: rgba(255, 255, 255, 0.42);
`;

const NsVal = styled.span`
  color: rgba(255, 255, 255, 0.78);
  word-break: break-all;
`;

const Fix = styled.button`
  align-self: flex-start;
  margin-top: 6px;
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 206, 109, 0.6);
  background: rgba(255, 206, 109, 0.14);
  color: #ffce6d;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

const Refresh = styled.button`
  margin-top: 4px;
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font-size: 11px;
  cursor: pointer;
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;
