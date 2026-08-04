"use client";

// SiteVersionsModal — "Client Versions": every version of every page and every
// piece of chrome a site has ever published, and the button that puts one back.
//
// The point of this surface is that it makes one promise, and the promise is
// the whole training: NOTHING IS EVER OVERWRITTEN. A save appends a numbered
// version; a pointer says which number is live; Restore moves the pointer back.
// No build, no deploy, nothing to time — the worst a person can do is publish
// something odd and click Restore.
//
// The history is captured by a trigger on the tables themselves (Office's
// sql/site-releases.sql), which is why sites nobody wired up are already in
// here. Sites whose rows come from a per-tenant schema are listed but not
// restorable — they are being pooled into `public`, and that is when their
// Restore turns on.
//
// There is no rendered preview: showing what v3 LOOKED like means rendering an
// unpublished payload on the public site, which is a route on
// tinyglobalvillage.com and not this modal's to invent. Inspect shows what the
// version contains and how it differs in shape from what is live; Restore, then
// the site itself, is the preview.

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
  ModalBody,
} from "@/app/styled";
import NeonX from "../NeonX";
import { askConfirm, askPrompt, showNotice } from "../dialogService";

/* ── shapes (mirror @tgv/module-page-editor/kit/server/releases) ── */

type ReleaseKind = "page" | "chrome";

type SiteSummary = {
  site: string;
  releases: number;
  pages: number;
  lastChange: string;
  restorable: boolean;
};

type Release = {
  site: string;
  kind: ReleaseKind;
  ref: string;
  version: number;
  label: string;
  note: string | null;
  author: string | null;
  source: string | null;
  srcSchema: string;
  createdAt: string;
  live: boolean;
};

/* ── styled ─────────────────────────────────────────────────────── */

const Sub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  letter-spacing: 0.04em;
  margin-top: 0.125rem;
`;

const Split = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;

  @media (min-width: 52rem) {
    grid-template-columns: 15rem 1fr;
    align-items: start;
  }
`;

const Pane = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
`;

const SiteBtn = styled.button<{ $on: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  text-align: left;
  padding: 0.5rem 0.6rem;
  border-radius: 0.5rem;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.gold}, 0.55)` : "var(--t-border)")};
  background: ${(p) => (p.$on ? `rgba(${rgb.gold}, 0.1)` : "rgba(0,0,0,0.18)")};
  color: ${(p) => (p.$on ? colors.gold : "var(--t-text)")};
  &:hover {
    background: rgba(${rgb.gold}, 0.08);
  }
`;

const SiteName = styled.span`
  font-size: 0.8125rem;
  font-weight: 700;
`;

const Faint = styled.span`
  font-size: 0.6875rem;
  color: var(--t-textFaint);
`;

const Group = styled.div`
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.18);
  overflow: hidden;
`;

const GroupHead = styled.button`
  width: 100%;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.65rem;
  cursor: pointer;
  background: transparent;
  border: 0;
  text-align: left;
  color: var(--t-text);
  &:hover {
    background: rgba(${rgb.gold}, 0.06);
  }
`;

const Mono = styled.span`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.75rem;
`;

const Row = styled.div<{ $live: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
  padding: 0.4rem 0.65rem;
  border-top: 1px solid var(--t-border);
  background: ${(p) => (p.$live ? `rgba(${rgb.cyan}, 0.07)` : "transparent")};
`;

const Ver = styled.span<{ $live: boolean }>`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${(p) => (p.$live ? colors.cyan : "var(--t-text)")};
  min-width: 2.5rem;
`;

const Pill = styled.span<{ $tone: "live" | "muted" }>`
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid
    ${(p) => (p.$tone === "live" ? `rgba(${rgb.cyan}, 0.5)` : "var(--t-border)")};
  color: ${(p) => (p.$tone === "live" ? colors.cyan : "var(--t-textFaint)")};
`;

const Spacer = styled.span`
  flex: 1;
`;

const MiniBtn = styled.button<{ $tone?: "gold" | "plain" }>`
  padding: 0.25rem 0.55rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 0.375rem;
  background: ${(p) => (p.$tone === "gold" ? `rgba(${rgb.gold}, 0.12)` : "transparent")};
  color: ${(p) => (p.$tone === "gold" ? colors.gold : "var(--t-textFaint)")};
  border: 1px solid ${(p) => (p.$tone === "gold" ? `rgba(${rgb.gold}, 0.5)` : "var(--t-border)")};
  &:hover:not(:disabled) {
    background: rgba(${rgb.gold}, 0.2);
  }
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const Inspect = styled.pre`
  margin: 0;
  padding: 0.5rem 0.65rem;
  border-top: 1px solid var(--t-border);
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--t-textFaint);
  max-height: 16rem;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
`;

const Note = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textFaint);
  line-height: 1.55;
`;

