"use client";

// FeatureWorktreesControlModal — Office surface for the git-worktree feature
// isolation tool (skill: /srv/refusion-core/skills/worktree-isolation/, wrapper:
// /srv/refusion-core/utils/scripts/git/feature, slash command: /feature).
//
// Shows both Linux users' (admin + marmar) active worktrees side by side,
// supports per-row Finalize (squash/merge/discard/keep), Prune (dry-run /
// live), and tails /var/log/claude-feature-prune.log.

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
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

/* ── Types (mirror the API route) ─────────────────────────────── */

type LinuxUser = "admin" | "marmar";

type Worktree = {
  user: LinuxUser;
  name: string;
  repoBasename: string;
  repoRoot: string | null;
  worktreePath: string;
  branch: string;
  baseBranch: string;
  baseSha: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  existsOnDisk: boolean;
};

type GetResponse = {
  worktrees: Worktree[];
  cron: string[];
  pruneLog: { lines: string[]; mtime: string | null };
};

type DoneMode = "s" | "m" | "d" | "k";

/* ── Styled ───────────────────────────────────────────────────── */

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border: 1px solid rgba(${rgb.cyan}, 0.2);
  border-radius: 0.625rem;
  background: rgba(${rgb.cyan}, 0.04);
`;

const SectionTitle = styled.h3`
  margin: 0 0 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: ${colors.cyan};
`;

const Qmbm = styled.div`
  font-size: 0.78rem;
  color: var(--t-textFaint);
  line-height: 1.55;
  white-space: pre-line;
`;

const Table = styled.div`
  display: grid;
  grid-template-columns: auto 1fr 1fr 1fr auto auto auto;
  gap: 0.35rem 0.75rem;
  font-size: 0.78rem;
  align-items: center;
`;

const TH = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t-textFaint);
  padding-bottom: 0.25rem;
  border-bottom: 1px solid rgba(${rgb.cyan}, 0.15);
`;

const Cell = styled.div<{ $dim?: boolean }>`
  color: ${(p) => (p.$dim ? "var(--t-textFaint)" : "var(--t-text)")};
  font-family: ui-monospace, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const UserChip = styled.span<{ $user: LinuxUser }>`
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: ${(p) =>
    p.$user === "admin"
      ? `rgba(${rgb.cyan}, 0.18)`
      : `rgba(${rgb.pink}, 0.18)`};
  color: ${(p) => (p.$user === "admin" ? colors.cyan : colors.pink)};
  border: 1px solid
    ${(p) =>
      p.$user === "admin"
        ? `rgba(${rgb.cyan}, 0.4)`
        : `rgba(${rgb.pink}, 0.4)`};
`;

const Btn = styled.button<{ $tone?: "ok" | "warn" | "danger" }>`
  background: ${(p) =>
    p.$tone === "danger"
      ? `rgba(${rgb.red}, 0.12)`
      : p.$tone === "warn"
        ? `rgba(${rgb.gold}, 0.12)`
        : `rgba(${rgb.cyan}, 0.12)`};
  border: 1px solid
    ${(p) =>
      p.$tone === "danger"
        ? `rgba(${rgb.red}, 0.5)`
        : p.$tone === "warn"
          ? `rgba(${rgb.gold}, 0.5)`
          : `rgba(${rgb.cyan}, 0.5)`};
  color: ${(p) =>
    p.$tone === "danger"
      ? colors.red
      : p.$tone === "warn"
        ? colors.gold
        : colors.cyan};
  font-size: 0.7rem;
  padding: 0.25rem 0.55rem;
  border-radius: 0.3rem;
  cursor: pointer;
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const PruneRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
`;

const LogPre = styled.pre`
  margin: 0;
  font-size: 0.7rem;
  line-height: 1.4;
  max-height: 14rem;
  overflow: auto;
  background: rgba(0, 0, 0, 0.25);
  padding: 0.6rem 0.75rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(${rgb.cyan}, 0.15);
  white-space: pre;
  color: var(--t-text);
`;

const Toast = styled.div<{ $tone: "ok" | "err" }>`
  font-size: 0.75rem;
  padding: 0.4rem 0.6rem;
  border-radius: 0.3rem;
  background: ${(p) =>
    p.$tone === "ok" ? `rgba(${rgb.cyan}, 0.1)` : `rgba(${rgb.red}, 0.12)`};
  color: ${(p) => (p.$tone === "ok" ? colors.cyan : colors.red)};
  white-space: pre-wrap;
  font-family: ui-monospace, monospace;
