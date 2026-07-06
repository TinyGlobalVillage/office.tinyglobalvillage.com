"use client";

// DemoModeControlModal — Office surface for "Demo Mode · Workshop": one click
// (package × site[s] × compute) spins up persistent, hot-reloading previews and
// records a workshop job. Typing "workshop <pkg>" in a Claude chat picks up that
// job so every chat edit hot-reloads the live page. Backed by /api/workshop →
// RCS utils/scripts/project/workshop/workshop.ts.
//
// Two pillbars govern the flow:
//   • Local | On RCS  — compute home. Local (default) runs the dev server on the
//     Mac (18GB, instant edits, localhost-only). On RCS = shareable demo-N URL on
//     the 7GB box (guarded until the Box RAM upgrade lands).
//   • Single site | Multi-site — fan out one package across N sites at once.
// Option B: a neon confirm fires on EVERY On-RCS pick and EVERY Multi-site pick,
// with context-accurate copy (Mac vs box). No 4-min idle reap — jobs persist until
// an explicit Stop (here or in chat), with a 24h safety backstop.
//
// NOTE: distinct from the "Dev Mode" user-impersonation drawer (components/dev/).
// That swaps WHO you are; this spins up WHAT you're building.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalSubtitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../../NeonX";
import { askConfirm } from "../../dialogService";

/* ── Types ─────────────────────────────────────────────────────── */
type Compute = "local" | "rcs";
type Fanout = "single" | "multi";
type JobInstance = {
  site: string;
  url: string;
  port: number;
  compute: Compute;
  slot?: number;
  instanceId?: string;
  pid?: number | null;
  status: "starting" | "ready" | "error";
  error?: string;
};
type Job = {
  jobId: string;
  pkg: string;
  pkgSlug: string;
  compute: Compute;
  sites: string[];
  instances: JobInstance[];
  status: "starting" | "up" | "stopping" | "down" | "error";
  createdBy: string;
  createdAt: string;
  ttlMs: number;
  entryPath?: string; // route to open (the module's full dashboard); default "/"
  error?: string;
};
type WorkshopResp = {
  ok: boolean;
  jobs: Job[];
  macSlotsTotal: number;
  rcsSlotsTotal: number;
  boxRamUpgraded: boolean;
};
type Combo = { pkg: string; tenants: string[] };
type Recipe = { pkg: string; tenant: string; label?: string };
type CatalogResp = { ok: boolean; packages: string[]; combos: Combo[]; recipes: Recipe[] };