const ErrorText = styled.div`
  font-size: 0.6875rem;
  color: ${colors.pink};
  font-family: var(--font-geist-mono), monospace;
`;

/* ── helpers ────────────────────────────────────────────────────── */

const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

/** What a payload contains, in one line an operator can compare across versions. */
function describe(payload: unknown): string {
  const size = JSON.stringify(payload ?? null).length;
  const sections = (payload as { sections?: unknown })?.sections;
  if (Array.isArray(sections)) {
    const types = sections.map((s) => String((s as { type?: unknown })?.type ?? "?"));
    return `${sections.length} sections · ${types.join(", ")} · ${size} bytes`;
  }
  return `${size} bytes`;
}

/** A ref is '<lang>/<slug>'; the slug is what a person recognises. */
const slugOf = (ref: string) => ref.slice(ref.indexOf("/") + 1) || ref;
const langOf = (ref: string) => ref.slice(0, Math.max(ref.indexOf("/"), 0));

const groupKey = (r: Release) => `${r.kind}:${r.ref}`;

/* ── component ──────────────────────────────────────────────────── */

export default function SiteVersionsModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const [site, setSite] = useState<string | null>(null);
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [inspected, setInspected] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSites = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/site-versions", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 503
            ? "No version history yet — apply sql/site-releases.sql on tgv_db."
            : (data.error ?? `Load failed (HTTP ${res.status})`),
        );
        setSites([]);
        return;
      }
      setError(null);
      const list = (data.sites ?? []) as SiteSummary[];
      setSites(list);
      setSite((cur) => cur ?? list[0]?.site ?? null);
    } catch {
      setError("Load failed (network)");
      setSites([]);
    }
  }, []);

  const loadReleases = useCallback(async (which: string) => {
    setReleases(null);
    try {
      const res = await fetch(`/api/admin/site-versions?site=${encodeURIComponent(which)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Load failed (HTTP ${res.status})`);
        setReleases([]);
        return;
      }
      setError(null);
      setReleases((data.releases ?? []) as Release[]);
    } catch {
      setError("Load failed (network)");
      setReleases([]);
    }
  }, []);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  useEffect(() => {
    if (!site) return;
    setOpen(new Set());
    setInspected(null);
    void loadReleases(site);
  }, [site, loadReleases]);

  /** Releases bucketed by what they are a version of, live-first. */
  const groups = useMemo(() => {
    const out = new Map<string, Release[]>();
    for (const r of releases ?? []) {
      const list = out.get(groupKey(r));
      if (list) list.push(r);
      else out.set(groupKey(r), [r]);
    }
    return [...out.entries()].sort(([, a], [, b]) => {
      if (a[0].kind !== b[0].kind) return a[0].kind === "page" ? -1 : 1;
      return a[0].ref.localeCompare(b[0].ref);
    });
  }, [releases]);

  const current = sites?.find((s) => s.site === site) ?? null;

  const inspect = useCallback(
    async (r: Release) => {
      const id = `${groupKey(r)}#${r.version}`;
      if (inspected?.id === id) {
        setInspected(null);
        return;
      }
      setBusy(id);
      try {
        const qs = new URLSearchParams({
          site: r.site,
          kind: r.kind,
          ref: r.ref,
          version: String(r.version),
        });
        const res = await fetch(`/api/admin/site-versions?${qs}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        const payload = (data.release ?? {}).payload;
        setInspected({
          id,
          text: `${describe(payload)}\n\n${JSON.stringify(payload, null, 2)}`,
        });
      } catch {
        setError("Network error");
      } finally {
        setBusy(null);
      }
    },
    [inspected],
  );

  const doRestore = useCallback(
    async (r: Release) => {
      const ok = await askConfirm({
        title: `Restore v${r.version}`,
        message: `Put version ${r.version} of ${slugOf(r.ref)} back on ${r.site}?`,
        detail:
          "The live page goes back to exactly what this version contained. Nothing is deleted — the newer versions stay in the history and you can move forward again the same way. No build, no deploy.",
        confirmLabel: "Restore it",
        intent: "primary",
      });
      if (!ok) return;

      const id = `${groupKey(r)}#${r.version}`;
      setBusy(id);
      setError(null);
      try {
        const res = await fetch("/api/admin/site-versions", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "restore",
            site: r.site,
            kind: r.kind,
            ref: r.ref,
            version: r.version,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const why =
            data.error === "not_pooled"
              ? "This site still serves from its own schema, so it cannot be restored from here yet."
              : data.error === "no_target"
                ? "That page no longer exists on the site, so there is nothing to restore into."
                : (data.error ?? `HTTP ${res.status}`);
          await showNotice({ title: "Not restored", message: why, intent: "danger" });
          return;
        }
        await loadReleases(r.site);
      } catch {
        setError("Network error");
      } finally {
        setBusy(null);
      }
    },
    [loadReleases],
  );

  const doNote = useCallback(
    async (r: Release) => {
      const note = await askPrompt({
        title: `Note on v${r.version}`,
        message: `A short label so this version is recognisable later — "before the summer copy", "Marthe's fix".`,
        initialValue: r.note ?? "",
        confirmLabel: "Save note",
      });
      if (note === null) return;
      setBusy(`${groupKey(r)}#${r.version}`);
      try {
        await fetch("/api/admin/site-versions", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "note",
            site: r.site,
            kind: r.kind,
            ref: r.ref,
            version: r.version,
            note,
          }),
        });
        await loadReleases(r.site);
      } finally {
        setBusy(null);
      }
    },
    [loadReleases],
  );

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" $maxWidth="62rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>Client Versions</ModalTitle>
              <Sub>
                Every version a site has published, newest first. Restore puts one back — no
                build, no deploy, and nothing is ever deleted.
              </Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>

        <ModalBody>
          {error && <ErrorText>{error}</ErrorText>}
          {sites === null && !error && <Note>Loading sites…</Note>}
          {sites?.length === 0 && !error && (
            <Note>
              No history yet. A version is recorded the first time anything is published after
              sql/site-releases.sql was applied — nothing is backfilled, because there is
              nothing to backfill from.
            </Note>
          )}

          {!!sites?.length && (
            <Split>
              <Pane>
                {sites.map((s) => (
                  <SiteBtn key={s.site} $on={s.site === site} onClick={() => setSite(s.site)}>
                    <SiteName>{s.site}</SiteName>
                    <Faint>
                      {s.releases} version{s.releases === 1 ? "" : "s"} · {s.pages} page
                      {s.pages === 1 ? "" : "s"}
                    </Faint>
                    <Faint>last change {when(s.lastChange)}</Faint>
                  </SiteBtn>
                ))}
              </Pane>

              <Pane>
                {current && !current.restorable && (
                  <Note>
                    <strong>{current.site}</strong> still serves from its own database schema,
                    so its history is recorded but read-only. Restore turns on when the site is
                    pooled onto the shared renderer.
                  </Note>
                )}
                {releases === null && <Note>Loading versions…</Note>}
                {releases?.length === 0 && <Note>Nothing published on this site yet.</Note>}

                {groups.map(([key, list]) => {
                  const head = list[0];
                  const isOpen = open.has(key) || groups.length <= 3;
                  const live = list.find((r) => r.live);
                  return (
                    <Group key={key}>
                      <GroupHead
                        onClick={() =>
                          setOpen((prev) => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          })
                        }
                      >
                        <Mono>{slugOf(head.ref) || "/"}</Mono>
                        <Faint>
                          {head.kind === "chrome" ? "chrome" : "page"}
                          {langOf(head.ref) ? ` · ${langOf(head.ref)}` : ""}
                          {head.label ? ` · ${head.label}` : ""}
                        </Faint>
                        <Spacer />
                        {live && <Pill $tone="live">live v{live.version}</Pill>}
                        <Faint>
                          {list.length} version{list.length === 1 ? "" : "s"}
                        </Faint>
                      </GroupHead>

                      {isOpen &&
                        list.map((r) => {
                          const id = `${key}#${r.version}`;
                          return (
                            <div key={r.version}>
                              {/* Names the row for a UAT driver: three pages'
                                  worth of "v1" buttons are otherwise identical
                                  to anything clicking from the outside. */}
                              <Row $live={r.live} data-release={`${key}:v${r.version}`}>
                                <Ver $live={r.live}>v{r.version}</Ver>
                                <Faint>{when(r.createdAt)}</Faint>
                                <Faint>{r.author ?? r.source ?? "—"}</Faint>
                                {r.note && <Pill $tone="muted">{r.note}</Pill>}
                                {r.live && <Pill $tone="live">live</Pill>}
                                <Spacer />
                                <MiniBtn disabled={busy === id} onClick={() => void inspect(r)}>
                                  {inspected?.id === id ? "Hide" : "Inspect"}
                                </MiniBtn>
                                <MiniBtn disabled={busy === id} onClick={() => void doNote(r)}>
                                  Note
                                </MiniBtn>
                                {!r.live && (
                                  <MiniBtn
                                    $tone="gold"
                                    disabled={busy === id || current?.restorable === false}
                                    onClick={() => void doRestore(r)}
                                  >
                                    Restore
                                  </MiniBtn>
                                )}
                              </Row>
                              {inspected?.id === id && <Inspect>{inspected.text}</Inspect>}
                            </div>
                          );
                        })}
                    </Group>
                  );
                })}
              </Pane>
            </Split>
          )}

          <Note>
            History is recorded by the database itself, so it does not matter where a change
            came from — the editor, a template stamp, or a migration. Restoring replays a
            version into the live row and moves the pointer back to it; it appends nothing,
            because nothing new was written.
          </Note>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
