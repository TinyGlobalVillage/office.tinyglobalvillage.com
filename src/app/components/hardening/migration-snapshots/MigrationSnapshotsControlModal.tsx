"use client";
// Rollbacks — Utils tile (Gio 2026-11-21). Two kinds of rollback in one place:
//   • Build rollback: swap a site back to its previous build (.next ⇄ .next.prev). Never touches data.
//   • Data rollback: the snapshots rcs-migrate.sh takes before a destructive migration. Inspect one
//     (what the migration did, what the dump holds, the table's shape then vs now), restore it into a
//     restore_* scratch database to browse rows and copy missing ones back, or restore it in place.
// Plus the policy (snapshot vs approve, keep days), Snapshot now and Purge. All postgres/root work runs
// in mono utils/scripts/build-pipeline/migration-snapshots.sh; every action is audit-logged.
import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import Tooltip from "@/app/components/ui/Tooltip";
import NeonButton from "@tgv/module-component-library/components/ui/NeonButton";
import {
  KEEP_DAYS_CLAMP, type DiffLine, type ScratchDb, type Snapshot, type SnapshotPolicy, type TableCount,
} from "@/lib/migration-snapshots/config";

type Stamp = { mono: string | null; client: string | null; at: string | null } | null;
type Release = { client: string; follows: string | null; state: string | null; live: Stamp; prev: Stamp; lastRollback: { at: string; by: string } | null };
type Overview = {
  installed: boolean;
  policy: SnapshotPolicy;
  databases: Record<string, string[]>;
  snapshots: Snapshot[];
  scratch: ScratchDb[];
  errors: string[];
  releases: Release[];
};
type Inspect = { snapshot: Snapshot; tables: string[]; whole: boolean; migration: { found: boolean; statements: string[] } };
type Shape = { table: string; diff: DiffLine[] };

const when = (iso?: string | null) => { if (!iso) return "—"; try { return new Date(iso).toLocaleString(); } catch { return iso; } };
const size = (b?: number) => (typeof b !== "number" ? "—" : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const sha = (s?: string | null) => (s ? s.slice(0, 8) : "—");
const tablesOf = (s: Snapshot) => s.tables.replace(/"/g, "");
const base = (p: string) => p.split("/").pop() ?? p;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || r.statusText);
  return j as T;
}
const post = <T,>(body: Record<string, unknown>) =>
  api<T>("/api/admin/migration-snapshots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** A danger button that only arms once the exact phrase is typed. */
function TypedConfirm({ phrase, label, tip, busy, onConfirm }: { phrase: string; label: string; tip: string; busy: boolean; onConfirm: () => void }) {
  const [v, setV] = useState("");
  return (
    <Rowline>
      <Mono as="input" value={v} placeholder={`type ${phrase}`} aria-label={`Type ${phrase} to confirm`} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setV(e.target.value)} />
      <Tooltip label={tip}>
        <DangerBtn type="button" disabled={busy || v !== phrase} onClick={() => { onConfirm(); setV(""); }}>{label}</DangerBtn>
      </Tooltip>
    </Rowline>
  );
}

