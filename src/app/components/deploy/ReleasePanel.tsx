"use client";

// ReleasePanel — one tile per release target on the Deploy page (deploy-watcher,
// 2026-10-28). The Mac's watcher stages a build whenever main moves; this panel
// shows main / staged / live / previous for each target and owns the two
// buttons that change production: Deploy (promote the staged build) and
// Rollback (swap back to .next.prev). Both run rcs-promote.sh on RCS.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import Tooltip from "../ui/Tooltip";
import ConfirmModal from "../frontdesk/ConfirmModal";

type Stamp = { mono: string | null; client: string | null; upstream: string | null; at: string | null; host: string | null };
type Release = {
  client: string;
  follows: string | null;
  state: string | null;
  phase: string | null;
  updatedAt: string | null;
  main: { mono: string; client: string; at: string } | null;
  live: Stamp | null;
  staged: Stamp | null;
  prev: Stamp | null;
  smoke: { ok: boolean; code: string; secs: number; at: string; url: string } | null;
  lastRollback: { at: string; by: string; from: Stamp | null; to: Stamp | null } | null;
  lastError: string | null;
  promoteBy: string | null;
  pendingMigrations: PendingMigration[];
  migrations: { at: string; by: string; result: { applied?: number; failed?: { file: string; db: string } }; log: string } | null;
  liveTag: string | null;
};
type PendingMigration = { file: string; sha256: string; destructive: boolean; approved: boolean; statements: string[]; databases: string[] };
type Watcher = { online: boolean; host: string | null; at: string | null };

const BUSY = new Set(["promoting", "building", "queued", "debouncing", "resolving"]);
const STATE_COLOR: Record<string, string> = {
  live: colors.green, staged: colors.cyan, promoting: colors.gold, building: colors.gold,
  queued: colors.gold, debouncing: colors.gold, resolving: colors.gold,
  failed: colors.red, blocked: colors.red, rolled_back: colors.orange, stale: colors.violet,
};