/* ── Styled ─────────────────────────────────────────────────────── */
const Stack = styled.div`display:flex;flex-direction:column;gap:1rem;`;
const Section = styled.section`
  display:flex;flex-direction:column;gap:.55rem;padding:.875rem 1rem;
  border:1px solid rgba(${rgb.cyan},.2);border-radius:.625rem;background:rgba(${rgb.cyan},.04);
`;
const SectionTitle = styled.h3`
  margin:0 0 .1rem;font-size:.6875rem;font-weight:700;text-transform:uppercase;
  letter-spacing:.12em;color:${colors.cyan};
`;
const Hint = styled.div`font-size:.78rem;color:var(--t-textFaint);line-height:1.55;`;
const Row = styled.div`display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;`;
const PillRow = styled.div`display:flex;gap:1rem;align-items:center;flex-wrap:wrap;justify-content:flex-start;`;
const Select = styled.select`
  background:rgba(0,0,0,.25);color:var(--t-text);border:1px solid rgba(${rgb.cyan},.35);
  border-radius:.4rem;padding:.4rem .55rem;font-size:.8rem;min-width:14rem;
  &:disabled{opacity:.5;}
`;
const CheckGrid = styled.div`
  display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:.35rem;
`;
const CheckItem = styled.label<{ $on: boolean }>`
  display:flex;gap:.5rem;align-items:center;font-size:.8rem;cursor:pointer;
  padding:.35rem .5rem;border-radius:.4rem;user-select:none;
  border:1px solid rgba(${(p) => (p.$on ? rgb.cyan : "255,255,255")},${(p) => (p.$on ? ".5" : ".08")});
  background:rgba(${rgb.cyan},${(p) => (p.$on ? ".1" : "0")});
  input{accent-color:${colors.cyan};}
`;
const Btn = styled.button<{ $tone?: "ok" | "warn" | "danger" }>`
  background:${(p) => (p.$tone === "danger" ? `rgba(${rgb.red},.12)` : p.$tone === "warn" ? `rgba(${rgb.gold},.12)` : `rgba(${rgb.cyan},.14)`)};
  border:1px solid ${(p) => (p.$tone === "danger" ? `rgba(${rgb.red},.5)` : p.$tone === "warn" ? `rgba(${rgb.gold},.5)` : `rgba(${rgb.cyan},.55)`)};
  color:${(p) => (p.$tone === "danger" ? colors.red : p.$tone === "warn" ? colors.gold : colors.cyan)};
  font-size:.74rem;font-weight:700;padding:.4rem .7rem;border-radius:.4rem;cursor:pointer;
  &:disabled{opacity:.4;cursor:not-allowed;}
`;
const Card = styled.div`
  display:flex;flex-direction:column;gap:.4rem;
  padding:.6rem .75rem;border:1px solid rgba(${rgb.cyan},.15);border-radius:.5rem;
  background:rgba(0,0,0,.2);font-size:.8rem;
`;
const CardHead = styled.div`display:flex;gap:.6rem;align-items:center;justify-content:space-between;flex-wrap:wrap;`;
const SiteRow = styled.div`display:grid;grid-template-columns:auto 1fr auto;gap:.35rem .6rem;align-items:center;`;
const Dot = styled.span<{ $s: JobInstance["status"] | Job["status"] }>`
  width:.6rem;height:.6rem;border-radius:50%;display:inline-block;flex:0 0 auto;
  background:${(p) => (p.$s === "ready" || p.$s === "up" ? "#3ad07a" : p.$s === "starting" ? colors.gold : p.$s === "down" || p.$s === "stopping" ? "var(--t-textFaint)" : colors.red)};
  box-shadow:0 0 6px ${(p) => (p.$s === "ready" || p.$s === "up" ? "#3ad07a" : p.$s === "starting" ? colors.gold : "transparent")};
  animation:${(p) => (p.$s === "starting" || p.$s === "stopping" ? "dp-pulse 1s infinite" : "none")};
  @keyframes dp-pulse{0%,100%{opacity:1;}50%{opacity:.35;}}
`;
const Link = styled.a`color:${colors.cyan};font-family:ui-monospace,monospace;text-decoration:none;&:hover{text-decoration:underline;}`;
const Mono = styled.div`font-family:ui-monospace,monospace;font-size:.72rem;color:var(--t-textFaint);`;
const Badge = styled.span<{ $kind?: "local" | "rcs" | "prepared" }>`
  font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
  padding:.1rem .4rem;border-radius:999px;
  background:rgba(${(p) => (p.$kind === "rcs" ? rgb.gold : rgb.cyan)},.16);
  color:${(p) => (p.$kind === "rcs" ? colors.gold : colors.cyan)};
  border:1px solid rgba(${(p) => (p.$kind === "rcs" ? rgb.gold : rgb.cyan)},.4);
`;
const Meter = styled.div`
  display:flex;gap:1rem;font-family:ui-monospace,monospace;font-size:.72rem;color:var(--t-textFaint);
`;
const Toast = styled.div<{ $tone: "ok" | "err" }>`
  font-size:.75rem;padding:.4rem .6rem;border-radius:.3rem;white-space:pre-wrap;font-family:ui-monospace,monospace;
  background:${(p) => (p.$tone === "ok" ? `rgba(${rgb.cyan},.1)` : `rgba(${rgb.red},.12)`)};
  color:${(p) => (p.$tone === "ok" ? colors.cyan : colors.red)};
`;

/* ── Component ─────────────────────────────────────────────────── */
export type DemoModeControlModalProps = { onClose: () => void };