`;

/* ── Helpers ──────────────────────────────────────────────────── */

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const d = Date.now() - t;
  const m = Math.floor(d / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

/* ── Component ────────────────────────────────────────────────── */

export type FeatureWorktreesControlModalProps = {
  onClose: () => void;
};

export default function FeatureWorktreesControlModal({
  onClose,
}: FeatureWorktreesControlModalProps) {
  useEscapeToClose({ open: true, onClose });

  const [data, setData] = useState<GetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "ok" | "err"; msg: string } | null>(
    null,
  );

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/feature-worktrees", { cache: "no-store" });
      if (r.ok) {
        const j = (await r.json()) as GetResponse;
        setData(j);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 12_000);
    return () => clearInterval(id);
  }, [refresh]);

  const callAction = useCallback(
    async (
      label: string,
      body: Record<string, unknown>,
    ): Promise<void> => {
      setBusy(label);
      setToast(null);
      try {
        const r = await fetch("/api/feature-worktrees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = (await r.json()) as {
          ok?: boolean;
          stdout?: string;
          stderr?: string;
          error?: string;
        };
        if (r.ok && j.ok) {
          setToast({
            tone: "ok",
            msg:
              (j.stdout?.trim() || "Done.") +
              (j.stderr ? `\n${j.stderr.trim()}` : ""),
          });
        } else {
          setToast({
            tone: "err",
            msg:
              j.error ??
              (j.stderr?.trim() || j.stdout?.trim() || `HTTP ${r.status}`),
          });
        }
      } catch (e) {
        setToast({ tone: "err", msg: String(e) });
      } finally {
        setBusy(null);
        await refresh();
      }
    },
    [refresh],
  );

  const wt = data?.worktrees ?? [];

  const grouped = useMemo(() => {
    const m = new Map<LinuxUser, Worktree[]>();
    for (const w of wt) {
      const arr = m.get(w.user) ?? [];
      arr.push(w);
      m.set(w.user, arr);
    }
    return m;
  }, [wt]);

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer
        $accent="cyan"
        $maxWidth="64rem"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle $color={colors.cyan}>🌲 Feature Worktrees</ModalTitle>
            <ModalSubtitle>
              git-worktree feature isolation — list active, finalize, prune
            </ModalSubtitle>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} aria-label="Close" />
        </ModalHeader>

        <ModalBody>
          <Stack>
            <Section>
              <SectionTitle>What is this?</SectionTitle>
              <Qmbm>
                Every non-trivial feature gets its own git worktree + branch,
                isolated under{" "}
                <code>~/.claude/worktrees/&lt;repo&gt;/&lt;name&gt;/</code>.
                Operators can start one with{" "}
                <code>/feature start &lt;name&gt;</code> in any Claude chat,
                close it with <code>/feature done</code>. This panel shows both
                Linux users&apos; active worktrees and lets you finalize or
                prune them without leaving Office.{"\n\n"}
                Skill: <code>/srv/refusion-core/skills/worktree-isolation/</code>
                {" · "}wrapper:{" "}
                <code>/srv/refusion-core/utils/scripts/git/feature</code>
              </Qmbm>
            </Section>

            <Section>
              <SectionTitle>Active worktrees ({wt.length})</SectionTitle>
              {loading && !data ? (
                <Qmbm>Loading…</Qmbm>
              ) : wt.length === 0 ? (
                <Qmbm>
                  No active worktrees on either user. To start one, type{" "}
                  <code>/feature start &lt;name&gt;</code> in a Claude chat.
                </Qmbm>
              ) : (
                <Table>
                  <TH>User</TH>
                  <TH>Name / Branch</TH>
                  <TH>Repo / Base</TH>
                  <TH>Path</TH>
                  <TH>Created</TH>
                  <TH>Last active</TH>
                  <TH>Finalize</TH>
                  {[...grouped.entries()]
                    .sort(([a], [b]) => (a < b ? -1 : 1))
                    .flatMap(([user, items]) =>
                      items.map((w) => (
                        <FinalizeRow
                          key={`${user}/${w.name}`}
                          w={w}
                          busy={busy}
                          onAction={(mode) =>
                            void callAction(
                              `${w.user}:${w.name}:${mode}`,
                              {
                                action: "done",
                                user: w.user,
                                name: w.name,
                                mode,
                              },
                            )
                          }
                        />
                      )),
                    )}
                </Table>
              )}
            </Section>

            <Section>
              <SectionTitle>Prune</SectionTitle>
              <Qmbm>
                Removes worktree directories untouched for N days. Branches are
                kept; only the working directory + registry entry go. Default
                threshold matches the daily cron (14 days).
              </Qmbm>
              <PruneRow>
                <Btn
                  disabled={!!busy}
                  onClick={() =>
                    void callAction("admin:prune-dry", {
                      action: "prune",
                      user: "admin",
                      dryRun: true,
                      days: 14,
                    })
                  }
                >
                  Dry-run (admin, 14d)
                </Btn>
                <Btn
                  disabled={!!busy}
                  onClick={() =>
                    void callAction("marmar:prune-dry", {
                      action: "prune",
                      user: "marmar",
                      dryRun: true,
                      days: 14,
                    })
                  }
                >
                  Dry-run (marmar, 14d)
                </Btn>
                <Btn
                  $tone="warn"
                  disabled={!!busy}
                  onClick={async () => {
                    if (
                      !(await askConfirm({
                        title: "Prune worktrees?",
                        message: "Live prune of admin worktrees older than 14d — proceed?",
                        confirmLabel: "Prune",
                      }))
                    )
                      return;
                    void callAction("admin:prune", {
                      action: "prune",
                      user: "admin",
                      dryRun: false,
                      days: 14,
                    });
                  }}
                >
                  Prune live (admin, 14d)
                </Btn>
                <Btn
                  $tone="warn"
                  disabled={!!busy}
                  onClick={async () => {
                    if (
                      !(await askConfirm({
                        title: "Prune worktrees?",
                        message: "Live prune of marmar worktrees older than 14d — proceed?",
                        confirmLabel: "Prune",
                      }))
                    )
                      return;
                    void callAction("marmar:prune", {
                      action: "prune",
                      user: "marmar",
                      dryRun: false,
                      days: 14,
                    });
                  }}
                >
                  Prune live (marmar, 14d)
                </Btn>
              </PruneRow>
            </Section>

            <Section>
              <SectionTitle>Auto-prune schedule</SectionTitle>
              <Qmbm>
                Cron file: <code>/etc/cron.d/claude-feature-prune</code>
              </Qmbm>
              <LogPre>
                {(data?.cron ?? []).join("\n") || "(no cron entries)"}
              </LogPre>
            </Section>

            <Section>
              <SectionTitle>
                Recent activity — /var/log/claude-feature-prune.log
                {data?.pruneLog.mtime
                  ? `  · updated ${relTime(data.pruneLog.mtime)}`
                  : ""}
              </SectionTitle>
              <LogPre>
                {data?.pruneLog.lines.length
                  ? data.pruneLog.lines.join("\n")
                  : "(log empty)"}
              </LogPre>
            </Section>

            {toast && <Toast $tone={toast.tone}>{toast.msg}</Toast>}
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}

/* ── Row sub-component ────────────────────────────────────────── */

function FinalizeRow({
  w,
  busy,
  onAction,
}: {
  w: Worktree;
  busy: string | null;
  onAction: (mode: DoneMode) => void;
}) {
  const rowBusy = busy?.startsWith(`${w.user}:${w.name}:`);
  return (
    <>
      <Cell>
        <UserChip $user={w.user}>{w.user}</UserChip>
      </Cell>
      <Cell title={w.branch}>
        🌲 {w.name}
        <div style={{ fontSize: "0.65rem", color: "var(--t-textFaint)" }}>
          {w.branch}
        </div>
      </Cell>
      <Cell title={w.repoRoot ?? ""}>
        {w.repoBasename}
        <div style={{ fontSize: "0.65rem", color: "var(--t-textFaint)" }}>
          off {w.baseBranch}
        </div>
      </Cell>
      <Cell $dim={!w.existsOnDisk} title={w.worktreePath}>
        {w.existsOnDisk ? "✅" : "⚠️"} {w.worktreePath.replace(/^.*\//, "")}
      </Cell>
      <Cell $dim>{relTime(w.createdAt)}</Cell>
      <Cell $dim>{relTime(w.lastActiveAt)}</Cell>
      <Cell style={{ display: "flex", gap: "0.2rem", flexWrap: "wrap" }}>
        <Btn
          disabled={!!busy}
          onClick={() => onAction("s")}
          title="Squash onto base"
        >
          {rowBusy ? "…" : "Squash"}
        </Btn>
        <Btn
          disabled={!!busy}
          onClick={() => onAction("k")}
          title="Keep branch, drop worktree dir"
        >
          Keep
        </Btn>
        <Btn
          $tone="danger"
          disabled={!!busy}
          onClick={async () => {
            if (
              !(await askConfirm({
                title: "Discard worktree?",
                message: `Discard worktree + branch feature/${w.name} (${w.user})? This deletes the branch.`,
                confirmLabel: "Discard",
              }))
            )
              return;
            onAction("d");
          }}
        >
          Discard
        </Btn>
      </Cell>
    </>
  );
}