export default function MigrationSnapshotsControlModal({ onClose }: { onClose: () => void }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [detail, setDetail] = useState<Inspect | null>(null);
  const [shape, setShape] = useState<Shape | null>(null);
  const [scratch, setScratch] = useState<string | null>(null);
  const [scratchCounts, setScratchCounts] = useState<TableCount[] | null>(null);
  const [browse, setBrowse] = useState<{ table: string; offset: number; rows: Record<string, unknown>[] } | null>(null);
  const [snapClient, setSnapClient] = useState("");
  const [snapDb, setSnapDb] = useState("");
  const [snapTable, setSnapTable] = useState("");
  const [keepDays, setKeepDays] = useState("");

  const load = useCallback(async () => {
    try {
      const j = await api<Overview>("/api/admin/migration-snapshots");
      setOv(j);
      setKeepDays((k) => k || String(j.policy.keepDays));
      setError(j.errors[0] ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = setInterval(() => void load(), 30000); return () => clearInterval(t); }, [load]);

  /** Run one action: busy flag, error/note, reload. */
  const run = async (tag: string, fn: () => Promise<string | void>) => {
    setBusy(tag); setNote(null);
    try {
      const msg = await fn();
      if (msg) setNote(msg);
      setError(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const openSnapshot = (p: string) => run("inspect", async () => {
    setPicked(p); setShape(null); setDetail(null);
    setDetail(await api<Inspect>(`/api/admin/migration-snapshots/inspect?path=${encodeURIComponent(p)}`));
  });
  const openShape = (table: string) => run("shape", async () => {
    if (!picked) return;
    const j = await api<Shape>(`/api/admin/migration-snapshots/shape?path=${encodeURIComponent(picked)}&table=${encodeURIComponent(table)}`);
    setShape({ table, diff: j.diff });
  });
  const openScratch = (db: string) => run("counts", async () => {
    setScratch(db); setBrowse(null); setScratchCounts(null);
    setScratchCounts((await api<{ counts: TableCount[] }>(`/api/admin/migration-snapshots/scratch?db=${db}`)).counts);
  });
  const page = (table: string, offset: number) => run("rows", async () => {
    if (!scratch) return;
    const j = await api<{ rows: Record<string, unknown>[] }>(`/api/admin/migration-snapshots/scratch?db=${scratch}&table=${encodeURIComponent(table)}&offset=${offset}`);
    setBrowse({ table, offset, rows: j.rows });
  });

  const snaps = useMemo(() => (ov?.snapshots ?? []).filter((s) => !clientFilter || s.client === clientFilter), [ov, clientFilter]);
  const clients = useMemo(() => [...new Set((ov?.snapshots ?? []).map((s) => s.client).concat(Object.keys(ov?.databases ?? {})))].sort(), [ov]);
  const sel = detail?.snapshot;
  const scratchFrom = (d: ScratchDb) => (d.from?.startsWith("snapshot:") ? base(d.from.slice(9)) : "unknown origin");
  const browseCols = browse?.rows[0] ? Object.keys(browse.rows[0]) : [];

  const sections: HCMSection[] = [
    {
      id: "kinds",
      title: "Build rollback",
      qmbm: "Two kinds of rollback. A BUILD rollback swaps a site back to the build before this one (.next ⇄ .next.prev) — seconds, smoke-checked, and pressing it again rolls forward. It never touches the database: a migration the new build applied stays applied. A DATA rollback (below) restores what a destructive migration changed, from the snapshot taken just before it.",
      body: !ov ? <Muted>{error ? `Could not load: ${error}` : "Loading…"}</Muted> : (
        <Body>
          <Table>
            <thead><tr><th>Site</th><th>Live</th><th>Previous</th><th>Last rollback</th><th /></tr></thead>
            <tbody>
              {ov.releases.map((r) => (
                <tr key={r.client}>
                  <td>{r.client}{r.follows ? <Muted>follows {r.follows}</Muted> : null}</td>
                  <td><code>{sha(r.live?.mono)}</code> <Muted>{when(r.live?.at)}</Muted></td>
                  <td>{r.prev ? <><code>{sha(r.prev.mono)}</code> <Muted>{when(r.prev.at)}</Muted></> : <Muted>none</Muted>}</td>
                  <td>{r.lastRollback ? <Muted>{when(r.lastRollback.at)} · {r.lastRollback.by}</Muted> : <Muted>—</Muted>}</td>
                  <td>
                    {r.prev && r.state !== "promoting" ? (
                      <TypedConfirm phrase={r.client} label="Roll back build" tip="Swap to previous build" busy={!!busy}
                        onConfirm={() => void run("build", async () => { await post({ action: "build-rollback", client: r.client, confirm: r.client }); return `Rolling ${r.client} back to its previous build — watch Releases for the smoke result.`; })} />
                    ) : <Muted>{r.state === "promoting" ? "busy" : "nothing to roll back to"}</Muted>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Body>
      ),
    },
    {
      id: "snapshots",
      title: "Data snapshots",
      qmbm: "Each destructive migration (drop/truncate a table or column, change a type) is applied only after a pg_dump of the tables it touches — the whole database when it drops a schema or type. Pick one to see what the migration did, what the snapshot holds, and how each table's shape changed since.",
      body: !ov ? <Muted>Loading…</Muted> : (
        <Body>
          {!ov.installed && <Warn>migration-snapshots.sh is not on this box.</Warn>}
          <Rowline>
            <Label htmlFor="ms-client">Site</Label>
            <Select id="ms-client" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
              <option value="">all</option>
              {clients.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Muted>{snaps.length} snapshot{snaps.length === 1 ? "" : "s"}</Muted>
          </Rowline>
          <Scroll>
            <Table>
              <thead><tr><th>When</th><th>Database</th><th>Migration</th><th>Tables</th><th>Size</th><th>By</th></tr></thead>
              <tbody>
                {snaps.length === 0 && <tr><td colSpan={6}><Muted>No snapshots yet — one is taken before each destructive migration.</Muted></td></tr>}
                {snaps.map((s) => (
                  <PickRow key={s.path} $on={picked === s.path} $dim={s.purged} onClick={() => !s.purged && void openSnapshot(s.path)}>
                    <td>{when(s.at)}</td>
                    <td>{s.db}<Muted>{s.client}</Muted></td>
                    <td><code>{s.file}</code></td>
                    <td>{tablesOf(s)}</td>
                    <td>{s.purged ? "purged" : size(s.bytes)}</td>
                    <td>{s.by}</td>
                  </PickRow>
                ))}
              </tbody>
            </Table>
          </Scroll>

          {sel && detail && (
            <Detail>
              <Rowline><strong>{base(sel.path)}</strong><Muted>sha {sha(sel.sha256)} · {size(sel.bytes)}</Muted></Rowline>
              <Sub>What the migration did</Sub>
              {detail.migration.found
                ? detail.migration.statements.length
                  ? <Code>{detail.migration.statements.join("\n")}</Code>
                  : <Muted>No destructive statements in the file as it stands now.</Muted>
                : <Muted>{sel.file.startsWith("(") ? "Manual snapshot — no migration." : "The migration file is not in the live checkout."}</Muted>}
              <Sub>In the snapshot{detail.whole ? " (whole database)" : ""}</Sub>
              <Rowline>
                {detail.tables.map((t) => (
                  <Tooltip key={t} label="Shape then vs now">
                    <Chip type="button" $on={shape?.table === t} disabled={!!busy} onClick={() => void openShape(t)}>{t}</Chip>
                  </Tooltip>
                ))}
                {detail.tables.length === 0 && <Muted>no tables</Muted>}
              </Rowline>
              {shape && (
                <>
                  <Muted>{shape.table}: <Then>− in the snapshot</Then> · <Now>+ in {sel.db} now</Now></Muted>
                  <Code>
                    {shape.diff.map((l, i) => (
                      <DiffRow key={i} $k={l.kind}>{l.kind === "then" ? "− " : l.kind === "now" ? "+ " : "  "}{l.text}{"\n"}</DiffRow>
                    ))}
                  </Code>
                </>
              )}
              <Sub>Restore</Sub>
              <Rowline>
                <Tooltip label="Restore to scratch DB">
                  <NeonButton strong disabled={!!busy} onClick={() => void run("scratch", async () => {
                    const j = await post<{ scratch: string }>({ action: "restore-scratch", path: sel.path });
                    void openScratch(j.scratch);
                    return `Restored into ${j.scratch} — browse it under Scratch databases.`;
                  })}>{busy === "scratch" ? "Restoring…" : "Restore into a scratch database"}</NeonButton>
                </Tooltip>
                <Muted>Safe: {sel.db} is not touched.</Muted>
              </Rowline>
              <Danger>
                <strong>Restore in place</strong> drops {tablesOf(sel)} in <code>{sel.db}</code> and recreates them from this snapshot.
                Everything written to those tables since {when(sel.at)} is lost. Use it right after a bad migration;
                later, restore into a scratch database and copy rows back instead. The migration stays recorded and the code still
                expects the new shape — to undo the change for good, ship a migration.
                <TypedConfirm phrase={sel.db} label="Restore in place" tip="Overwrite live tables" busy={!!busy}
                  onConfirm={() => void run("inplace", async () => { await post({ action: "restore-in-place", path: sel.path, confirm: sel.db }); return `Restored ${tablesOf(sel)} in ${sel.db}.`; })} />
              </Danger>
              <Rowline>
                <Muted>Delete this snapshot file (the index keeps the record):</Muted>
                <TypedConfirm phrase="delete" label="Delete" tip="Delete snapshot file" busy={!!busy}
                  onConfirm={() => void run("delete", async () => { await post({ action: "delete", path: sel.path, confirm: "delete" }); setDetail(null); setPicked(null); return "Snapshot deleted."; })} />
              </Rowline>
            </Detail>
          )}
        </Body>
      ),
    },
    {
      id: "scratch",
      title: "Scratch databases",
      qmbm: "restore_* databases hold a snapshot restored next to the live one. Browse their rows, copy rows that are missing in the live table back (INSERT … ON CONFLICT DO NOTHING — an existing row is never overwritten; one transaction, so a shape mismatch changes nothing), and drop them when done.",
      body: !ov ? <Muted>Loading…</Muted> : (
        <Body>
          {ov.scratch.length === 0 && <Muted>None. Restore a snapshot into a scratch database above.</Muted>}
          {ov.scratch.map((d) => (
            <Rowline key={d.name}>
              <Tooltip label="Open scratch DB">
                <Chip type="button" $on={scratch === d.name} disabled={!!busy} onClick={() => void openScratch(d.name)}>{d.name}</Chip>
              </Tooltip>
              <Muted>{scratchFrom(d)} · {size(d.bytes)}</Muted>
              <Spacer />
              <Tooltip label="Drop scratch DB">
                <NeonButton disabled={!!busy} onClick={() => void run("drop", async () => {
                  await post({ action: "drop-scratch", scratch: d.name });
                  if (scratch === d.name) { setScratch(null); setScratchCounts(null); setBrowse(null); }
                  return `Dropped ${d.name}.`;
                })}>Drop</NeonButton>
              </Tooltip>
            </Rowline>
          ))}
          {scratch && scratchCounts && (
            <Detail>
              <Sub>{scratch}</Sub>
              <Table>
                <thead><tr><th>Table</th><th>Rows</th><th /></tr></thead>
                <tbody>
                  {scratchCounts.map((c) => (
                    <tr key={c.table}>
                      <td><code>{c.table}</code></td>
                      <td>{c.rows.toLocaleString()}</td>
                      <td>
                        <Tooltip label="Browse rows">
                          <NeonButton disabled={!!busy} onClick={() => void page(c.table, 0)}>Browse</NeonButton>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {browse && (
                <>
                  <Rowline>
                    <strong>{browse.table}</strong>
                    <Muted>rows {browse.offset + 1}–{browse.offset + browse.rows.length}</Muted>
                    <Spacer />
                    <Tooltip label="Previous page"><NeonButton disabled={!!busy || browse.offset === 0} onClick={() => void page(browse.table, Math.max(0, browse.offset - 50))}>Prev</NeonButton></Tooltip>
                    <Tooltip label="Next page"><NeonButton disabled={!!busy || browse.rows.length < 50} onClick={() => void page(browse.table, browse.offset + 50)}>Next</NeonButton></Tooltip>
                  </Rowline>
                  <Scroll>
                    <Table>
                      <thead><tr>{browseCols.map((k) => <th key={k}>{k}</th>)}</tr></thead>
                      <tbody>
                        {browse.rows.map((r, i) => (
                          <tr key={i}>{browseCols.map((k) => <td key={k}><Cell>{r[k] === null ? "∅" : typeof r[k] === "object" ? JSON.stringify(r[k]) : String(r[k])}</Cell></td>)}</tr>
                        ))}
                      </tbody>
                    </Table>
                  </Scroll>
                  <Danger>
                    <strong>Copy missing rows back</strong> inserts every row of <code>{browse.table}</code> that the live table does not
                    have (matched on its keys). Existing rows are never changed. If the live table's columns changed since, nothing is copied.
                    <TypedConfirm phrase={browse.table} label="Copy rows back" tip="Insert missing rows" busy={!!busy}
                      onConfirm={() => void run("copy", async () => {
                        const j = await post<{ result: { db: string; inserted: number } }>({ action: "copy-back", scratch, table: browse.table, confirm: browse.table });
                        return `Copied ${j.result.inserted} missing row${j.result.inserted === 1 ? "" : "s"} into ${j.result.db}.${browse.table}.`;
                      })} />
                  </Danger>
                </>
              )}
            </Detail>
          )}
        </Body>
      ),
    },
    {
      id: "snapshot-now",
      title: "Snapshot now",
      qmbm: "Take a snapshot by hand before risky manual work — one table, or the whole database when the table is left blank. It lands in the same list and can be restored the same way.",
      body: !ov ? <Muted>Loading…</Muted> : (
        <Body>
          <Rowline>
            <Label htmlFor="ms-snap-client">Site</Label>
            <Select id="ms-snap-client" value={snapClient} onChange={(e) => { setSnapClient(e.target.value); setSnapDb(ov.databases[e.target.value]?.[0] ?? ""); }}>
              <option value="">choose…</option>
              {Object.keys(ov.databases).map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select aria-label="Database" value={snapDb} onChange={(e) => setSnapDb(e.target.value)} disabled={!snapClient}>
              {(ov.databases[snapClient] ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </Rowline>
          <Rowline>
            <Label htmlFor="ms-snap-table">Table</Label>
            <Mono id="ms-snap-table" value={snapTable} placeholder="public.table — blank = whole database" onChange={(e) => setSnapTable(e.target.value.trim())} />
            <Tooltip label="Take snapshot now">
              <NeonButton strong disabled={!!busy || !snapClient || !snapDb} onClick={() => void run("snap", async () => {
                const j = await post<{ snapshot: Snapshot }>({ action: "snapshot-now", client: snapClient, db: snapDb, table: snapTable || undefined });
                return `Snapshot taken: ${base(j.snapshot.path)} (${size(j.snapshot.bytes)}).`;
              })}>{busy === "snap" ? "Snapshotting…" : "Snapshot now"}</NeonButton>
            </Tooltip>
          </Rowline>
        </Body>
      ),
    },
    {
      id: "policy",
      title: "Policy",
      qmbm: "Snapshot: a destructive migration applies after its snapshot, so a deploy never stalls (if the snapshot fails, it falls back to approval). Approve: every destructive migration waits for Releases → Approve. Snapshots older than the keep period are purged on the next destructive migration, or now.",
      body: !ov ? <Muted>Loading…</Muted> : (
        <Body>
          <Rowline>
            <Label as="span">Destructive</Label>
            <Tooltip label="Snapshot, then apply">
              <NeonButton strong={ov.policy.destructive === "snapshot"} disabled={!!busy} onClick={() => void run("policy", async () => { await post({ action: "policy", destructive: "snapshot" }); })}>Snapshot</NeonButton>
            </Tooltip>
            <Tooltip label="Wait for approval">
              <NeonButton strong={ov.policy.destructive === "approve"} disabled={!!busy} onClick={() => void run("policy", async () => { await post({ action: "policy", destructive: "approve" }); })}>Approve</NeonButton>
            </Tooltip>
          </Rowline>
          <Rowline>
            <Label htmlFor="ms-keep">Keep for</Label>
            <Num id="ms-keep" type="number" min={KEEP_DAYS_CLAMP[0]} max={KEEP_DAYS_CLAMP[1]} value={keepDays} onChange={(e) => setKeepDays(e.target.value)} />
            <Muted>days · {KEEP_DAYS_CLAMP[0]}–{KEEP_DAYS_CLAMP[1]}</Muted>
            <Tooltip label="Save keep days">
              <NeonButton disabled={!!busy || keepDays === String(ov.policy.keepDays)} onClick={() => void run("policy", async () => {
                const j = await post<{ policy: SnapshotPolicy }>({ action: "policy", keepDays: Number(keepDays) });
                setKeepDays(String(j.policy.keepDays));
              })}>Save</NeonButton>
            </Tooltip>
            <Spacer />
            <Tooltip label="Purge expired now">
              <NeonButton disabled={!!busy} onClick={() => void run("purge", async () => (await post<{ message: string }>({ action: "purge" })).message)}>Purge expired</NeonButton>
            </Tooltip>
          </Rowline>
        </Body>
      ),
    },
  ];

  return (
    <HardeningControlModal
      title="Rollbacks"
      subtitle="builds and data, side by side"
      qmbm={error ? `Error: ${error}` : note ?? "Roll a site back to its previous build, or bring back data a destructive migration removed — from the snapshot taken just before it ran."}
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/admin/migration-snapshots/audit-log" />}
      onClose={onClose}
    />
  );
}

const Body = styled.div`display: flex; flex-direction: column; gap: 0.75rem;`;
const Rowline = styled.div`display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap;`;
const Spacer = styled.div`flex: 1 1 auto;`;
const Muted = styled.div`font-size: 0.72rem; color: var(--t-textFaint);`;
const Sub = styled.div`font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--t-textMuted); margin-top: 0.25rem;`;
const Label = styled.label`font-size: 0.75rem; font-weight: 650; color: var(--t-textMuted); min-width: 5.5rem;`;
const Warn = styled.div`
  font-size: 0.78rem; color: ${colors.gold};
  border: 1px solid rgba(${rgb.gold}, 0.4); background: rgba(${rgb.gold}, 0.08);
  border-radius: 0.5rem; padding: 0.5rem 0.75rem;
`;
const Danger = styled.div`
  display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.75rem; line-height: 1.45; color: var(--t-text);
  border: 1px solid rgba(${rgb.red}, 0.45); background: rgba(${rgb.red}, 0.07);
  border-radius: 0.5rem; padding: 0.6rem 0.75rem;
`;
const DangerBtn = styled.button`
  font-size: 0.75rem; font-weight: 700; padding: 0.35rem 0.75rem; border-radius: 0.4rem; cursor: pointer;
  color: ${colors.red}; background: transparent; border: 1px solid ${colors.red};
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const Detail = styled.div`
  display: flex; flex-direction: column; gap: 0.6rem;
  border: 1px solid var(--t-border); border-radius: 0.6rem; padding: 0.75rem;
`;
const inputCss = `
  padding: 0.35rem 0.5rem; border-radius: 0.4rem; font-size: 0.78rem;
  background: var(--t-inputBg, transparent); color: var(--t-text); border: 1px solid var(--t-border);
`;
const Select = styled.select`${inputCss} color-scheme: dark;`;
const Mono = styled.input`${inputCss} font-family: ui-monospace, monospace; min-width: 14rem;`;
const Num = styled.input`${inputCss} width: 5rem; color-scheme: dark;`;
const Scroll = styled.div`max-height: 20rem; overflow: auto;`;
const Table = styled.table`
  width: 100%; border-collapse: collapse; font-size: 0.74rem;
  th { text-align: left; font-weight: 650; color: var(--t-textMuted); padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--t-border); white-space: nowrap; }
  td { padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--t-border); color: var(--t-text); vertical-align: top; }
  code { font-size: 0.7rem; }
`;
const PickRow = styled.tr<{ $on: boolean; $dim: boolean }>`
  cursor: ${(p) => (p.$dim ? "default" : "pointer")};
  opacity: ${(p) => (p.$dim ? 0.5 : 1)};
  background: ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.1)` : "transparent")};
  &:hover { background: ${(p) => (p.$dim ? "transparent" : `rgba(${rgb.cyan}, 0.06)`)}; }
`;
const Chip = styled.button<{ $on: boolean }>`
  font-size: 0.72rem; font-family: ui-monospace, monospace; padding: 0.2rem 0.55rem; border-radius: 999px; cursor: pointer;
  color: ${(p) => (p.$on ? colors.cyan : "var(--t-text)")};
  background: ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.12)` : "transparent")};
  border: 1px solid ${(p) => (p.$on ? colors.cyan : "var(--t-border)")};
  &:disabled { opacity: 0.6; cursor: wait; }
`;
const Code = styled.pre`
  margin: 0; padding: 0.6rem; border-radius: 0.4rem; font-size: 0.7rem; line-height: 1.45; overflow: auto; max-height: 18rem;
  background: var(--t-inputBg, transparent); border: 1px solid var(--t-border); color: var(--t-text); white-space: pre-wrap; word-break: break-word;
`;
const DiffRow = styled.span<{ $k: DiffLine["kind"] }>`
  color: ${(p) => (p.$k === "then" ? colors.red : p.$k === "now" ? colors.green : "var(--t-textMuted)")};
`;
const Then = styled.span`color: ${colors.red};`;
const Now = styled.span`color: ${colors.green};`;
const Cell = styled.span`display: inline-block; max-width: 18rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