export default function DemoModeControlModal({ onClose }: DemoModeControlModalProps) {
  useEscapeToClose({ open: true, onClose });

  const [catalog, setCatalog] = useState<CatalogResp | null>(null);
  const [resp, setResp] = useState<WorkshopResp | null>(null);
  const [pkg, setPkg] = useState("");
  const [tenant, setTenant] = useState(""); // single-site selection
  const [selected, setSelected] = useState<string[]>([]); // multi-site selection
  const [compute, setCompute] = useState<Compute>("local");
  const [fanout, setFanout] = useState<Fanout>("single");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);
  const boxRamUpgraded = resp?.boxRamUpgraded ?? false;
  const boxRamRef = useRef(false);
  boxRamRef.current = boxRamUpgraded;

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/workshop", { cache: "no-store" });
      if (r.ok) setResp((await r.json()) as WorkshopResp);
    } catch { /* transient */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/demo-preview/catalog", { cache: "no-store" });
        if (r.ok) setCatalog((await r.json()) as CatalogResp);
      } catch { /* ignore */ }
    })();
    refresh();
  }, [refresh]);

  // Poll jobs every 5s. No heartbeat — workshop jobs persist until explicit Stop.
  useEffect(() => {
    const id = setInterval(refresh, 5_000);
    return () => clearInterval(id);
  }, [refresh]);

  const tenantsForPkg = useMemo(
    () => catalog?.combos.find((c) => c.pkg === pkg)?.tenants ?? [],
    [catalog, pkg],
  );

  // Option B — neon confirm on EVERY On-RCS pick and EVERY Multi-site pick.
  const onCompute = useCallback(async (k: string) => {
    const next = k as Compute;
    if (next === "rcs") {
      const ok = await askConfirm(
        boxRamRef.current
          ? { title: "Run on RCS?", message: "Run this workshop on the RCS box — it gets a shareable https://demo-N.tinyglobalvillage.com URL. Proceed?", confirmLabel: "Use RCS", intent: "primary" }
          : { title: "Run on RCS?", message: "Only run on RCS once the Box RAM upgrade has landed. The 7GB box can OOM under a live compile — RCS is capped at one live workshop until then. Proceed anyway?", confirmLabel: "Use RCS", intent: "danger" },
      );
      if (!ok) return;
    }
    setCompute(next);
  }, []);

  const onFanout = useCallback(async (k: string) => {
    const next = k as Fanout;
    if (next === "multi") {
      const onRcs = compute === "rcs";
      const ok = await askConfirm(
        onRcs
          ? { title: "Multi-site on RCS?", message: "Multi-site starts one live compile per site on the 7GB box — high OOM risk until the Box RAM upgrade lands. Proceed?", confirmLabel: "Multi-site", intent: boxRamRef.current ? "primary" : "danger" }
          : { title: "Multi-site on your Mac?", message: "Multi-site starts one hot-reload dev server per site on your Mac (~2–3.6 GB each). Your Mac handles ~4 comfortably; more may swap. Proceed?", confirmLabel: "Multi-site", intent: "primary" },
      );
      if (!ok) return;
    }
    setFanout(next);
  }, [compute]);

  const toggleSite = useCallback((site: string) => {
    setSelected((s) => (s.includes(site) ? s.filter((x) => x !== site) : [...s, site]));
  }, []);

  const sites = useMemo(
    () => (fanout === "multi" ? selected : tenant ? [tenant] : []),
    [fanout, selected, tenant],
  );

  const start = useCallback(async () => {
    if (!pkg || sites.length === 0) return;
    setBusy(true);
    setToast(null);
    try {
      const r = await fetch("/api/workshop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pkg, sites, compute }),
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        setToast({ tone: "ok", msg: `Provisioning ${pkg} × [${sites.join(", ")}] on ${compute === "local" ? "your Mac" : "RCS"}… watch below (first build can take a minute).` });
      } else {
        setToast({ tone: "err", msg: j.error || `HTTP ${r.status}` });
      }
    } catch (e) {
      setToast({ tone: "err", msg: String(e) });
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [pkg, sites, compute, refresh]);

  const stop = useCallback(
    async (job: Job) => {
      if (!(await askConfirm({ title: "Stop workshop?", message: `Stop ${job.pkg} × [${job.sites.join(", ")}]? The worktree + any edits are kept.`, confirmLabel: "Stop", intent: "danger" }))) return;
      setBusy(true);
      try {
        const r = await fetch(`/api/workshop/${job.jobId}`, { method: "DELETE" });
        const j = await r.json();
        setToast(r.ok && j.ok ? { tone: "ok", msg: `Stopped ${job.jobId}.` } : { tone: "err", msg: j.error || `HTTP ${r.status}` });
      } catch (e) {
        setToast({ tone: "err", msg: String(e) });
      } finally {
        setBusy(false);
        await refresh();
      }
    },
    [refresh],
  );

  const jobs = resp?.jobs ?? [];
  const macTotal = resp?.macSlotsTotal ?? 8;
  const rcsTotal = resp?.rcsSlotsTotal ?? 8;
  const live = (c: Compute) =>
    jobs.filter((j) => j.compute === c && j.status !== "down").reduce((n, j) => n + (j.instances?.length || j.sites.length), 0);
  const localInUse = live("local");
  const rcsInUse = live("rcs");
  const canStart = !busy && !!pkg && sites.length > 0;

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="cyan" $maxWidth="62rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle $color={colors.cyan}>🧪 Demo Mode · Workshop</ModalTitle>
            <ModalSubtitle>local {localInUse}/{macTotal} · RCS {rcsInUse}/{rcsTotal} slots in use</ModalSubtitle>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} aria-label="Close" />
        </ModalHeader>

        <ModalBody>
          <Stack>
            <Section>
              <SectionTitle>What is this?</SectionTitle>
              <Hint>
                One click spins up a hot-reloading preview of a shared <code>@tgv/*</code> package inside the
                site(s) that consume it, then records a <b>workshop job</b>. Type <code>workshop &lt;pkg&gt;</code> in a
                Claude chat and every edit hot-reloads the live page. Previews persist until you hit <b>Stop</b>
                {" "}(here or in chat) — no 4-minute timeout; a 24h backstop cleans up anything forgotten.
                {"\n"}<b>Local</b> runs on your Mac (instant edits, localhost only). <b>On RCS</b> gives a shareable
                {" "}<code>demo-N</code> URL on the 7GB box{boxRamUpgraded ? "" : " — capped at one live workshop until the Box RAM upgrade"}.
              </Hint>
            </Section>

            <Section>
              <SectionTitle>Start a workshop</SectionTitle>
              <PillRow>
                <PillBar
                  segments={[{ key: "local", label: "Local" }, { key: "rcs", label: "On RCS" }]}
                  active={compute}
                  onChange={(k) => void onCompute(k)}
                  accent={rgb.cyan}
                  ariaLabel="Compute home"
                />
                <PillBar
                  segments={[{ key: "single", label: "Single site" }, { key: "multi", label: "Multi-site" }]}
                  active={fanout}
                  onChange={(k) => void onFanout(k)}
                  accent={rgb.cyan}
                  ariaLabel="Fan-out"
                />
              </PillRow>

              <Row>
                <Select
                  value={pkg}
                  disabled={!catalog}
                  onChange={(e) => { setPkg(e.target.value); setTenant(""); setSelected([]); }}
                >
                  <option value="">{catalog ? "Select a package…" : "Loading…"}</option>
                  {catalog?.packages.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Select>

                {fanout === "single" ? (
                  <Select value={tenant} disabled={!pkg} onChange={(e) => setTenant(e.target.value)}>
                    <option value="">{pkg ? (tenantsForPkg.length ? "Select a host site…" : "no site consumes this package") : "Pick a package first"}</option>
                    {tenantsForPkg.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
                ) : null}

                <Btn onClick={() => void start()} disabled={!canStart}>
                  {busy ? "…" : `▶ Start workshop${sites.length > 1 ? ` (${sites.length})` : ""}`}
                </Btn>
              </Row>

              {fanout === "multi" && (
                <>
                  <Hint>{pkg ? (tenantsForPkg.length ? "Check every site to workshop together:" : "no site consumes this package") : "Pick a package first"}</Hint>
                  {!!pkg && tenantsForPkg.length > 0 && (
                    <CheckGrid>
                      {tenantsForPkg.map((t) => (
                        <CheckItem key={t} $on={selected.includes(t)}>
                          <input type="checkbox" checked={selected.includes(t)} onChange={() => toggleSite(t)} />
                          {t}
                        </CheckItem>
                      ))}
                    </CheckGrid>
                  )}
                </>
              )}

              <Meter>
                <span>compute: <b style={{ color: compute === "local" ? colors.cyan : colors.gold }}>{compute === "local" ? "Local (Mac)" : "On RCS"}</b></span>
                <span>Mac {localInUse}/{macTotal}</span>
                <span>RCS {rcsInUse}/{rcsTotal}</span>
                {!boxRamUpgraded && <span style={{ color: colors.gold }}>RCS cap 1 · pre-upgrade</span>}
              </Meter>
            </Section>

            <Section>
              <SectionTitle>Live workshops ({jobs.length})</SectionTitle>
              {jobs.length === 0 ? (
                <Hint>No workshops running. Pick a package + site(s) above and hit Start.</Hint>
              ) : (
                <Stack>
                  {jobs.map((job) => (
                    <Card key={job.jobId}>
                      <CardHead>
                        <Row>
                          <Dot $s={job.status} title={job.status} />
                          <b>{job.pkg}</b>
                          <Badge $kind={job.compute}>{job.compute === "local" ? "Local" : "On RCS"}</Badge>
                          <Mono>{job.jobId}</Mono>
                        </Row>
                        <Btn $tone="danger" disabled={busy} onClick={() => void stop(job)}>Stop</Btn>
                      </CardHead>
                      {(job.instances?.length ? job.instances : job.sites.map((s) => ({ site: s, url: "", port: 0, compute: job.compute, status: job.status as JobInstance["status"] }))).map((i) => (
                        <SiteRow key={i.site}>
                          <Dot $s={i.status} title={i.status} />
                          <Mono>
                            {i.status === "ready" && i.url
                              ? <Link href={i.url + (job.entryPath ?? "")} target="_blank" rel="noreferrer">{(i.url + (job.entryPath ?? "")).replace(/^https?:\/\//, "")} ↗</Link>
                              : i.status === "starting"
                                ? `${i.site} — building…`
                                : i.status === "error"
                                  ? `${i.site} — error: ${i.error ?? "failed"}`
                                  : i.site}
                          </Mono>
                          <Mono>{i.slot ? `slot ${i.slot}` : i.port ? `:${i.port}` : ""}</Mono>
                        </SiteRow>
                      ))}
                    </Card>
                  ))}
                </Stack>
              )}
            </Section>

            {toast && <Toast $tone={toast.tone}>{toast.msg}</Toast>}
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
