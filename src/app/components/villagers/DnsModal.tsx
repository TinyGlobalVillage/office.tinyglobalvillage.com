"use client";

// DnsModal — operator DNS console (Villagers → "DNS"). An operator picks a Cloudflare
// zone via an SBDM (Search Bar Dropdown Menu, grouped by owning DC tenant; untracked
// zones group under "Platform / Unassigned"), then does full per-record CRUD on that
// zone (A/AAAA/CNAME/TXT/MX/NS/SRV/CAA). Zone-centric — lists EVERY zone in the account,
// incl. TGV.com + Office + pre-DC sites.
//
// Office holds NO Cloudflare creds: every call proxies the tgv-domain-service engine via
// /api/admin/villagers/dns/{zones,records} (requireAdmin on each route; mutations audited
// server-side). This is the operator surface, so CF/zone vocabulary is fine here (the
// provider-hidden rule is for the TENANT DC only). Pattern analog = MemberWalletModal
// (search → detail → action). Reads come from the engine; writes mutate PRODUCTION DNS.

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb, type GlowColor } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../NeonX";

type Zone = {
  id: string;
  name: string;
  status: string;
  nameServers: string[];
  ownedByDc: boolean;
  tenantId: string | null;
  nameserverMode: string | null;
};
type Rec = {
  id: string;
  zone_id: string;
  type: DnsType;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  priority?: number;
};
type DnsType = "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "NS" | "SRV" | "CAA";
type Mode = { kind: "idle" } | { kind: "add" } | { kind: "edit"; id: string };
type Draft = {
  type: DnsType;
  name: string;
  content: string;
  ttl: string;
  proxied: boolean;
  priority: string;
};

const DNS_TYPES: DnsType[] = ["A", "AAAA", "CNAME", "TXT", "MX", "NS", "SRV", "CAA"];
const PROXIABLE: DnsType[] = ["A", "AAAA", "CNAME"];
const PRIORITIZED: DnsType[] = ["MX", "SRV"];
const PLATFORM_GROUP = "Platform / Unassigned";

const emptyDraft = (): Draft => ({
  type: "A",
  name: "",
  content: "",
  ttl: "300",
  proxied: false,
  priority: "",
});

const tenantLabel = (z: Zone): string =>
  z.ownedByDc && z.tenantId ? `Tenant ${z.tenantId.slice(0, 12)}` : PLATFORM_GROUP;

const zoneGlow = (z: Zone): GlowColor =>
  z.status !== "active" ? "red" : z.ownedByDc ? "green" : "gold";