const short = (s?: string | null) => (s ? s.slice(0, 8) : "—");
const ago = (t?: string | null) => {
  if (!t) return "";
  const s = Math.max(0, Math.round((Date.now() - Date.parse(t)) / 1000));
  if (!Number.isFinite(s)) return "";
  return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)}m ago` : s < 172800 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};
const label = (c: string) => c.replace(/\.tinyglobalvillage\.com$/, "").replace(/^tinyglobalvillage\.com$/, "tgv.com");
const sameBuild = (a: Stamp | null, b: Stamp | null) => !!a && !!b && a.mono === b.mono && a.client === b.client;

export default function ReleasePanel() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [watcher, setWatcher] = useState<Watcher | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const [ask, setAsk] = useState<{ kind: "promote" | "rollback" | "approve"; r: Release } | null>(null);
  const [gear, setGear] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/deploy", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setReleases(d.releases ?? []);
        setWatcher(d.watcher ?? null);
      }
    } catch { /* */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const anyBusy = releases.some((r) => r.state && BUSY.has(r.state));
  useEffect(() => {
    const t = setInterval(load, anyBusy ? 3000 : 20000);
    return () => clearInterval(t);
  }, [anyBusy, load]);

  const post = async (client: string, body: Record<string, unknown>) => {
    setErr((e) => ({ ...e, [client]: "" }));
    try {
      const r = await fetch("/api/deploy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client, ...body }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr((e) => ({ ...e, [client]: d?.error ?? `HTTP ${r.status}` }));
    } finally { load(); }
  };

  const confirm = async () => {
    if (!ask) return;
    const { kind, r } = ask;
    setAsk(null);
    if (kind === "promote" && r.staged?.mono) {
      await post(r.client, { action: "promote", expectMono: r.staged.mono, expectClient: r.staged.client });
    } else if (kind === "rollback") {
      await post(r.client, { action: "rollback" });
    } else if (kind === "approve") {
      const files = unapproved(r).map((p) => ({ file: p.file, sha256: p.sha256 }));
      await post(r.client, { action: "approve-migrations", files });
    }
  };
  const unapproved = (r: Release) => (r.pendingMigrations ?? []).filter((p) => p.destructive && !p.approved);

  if (releases.length === 0) return null;

  return (
    <Wrap>
      <Head>
        <Title>Releases</Title>
        <WatchPill $on={!!watcher?.online}>
          {watcher?.online ? `Watcher online · ${watcher.host ?? "mac"}` : "Watcher offline"}
        </WatchPill>
        {watcher?.at && <Muted>polled {ago(watcher.at)}</Muted>}
      </Head>
      <Grid>
        {releases.map((r) => {
          const busy = !!r.state && BUSY.has(r.state);
          const stagedNew = !!r.staged && !sameBuild(r.staged, r.live);
          const color = STATE_COLOR[r.state ?? ""] ?? "#9aa0aa";
          const pending = r.pendingMigrations ?? [];
          const needsApproval = unapproved(r).length > 0;
          return (
            <Tile key={r.client} $color={color}>
              <TopRow>
                <Name>{label(r.client)}</Name>
                {r.follows && <Muted>follows {label(r.follows)}</Muted>}
                <State $color={color}>{(r.state ?? "idle").replace("_", " ")}</State>
              </TopRow>
              {r.phase && busy && <Phase>{r.phase}</Phase>}

              <Rows>
                <Row><K>main</K><Sha>{short(r.main?.mono)}{r.main?.client && r.main.client !== r.main.mono ? ` · ${short(r.main.client)}` : ""}</Sha><Age>{ago(r.main?.at)}</Age></Row>
                <Row $hl={stagedNew}><K>staged</K><Sha>{r.staged ? `${short(r.staged.mono)} · ${short(r.staged.client)}` : "—"}</Sha><Age>{stagedNew ? ago(r.staged?.at) : r.staged ? "same as live" : ""}</Age></Row>
                <Row><K>live</K><Sha>{r.live ? `${short(r.live.mono)} · ${short(r.live.client)}` : "—"}</Sha><Age>{ago(r.live?.at)}</Age></Row>
                <Row><K>previous</K><Sha>{r.prev ? `${short(r.prev.mono)} · ${short(r.prev.client)}` : "none"}</Sha><Age>{ago(r.prev?.at)}</Age></Row>
              </Rows>

              {r.smoke && (
                <Muted>
                  Smoke {r.smoke.ok ? "passed" : "FAILED"} · {r.smoke.code} in {r.smoke.secs}s · {ago(r.smoke.at)}
                </Muted>
              )}
              {r.lastRollback && (
                <Muted>Rolled back {ago(r.lastRollback.at)} by {r.lastRollback.by} to {short(r.lastRollback.to?.mono)}</Muted>
              )}
              {r.liveTag && <Muted>tagged {r.liveTag}</Muted>}
              {r.migrations?.result?.failed && (
                <ErrText>Migration failed: {r.migrations.result.failed.file} on {r.migrations.result.failed.db} · {ago(r.migrations.at)}</ErrText>
              )}
              {r.migrations && !r.migrations.result?.failed && (r.migrations.result?.applied ?? 0) > 0 && (
                <Muted>{r.migrations.result.applied} migration{r.migrations.result.applied === 1 ? "" : "s"} applied {ago(r.migrations.at)} by {r.migrations.by}</Muted>
              )}
              {pending.length > 0 && (
                <Migs $warn={needsApproval}>
                  <MigHead>
                    {needsApproval ? "Deploy waits on approval" : "This deploy migrates"}
                    <Muted> · {pending.length} file{pending.length === 1 ? "" : "s"} · {[...new Set(pending.flatMap((p) => p.databases))].join(", ")}</Muted>
                  </MigHead>
                  {pending.map((p) => (
                    <Mig key={p.file}>
                      <MigName>
                        <span>{p.file}</span>
                        {p.destructive && <MigBadge $ok={p.approved}>{p.approved ? "approved" : "destructive"}</MigBadge>}
                      </MigName>
                      {p.destructive && p.statements.length > 0 && (
                        <MigStmts>{p.statements.slice(0, 4).map((st, i) => <li key={i}>{st}</li>)}</MigStmts>
                      )}
                    </Mig>
                  ))}
                </Migs>
              )}
              {(err[r.client] || (r.state === "failed" && r.lastError)) && <ErrText>{err[r.client] || r.lastError}</ErrText>}

              <Actions>
                <Tooltip label={needsApproval ? "Approve migrations first" : stagedNew ? "Promote staged build" : "Nothing new staged"}>
                  <Btn
                    $c={rgb.green}
                    disabled={busy || !stagedNew || needsApproval}
                    onClick={() => setAsk({ kind: "promote", r })}
                  >
                    Deploy
                  </Btn>
                </Tooltip>
                {needsApproval && (
                  <Tooltip label="Approve destructive SQL">
                    <Btn $c={rgb.red} disabled={busy} onClick={() => setAsk({ kind: "approve", r })}>
                      Approve
                    </Btn>
                  </Tooltip>
                )}
                <Tooltip label={r.prev ? "Swap to previous build" : "No previous build"}>
                  <Btn
                    $c={rgb.orange}
                    disabled={busy || !r.prev}
                    onClick={() => setAsk({ kind: "rollback", r })}
                  >
                    Rollback
                  </Btn>
                </Tooltip>
                <Tooltip label="More actions">
                  <GearBtn aria-label="More actions" onClick={() => setGear((g) => ({ ...g, [r.client]: !g[r.client] }))}>⚙</GearBtn>
                </Tooltip>
              </Actions>
              {gear[r.client] && (
                <Actions>
                  <Tooltip label="Full build + ship now">
                    <Btn $c={rgb.cyan} disabled={busy} onClick={() => { setGear((g) => ({ ...g, [r.client]: false })); post(r.client, { action: "build" }); }}>
                      Build now
                    </Btn>
                  </Tooltip>
                </Actions>
              )}
            </Tile>
          );
        })}
      </Grid>

      <ConfirmModal
        open={!!ask}
        title={
          ask?.kind === "rollback" ? `Roll ${label(ask.r.client)} back?`
            : ask?.kind === "approve" ? `Approve destructive SQL on ${label(ask.r.client)}?`
            : `Deploy ${ask ? label(ask.r.client) : ""}?`
        }
        message={
          ask?.kind === "rollback"
            ? `Roll ${label(ask.r.client)} back to ${short(ask.r.prev?.mono)} (built ${ago(ask.r.prev?.at)})?`
            : ask?.kind === "approve"
              ? unapproved(ask.r).map((p) => `${p.file} → ${p.databases.join(", ")}`).join(" · ")
              : ask ? `Promote ${short(ask.r.staged?.mono)} · ${short(ask.r.staged?.client)} (built ${ago(ask.r.staged?.at)}) to live?` : ""
        }
        detail={
          ask?.kind === "rollback"
            ? "The current build becomes the previous one, so you can roll forward again. The site restarts and is smoke-checked."
            : ask?.kind === "approve"
              ? "These statements drop or rewrite data or shape. The next Deploy runs them, in one transaction per file, before the build goes live. A rollback does not undo them. Take a backup first if you are not sure."
              : (ask?.r.pendingMigrations?.length
                ? `Pending migrations apply first (${ask.r.pendingMigrations.length} file${ask.r.pendingMigrations.length === 1 ? "" : "s"}), then the site restarts on the new build and is smoke-checked. If it does not answer, it rolls back by itself.`
                : "The site restarts on the new build and is smoke-checked. If it does not answer, it rolls back by itself.")
        }
        confirmLabel={ask?.kind === "rollback" ? "Roll back" : ask?.kind === "approve" ? "Approve" : "Deploy"}
        intent={ask?.kind === "promote" ? "primary" : "danger"}
        onConfirm={confirm}
        onCancel={() => setAsk(null)}
      />
    </Wrap>
  );
}

const Wrap = styled.section`margin: 0 0 24px; display: flex; flex-direction: column; gap: 12px;`;
const Head = styled.div`display: flex; align-items: center; gap: 12px; flex-wrap: wrap;`;
const Title = styled.h2`margin: 0; font-size: 15px; font-weight: 700; color: #e8e8ef; letter-spacing: 0.02em;`;
const WatchPill = styled.span<{ $on: boolean }>`
  font-size: 11px; font-weight: 650; padding: 3px 10px; border-radius: 999px;
  ${(p) => (p.$on
    ? `background: rgba(${rgb.green},0.12); color: ${colors.green}; border: 1px solid rgba(${rgb.green},0.35);`
    : `background: rgba(${rgb.gold},0.12); color: ${colors.gold}; border: 1px solid rgba(${rgb.gold},0.3);`)}
`;
const Grid = styled.div`
  display: grid; gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
`;
const Tile = styled.div<{ $color: string }>`
  display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border-radius: 12px;
  background: rgba(10,12,18,0.85);
  border: 1px solid color-mix(in srgb, ${(p) => p.$color} 35%, transparent);
  box-shadow: 0 0 18px -10px ${(p) => p.$color};
  min-width: 0;
`;
const TopRow = styled.div`display: flex; align-items: center; gap: 8px; flex-wrap: wrap;`;
const Name = styled.span`font-weight: 700; font-size: 14px; color: #e8e8ef;`;
const State = styled.span<{ $color: string }>`
  margin-left: auto; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  color: ${(p) => p.$color};
`;
const Phase = styled.div`font-size: 11.5px; color: ${colors.gold};`;
const Rows = styled.div`display: flex; flex-direction: column; gap: 3px;`;
const Row = styled.div<{ $hl?: boolean }>`
  display: grid; grid-template-columns: 64px 1fr auto; gap: 8px; align-items: baseline; font-size: 12px;
  ${(p) => (p.$hl ? `color: ${colors.cyan};` : "color: rgba(232,232,239,0.75);")}
`;
const K = styled.span`font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.6;`;
const Sha = styled.span`font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Age = styled.span`font-size: 11px; opacity: 0.55; white-space: nowrap;`;
const Muted = styled.span`font-size: 11.5px; color: rgba(232,232,239,0.5);`;
const ErrText = styled.div`font-size: 11.5px; color: #ff9a9a; overflow-wrap: anywhere;`;
const Migs = styled.div<{ $warn: boolean }>`
  display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border-radius: 8px; font-size: 11.5px;
  background: rgba(${(p) => (p.$warn ? rgb.red : rgb.cyan)},0.07);
  border: 1px solid rgba(${(p) => (p.$warn ? rgb.red : rgb.cyan)},0.3);
`;
const MigHead = styled.div`font-weight: 650; color: #e8e8ef;`;
const Mig = styled.div`display: flex; flex-direction: column; gap: 2px; min-width: 0;`;
const MigName = styled.div`
  display: flex; gap: 8px; align-items: center; font-family: ui-monospace, monospace; font-size: 11px;
  color: rgba(232,232,239,0.8); & > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
const MigBadge = styled.span<{ $ok: boolean }>`
  font-family: inherit; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  padding: 1px 6px; border-radius: 999px; white-space: nowrap;
  color: ${(p) => (p.$ok ? colors.green : colors.red)};
  border: 1px solid rgba(${(p) => (p.$ok ? rgb.green : rgb.red)},0.5);
`;
const MigStmts = styled.ul`
  margin: 0; padding-left: 16px; font-family: ui-monospace, monospace; font-size: 10.5px; color: rgba(255,154,154,0.9);
  li { overflow-wrap: anywhere; }
`;
const Actions = styled.div`display: flex; gap: 8px; align-items: center; flex-wrap: wrap;`;
const Btn = styled.button<{ $c: string }>`
  padding: 6px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 650; cursor: pointer;
  background: rgba(${(p) => p.$c},0.14); color: rgb(${(p) => p.$c}); border: 1px solid rgba(${(p) => p.$c},0.4);
  &:disabled { opacity: 0.35; cursor: default; }
`;
const GearBtn = styled.button`
  margin-left: auto; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px;
  color: rgba(232,232,239,0.65); padding: 5px 9px; cursor: pointer; font-size: 13px;
`;