export default function DnsModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [zones, setZones] = useState<Zone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [zonesErr, setZonesErr] = useState<string | null>(null);

  const [sbdmOpen, setSbdmOpen] = useState(false);
  const [zoneQuery, setZoneQuery] = useState("");

  const [zone, setZone] = useState<Zone | null>(null);
  const [records, setRecords] = useState<Rec[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recErr, setRecErr] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  // Monotonic guard so a slow records fetch from a previously-selected zone can't
  // overwrite the records of the zone now on screen (rapid zone switching).
  const loadSeq = useRef(0);

  // ── Load every zone on mount ──────────────────────────────────────────────
  const loadZones = useCallback(async () => {
    setZonesLoading(true);
    setZonesErr(null);
    try {
      const res = await fetch("/api/admin/villagers/dns/zones", { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d?.ok === false) {
        setZonesErr(typeof d?.error === "string" ? d.error : `HTTP ${res.status}`);
        setZones([]);
      } else {
        setZones(Array.isArray(d.zones) ? (d.zones as Zone[]) : []);
      }
    } catch {
      setZonesErr("Couldn't reach the DNS engine.");
      setZones([]);
    } finally {
      setZonesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadZones();
  }, [loadZones]);

  // ── Records for the selected zone ─────────────────────────────────────────
  const loadRecords = useCallback(async (zoneId: string) => {
    const seq = ++loadSeq.current;
    setRecLoading(true);
    setRecErr(null);
    setRecords([]);
    try {
      const res = await fetch(
        `/api/admin/villagers/dns/records?zoneId=${encodeURIComponent(zoneId)}`,
        { cache: "no-store" },
      );
      const d = await res.json().catch(() => ({}));
      if (seq !== loadSeq.current) return; // a newer zone load superseded this one
      if (!res.ok || d?.ok === false) {
        setRecErr(typeof d?.error === "string" ? d.error : `HTTP ${res.status}`);
      } else {
        setRecords(Array.isArray(d.records) ? (d.records as Rec[]) : []);
      }
    } catch {
      if (seq === loadSeq.current) setRecErr("Couldn't load records.");
    } finally {
      if (seq === loadSeq.current) setRecLoading(false);
    }
  }, []);

  const selectZone = (z: Zone) => {
    if (busy) return; // never switch zones while a mutation is in flight (stale-write guard)
    setZone(z);
    setSbdmOpen(false);
    setZoneQuery("");
    setMode({ kind: "idle" });
    setConfirmDelete(null);
    setMsg(null);
    void loadRecords(z.id);
  };

  // ── Grouped + filtered zones for the SBDM list ────────────────────────────
  const groups = useMemo(() => {
    const q = zoneQuery.trim().toLowerCase();
    const match = (z: Zone) =>
      !q ||
      z.name.toLowerCase().includes(q) ||
      tenantLabel(z).toLowerCase().includes(q) ||
      (z.tenantId ?? "").toLowerCase().includes(q);
    const byGroup = new Map<string, Zone[]>();
    for (const z of zones) {
      if (!match(z)) continue;
      const g = tenantLabel(z);
      (byGroup.get(g) ?? byGroup.set(g, []).get(g)!).push(z);
    }
    // Tracked tenants first (alpha), then Platform / Unassigned last.
    return [...byGroup.entries()]
      .sort(([a], [b]) => {
        if (a === PLATFORM_GROUP) return 1;
        if (b === PLATFORM_GROUP) return -1;
        return a.localeCompare(b);
      })
      .map(([label, zs]) => ({ label, zones: zs.sort((x, y) => x.name.localeCompare(y.name)) }));
  }, [zones, zoneQuery]);

  // ── Draft helpers ─────────────────────────────────────────────────────────
  const startAdd = () => {
    setMode({ kind: "add" });
    setDraft(emptyDraft());
    setMsg(null);
  };
  const startEdit = (r: Rec) => {
    setMode({ kind: "edit", id: r.id });
    setDraft({
      type: r.type,
      name: r.name,
      content: r.content,
      ttl: String(r.ttl ?? 300),
      proxied: !!r.proxied,
      priority: r.priority != null ? String(r.priority) : "",
    });
    setMsg(null);
  };
  const cancelDraft = () => {
    setMode({ kind: "idle" });
    setMsg(null);
  };

  const draftValid =
    draft.name.trim().length > 0 &&
    draft.content.trim().length > 0 &&
    (!PRIORITIZED.includes(draft.type) || draft.priority.trim().length > 0);

  const buildBody = (): Record<string, unknown> => {
    const ttl = Math.max(60, Math.min(86400, Math.floor(Number(draft.ttl) || 300)));
    const body: Record<string, unknown> = {
      type: draft.type,
      name: draft.name.trim(),
      content: draft.content.trim(),
      ttl,
      proxied: PROXIABLE.includes(draft.type) ? draft.proxied : false,
    };
    if (PRIORITIZED.includes(draft.type)) body.priority = Math.floor(Number(draft.priority) || 0);
    return body;
  };

  const saveDraft = async () => {
    if (!zone || !draftValid || busy) return;
    const zoneId = zone.id; // pin the target zone before any await (selectZone is busy-guarded too)
    setBusy(true);
    setMsg(null);
    const editing = mode.kind === "edit" ? mode.id : null;
    try {
      const qs = new URLSearchParams({ zoneId });
      if (editing) qs.set("recordId", editing);
      const res = await fetch(`/api/admin/villagers/dns/records?${qs.toString()}`, {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d?.ok === false) {
        setMsg({ kind: "err", text: typeof d?.error === "string" ? d.error : `HTTP ${res.status}` });
      } else {
        setMsg({ kind: "ok", text: editing ? "Record updated." : "Record created." });
        setMode({ kind: "idle" });
        await loadRecords(zoneId);
      }
    } catch {
      setMsg({ kind: "err", text: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  };

  const removeRecord = async (r: Rec) => {
    if (!zone || busy) return;
    const zoneId = zone.id; // pin before await
    setBusy(true);
    setMsg(null);
    try {
      const qs = new URLSearchParams({ zoneId, recordId: r.id });
      const res = await fetch(`/api/admin/villagers/dns/records?${qs.toString()}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d?.ok === false) {
        setMsg({ kind: "err", text: typeof d?.error === "string" ? d.error : `HTTP ${res.status}` });
      } else {
        setMsg({ kind: "ok", text: `Deleted ${r.type} ${r.name}.` });
        setConfirmDelete(null);
        await loadRecords(zoneId);
      }
    } catch {
      setMsg({ kind: "err", text: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  };

  const customNs = zone?.nameserverMode === "custom";

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" $maxWidth="60rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>DNS</ModalTitle>
              <Sub>Pick a zone · manage its records · changes hit production DNS (audited)</Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            {/* ── SBDM zone picker ─────────────────────────────────────── */}
            <SBDMWrap>
              <Label>Zone</Label>
              <SBDMBar
                onClick={() => { if (!busy) setSbdmOpen((o) => !o); }}
                style={busy ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
              >
                <SBDMIcon>🌐</SBDMIcon>
                <SBDMValue $placeholder={!zone}>
                  {zone ? zone.name : zonesLoading ? "Loading zones…" : "Select a zone…"}
                </SBDMValue>
                {zone && <SBDMValueSub>{tenantLabel(zone)}</SBDMValueSub>}
                <SBDMArrow type="button">{sbdmOpen ? "▲" : "▼"}</SBDMArrow>
              </SBDMBar>
              {sbdmOpen && (
                <SBDMPanel>
                  <SBDMInnerBar>
                    <SBDMInnerInput
                      autoFocus
                      placeholder="Filter by zone or tenant…"
                      value={zoneQuery}
                      onChange={(e) => setZoneQuery(e.target.value)}
                    />
                    <SBDMCount>{zones.length} zones</SBDMCount>
                  </SBDMInnerBar>
                  <SBDMList>
                    {zonesErr && <SBDMEmpty>Couldn&apos;t load zones: {zonesErr}</SBDMEmpty>}
                    {!zonesErr && groups.length === 0 && <SBDMEmpty>No matching zones.</SBDMEmpty>}
                    {groups.map((g) => (
                      <div key={g.label}>
                        <SBDMGroup>{g.label}</SBDMGroup>
                        {g.zones.map((z) => (
                          <SBDMItem key={z.id} type="button" onClick={() => selectZone(z)}>
                            <SBDMDot $glow={zoneGlow(z)} />
                            <span>{z.name}</span>
                            <SBDMSub>{z.status}{z.nameserverMode ? ` · ${z.nameserverMode}` : ""}</SBDMSub>
                          </SBDMItem>
                        ))}
                      </div>
                    ))}
                  </SBDMList>
                </SBDMPanel>
              )}
            </SBDMWrap>

            {/* ── Selected zone + records ──────────────────────────────── */}
            {zone && (
              <Card>
                <ZoneHead>
                  <div>
                    <strong>{zone.name}</strong>{" "}
                    <Pill $glow={zoneGlow(zone)}>{zone.status}</Pill>{" "}
                    <Dim>{tenantLabel(zone)}</Dim>
                  </div>
                  <RefreshBtn type="button" onClick={() => zone && loadRecords(zone.id)} disabled={recLoading}>
                    {recLoading ? "…" : "↻ Refresh"}
                  </RefreshBtn>
                </ZoneHead>
                {zone.nameServers.length > 0 && (
                  <Dim>NS: {zone.nameServers.join(", ")}</Dim>
                )}

                {customNs && (
                  <Banner>
                    ⚠️ This domain uses <strong>custom nameservers</strong> — Cloudflare records here are
                    not authoritative for live resolution. Edit only if you know the zone is still served by CF.
                  </Banner>
                )}

                {recErr && <ErrText>Couldn&apos;t load records: {recErr}</ErrText>}

                {/* Records table */}
                <RecTable>
                  <RecHeadRow>
                    <RecCol $w="4.5rem">Type</RecCol>
                    <RecCol $w="13rem">Name</RecCol>
                    <RecCol $grow>Content</RecCol>
                    <RecCol $w="4.5rem">TTL</RecCol>
                    <RecCol $w="3rem">Prio</RecCol>
                    <RecCol $w="3.5rem">Proxy</RecCol>
                    <RecCol $w="7rem" $right>
                      <AddBtn type="button" onClick={startAdd} disabled={mode.kind !== "idle"}>
                        + Add
                      </AddBtn>
                    </RecCol>
                  </RecHeadRow>

                  {mode.kind === "add" && (
                    <DraftRow
                      draft={draft}
                      setDraft={setDraft}
                      busy={busy}
                      valid={draftValid}
                      onSave={saveDraft}
                      onCancel={cancelDraft}
                    />
                  )}

                  {recLoading && <RecEmpty>Loading records…</RecEmpty>}
                  {!recLoading && records.length === 0 && !recErr && (
                    <RecEmpty>No records in this zone yet.</RecEmpty>
                  )}

                  {records.map((r) =>
                    mode.kind === "edit" && mode.id === r.id ? (
                      <DraftRow
                        key={r.id}
                        draft={draft}
                        setDraft={setDraft}
                        busy={busy}
                        valid={draftValid}
                        onSave={saveDraft}
                        onCancel={cancelDraft}
                      />
                    ) : (
                      <RecRow key={r.id}>
                        <RecCol $w="4.5rem"><RType>{r.type}</RType></RecCol>
                        <RecCol $w="13rem" title={r.name}><Mono>{r.name}</Mono></RecCol>
                        <RecCol $grow title={r.content}><Mono $clip>{r.content}</Mono></RecCol>
                        <RecCol $w="4.5rem"><Dim>{r.ttl}</Dim></RecCol>
                        <RecCol $w="3rem"><Dim>{r.priority ?? "—"}</Dim></RecCol>
                        <RecCol $w="3.5rem"><Dim>{r.proxied ? "🟧" : "—"}</Dim></RecCol>
                        <RecCol $w="7rem" $right>
                          {confirmDelete === r.id ? (
                            <>
                              <DangerBtn type="button" disabled={busy} onClick={() => removeRecord(r)}>
                                {busy ? "…" : "Confirm"}
                              </DangerBtn>
                              <MiniBtn type="button" onClick={() => setConfirmDelete(null)}>✕</MiniBtn>
                            </>
                          ) : (
                            <>
                              <MiniBtn type="button" onClick={() => startEdit(r)} disabled={mode.kind !== "idle"}>
                                Edit
                              </MiniBtn>
                              <MiniBtn type="button" onClick={() => setConfirmDelete(r.id)} disabled={mode.kind !== "idle"}>
                                Del
                              </MiniBtn>
                            </>
                          )}
                        </RecCol>
                      </RecRow>
                    ),
                  )}
                </RecTable>

                {msg && (msg.kind === "ok" ? <OkText>{msg.text}</OkText> : <ErrText>{msg.text}</ErrText>)}
              </Card>
            )}

            {!zone && !zonesLoading && (
              <Note style={{ opacity: 0.8 }}>
                Pick a zone above to view and edit its DNS records. Operator edits mutate production
                DNS and are audited (actor · zone · record).
              </Note>
            )}
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

/* ── Draft (add / edit) row ───────────────────────────────────────────────── */
function DraftRow({
  draft,
  setDraft,
  busy,
  valid,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  busy: boolean;
  valid: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const showProxy = PROXIABLE.includes(draft.type);
  const showPrio = PRIORITIZED.includes(draft.type);
  return (
    <EditRow>
      <RecCol $w="4.5rem">
        <FSelect
          value={draft.type}
          onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as DnsType }))}
          disabled={busy}
        >
          {DNS_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </FSelect>
      </RecCol>
      <RecCol $w="13rem">
        <FInput
          placeholder="name (@ for root)"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          disabled={busy}
        />
      </RecCol>
      <RecCol $grow>
        <FInput
          placeholder="content / value"
          value={draft.content}
          onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
          disabled={busy}
        />
      </RecCol>
      <RecCol $w="4.5rem">
        <FInput
          type="number"
          placeholder="300"
          value={draft.ttl}
          onChange={(e) => setDraft((d) => ({ ...d, ttl: e.target.value }))}
          disabled={busy}
        />
      </RecCol>
      <RecCol $w="3rem">
        {showPrio ? (
          <FInput
            type="number"
            placeholder="10"
            value={draft.priority}
            onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}
            disabled={busy}
          />
        ) : (
          <Dim>—</Dim>
        )}
      </RecCol>
      <RecCol $w="3.5rem">
        {showProxy ? (
          <input
            type="checkbox"
            checked={draft.proxied}
            onChange={(e) => setDraft((d) => ({ ...d, proxied: e.target.checked }))}
            disabled={busy}
          />
        ) : (
          <Dim>—</Dim>
        )}
      </RecCol>
      <RecCol $w="7rem" $right>
        <SaveBtn type="button" disabled={!valid || busy} onClick={onSave}>
          {busy ? "…" : "Save"}
        </SaveBtn>
        <MiniBtn type="button" onClick={onCancel} disabled={busy}>✕</MiniBtn>
      </RecCol>
    </EditRow>
  );
}

/* ── styles ───────────────────────────────────────────────────────────────── */
const Sub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  letter-spacing: 0.04em;
  margin-top: 0.125rem;
`;
const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;
const Label = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${colors.gold};
  margin-bottom: 0.35rem;
`;
const Dim = styled.span`
  color: var(--t-textFaint);
  font-size: 0.72rem;
`;
const Note = styled.div`
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--t-textFaint);
`;

/* SBDM (Search Bar Dropdown Menu) — mirrors the inline primitives in dashboard/page.tsx,
   re-styled gold for the Villagers surface. */
const SBDMWrap = styled.div`
  position: relative;
`;
const SBDMBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.6rem;
  padding: 0.5rem 0.75rem;
  background: var(--t-inputBg);
  border: 1px solid rgba(${rgb.gold}, 0.3);
  cursor: pointer;
  &:hover { border-color: rgba(${rgb.gold}, 0.5); }
`;
const SBDMIcon = styled.span`
  display: inline-flex;
  align-items: center;
  font-size: 0.9rem;
`;
const SBDMValue = styled.span<{ $placeholder?: boolean }>`
  font-size: 0.85rem;
  color: ${(p) => (p.$placeholder ? "var(--t-textGhost)" : "var(--t-text)")};
`;
const SBDMValueSub = styled.span`
  font-size: 0.68rem;
  color: var(--t-textFaint);
`;
const SBDMArrow = styled.button`
  margin-left: auto;
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  border: none;
  background: none;
  color: ${colors.gold};
  cursor: pointer;
`;
const SBDMPanel = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  margin-top: 0.4rem;
  border-radius: 0.6rem;
  z-index: 30;
  overflow: hidden;
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.gold}, 0.35);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6), 0 0 24px rgba(${rgb.gold}, 0.12);
  backdrop-filter: blur(8px);
`;
const SBDMInnerBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-bottom: 1px solid var(--t-border);
`;
const SBDMInnerInput = styled.input`
  flex: 1;
  background: var(--t-inputBg);
  border-radius: 0.375rem;
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  color: var(--t-text);
  outline: none;
  border: none;
  &::placeholder { color: var(--t-textGhost); }
`;
const SBDMCount = styled.span`
  font-size: 0.62rem;
  color: var(--t-textFaint);
  white-space: nowrap;
`;
const SBDMList = styled.div`
  max-height: 20rem;
  overflow-y: auto;
`;
const SBDMGroup = styled.div`
  padding: 0.35rem 0.75rem;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: ${colors.gold};
  background: rgba(${rgb.gold}, 0.06);
  position: sticky;
  top: 0;
`;
const SBDMItem = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.75rem;
  text-align: left;
  font-size: 0.78rem;
  color: var(--t-text);
  border: none;
  background: none;
  cursor: pointer;
  &:hover { background: var(--t-inputBg); }
`;
const SBDMDot = styled.span<{ $glow: GlowColor }>`
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(p) => colors[p.$glow]};
  box-shadow: 0 0 6px ${(p) => colors[p.$glow]};
`;
const SBDMSub = styled.span`
  margin-left: auto;
  font-size: 0.62rem;
  color: var(--t-textFaint);
`;
const SBDMEmpty = styled.div`
  padding: 0.75rem;
  font-size: 0.72rem;
  color: var(--t-textFaint);
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(${rgb.gold}, 0.18);
  border-radius: 0.625rem;
  background: rgba(${rgb.gold}, 0.04);
`;
const ZoneHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.9rem;
`;
const Pill = styled.span<{ $glow: GlowColor }>`
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  color: ${(p) => colors[p.$glow]};
  border: 1px solid ${(p) => colors[p.$glow]};
  background: rgba(0, 0, 0, 0.2);
`;
const RefreshBtn = styled.button`
  font-size: 0.7rem;
  padding: 0.25rem 0.6rem;
  border-radius: 0.4rem;
  background: rgba(${rgb.gold}, 0.1);
  border: 1px solid rgba(${rgb.gold}, 0.4);
  color: ${colors.gold};
  cursor: pointer;
  &:hover:not(:disabled) { background: rgba(${rgb.gold}, 0.18); }
  &:disabled { opacity: 0.5; }
`;
const Banner = styled.div`
  font-size: 0.72rem;
  line-height: 1.4;
  padding: 0.5rem 0.65rem;
  border-radius: 0.45rem;
  color: ${colors.gold};
  background: rgba(${rgb.gold}, 0.08);
  border: 1px solid rgba(${rgb.gold}, 0.35);
`;

const RecTable = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid var(--t-border);
  border-radius: 0.45rem;
  overflow: hidden;
`;
const rowBase = `
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  font-size: 0.76rem;
`;
const RecHeadRow = styled.div`
  ${rowBase}
  background: rgba(${rgb.gold}, 0.06);
  border-bottom: 1px solid var(--t-border);
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--t-textFaint);
`;
const RecRow = styled.div`
  ${rowBase}
  border-bottom: 1px solid rgba(${rgb.gold}, 0.08);
  &:last-child { border-bottom: 0; }
  &:hover { background: rgba(${rgb.gold}, 0.04); }
`;
const EditRow = styled.div`
  ${rowBase}
  border-bottom: 1px solid rgba(${rgb.gold}, 0.08);
  background: rgba(${rgb.cyan}, 0.06);
`;
const RecCol = styled.div<{ $w?: string; $grow?: boolean; $right?: boolean }>`
  ${(p) => (p.$grow ? "flex: 1; min-width: 0;" : `flex: 0 0 ${p.$w ?? "auto"}; width: ${p.$w ?? "auto"};`)}
  display: flex;
  align-items: center;
  gap: 0.25rem;
  ${(p) => (p.$right ? "justify-content: flex-end;" : "")}
`;
const RecEmpty = styled.div`
  padding: 0.6rem 0.5rem;
  font-size: 0.72rem;
  color: var(--t-textFaint);
`;
const RType = styled.span`
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.05rem 0.35rem;
  border-radius: 0.3rem;
  color: ${colors.cyan};
  border: 1px solid rgba(${rgb.cyan}, 0.4);
`;
const Mono = styled.span<{ $clip?: boolean }>`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.72rem;
  color: var(--t-text);
  ${(p) => (p.$clip ? "overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" : "")}
`;

const FInput = styled.input`
  width: 100%;
  min-width: 0;
  padding: 0.3rem 0.4rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--t-border);
  border-radius: 0.35rem;
  color: var(--t-text);
  font-size: 0.74rem;
  &:focus { outline: none; border-color: rgba(${rgb.cyan}, 0.6); }
  &:disabled { opacity: 0.5; }
`;
const FSelect = styled.select`
  width: 100%;
  padding: 0.3rem 0.3rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--t-border);
  border-radius: 0.35rem;
  color: var(--t-text);
  font-size: 0.72rem;
  &:focus { outline: none; border-color: rgba(${rgb.cyan}, 0.6); }
`;

const AddBtn = styled.button`
  font-size: 0.66rem;
  padding: 0.2rem 0.55rem;
  border-radius: 0.35rem;
  background: rgba(${rgb.gold}, 0.14);
  border: 1px solid rgba(${rgb.gold}, 0.5);
  color: ${colors.gold};
  cursor: pointer;
  &:hover:not(:disabled) { background: rgba(${rgb.gold}, 0.24); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const SaveBtn = styled.button`
  font-size: 0.7rem;
  padding: 0.25rem 0.6rem;
  border-radius: 0.35rem;
  background: rgba(${rgb.cyan}, 0.14);
  border: 1px solid rgba(${rgb.cyan}, 0.55);
  color: ${colors.cyan};
  cursor: pointer;
  &:hover:not(:disabled) { background: rgba(${rgb.cyan}, 0.24); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const MiniBtn = styled.button`
  font-size: 0.66rem;
  padding: 0.2rem 0.45rem;
  border-radius: 0.35rem;
  background: transparent;
  border: 1px solid var(--t-border);
  color: var(--t-textMuted);
  cursor: pointer;
  &:hover:not(:disabled) { background: rgba(255, 255, 255, 0.06); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const DangerBtn = styled.button`
  font-size: 0.66rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.35rem;
  background: rgba(${rgb.red}, 0.16);
  border: 1px solid rgba(${rgb.red}, 0.55);
  color: ${colors.red};
  cursor: pointer;
  &:hover:not(:disabled) { background: rgba(${rgb.red}, 0.26); }
  &:disabled { opacity: 0.5; }
`;
const ErrText = styled.div`
  font-size: 0.75rem;
  color: ${colors.pink};
`;
const OkText = styled.div`
  font-size: 0.75rem;
  color: ${colors.green};
`;
