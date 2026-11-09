"use client";

// MediaFolderControlModal — the HCM for the /media/ (CDN) access policy served off
// /srv/refusion-core/cdn (audit 2026-11-07 #29). Lists every permitted folder and lets
// an operator expand/contract the allow-list from a GUI, flip denylist↔allowlist mode,
// apply the result to the live nginx, and probe a path against the enforced policy.
//
// Box half: src/lib/system/nginx-media.ts + utils/scripts/media/media-allowlist-apply.sh.
// API: /api/hardening/media-folder (GET snapshot · POST add/remove/set-mode/apply).
//
// SAFE BY DEFAULT: mode=denylist reproduces historical prod (serve all but privateFolders),
// so an Apply with the shipped config changes nothing — it just makes the policy tunable.

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import { askConfirm } from "../../dialogService";
import { colors, rgb } from "@/app/theme";

type Mode = "denylist" | "allowlist";
type ListKey = "privateFolders" | "publicCabinets" | "publicRoots";
type Snapshot = {
  mode: Mode;
  privateFolders: string[];
  publicCabinets: string[];
  publicRoots: string[];
  lastUpdated: string | null;
  lastAppliedAt: string | null;
  generatedMap: string;
};

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const valid = (n: string) => NAME_RE.test(n) && !n.includes("..");
const fmt = (t?: string | null) => (t ? new Date(t).toLocaleString() : "—");

export default function MediaFolderControlModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<ListKey, string>>({ privateFolders: "", publicCabinets: "", publicRoots: "" });
  const [probePath, setProbePath] = useState("");
  const [probeResult, setProbeResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/hardening/media-folder", { credentials: "same-origin", cache: "no-store" });
      const d = await r.json();
      if (d?.ok) setSnap(d.snapshot);
      else setError(d?.error ?? `HTTP ${r.status}`);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const post = useCallback(async (payload: Record<string, unknown>): Promise<boolean> => {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/hardening/media-folder", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.snapshot) setSnap(d.snapshot);
      if (!r.ok || d?.ok === false) { setError(d?.error ?? d?.detail ?? `HTTP ${r.status}`); return false; }
      return true;
    } catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  }, []);

  const addFolder = useCallback(async (list: ListKey) => {
    const name = (draft[list] || "").trim();
    if (!valid(name)) return;
    if (await post({ action: "add-folder", list, name })) setDraft((p) => ({ ...p, [list]: "" }));
  }, [draft, post]);

  const removeFolder = useCallback(async (list: ListKey, name: string) => {
    const noun = list === "privateFolders" ? "deny" : "allow";
    const ok = await askConfirm({
      title: "Remove folder?",
      message: `Stop ${noun}-listing "${name}"? Takes effect on the next Apply.`,
      confirmLabel: "Remove",
    });
    if (ok) await post({ action: "remove-folder", list, name });
  }, [post]);

  const setMode = useCallback(async (mode: Mode) => {
    if (mode === snap?.mode) return;
    if (mode === "allowlist") {
      const ok = await askConfirm({
        title: "Switch to allow-list (deny-by-default)?",
        message: "In allow-list mode nginx serves ONLY the public roots + cabinets below; every other /media/ path 404s. Probe the paths you rely on first. Change takes effect on Apply.",
        confirmLabel: "Use allow-list",
      });
      if (!ok) return;
    }
    await post({ action: "set-mode", mode });
  }, [snap?.mode, post]);

  const apply = useCallback(async () => {
    setApplyMsg(null);
    const ok = await askConfirm({
      title: "Apply to live nginx?",
      message: "Installs the generated map, gates location /media/, runs nginx -t, and reloads. Auto-reverts if nginx -t fails.",
      confirmLabel: "Apply + reload",
    });
    if (!ok) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/hardening/media-folder", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "apply" }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.snapshot) setSnap(d.snapshot);
      setApplyMsg((d?.ok ? "✓ " : "✗ ") + (d?.detail ?? `HTTP ${r.status}`));
    } catch (e) { setApplyMsg("✗ " + (e as Error).message); }
    finally { setBusy(false); }
  }, []);

  const probe = useCallback(async () => {
    const p = probePath.trim();
    if (!p) return;
    const url = p.startsWith("/media/") ? p : "/media/" + p.replace(/^\/+/, "");
    setProbeResult("…");
    try {
      const r = await fetch(url, { method: "HEAD", credentials: "omit", cache: "no-store" });
      setProbeResult(r.status === 404 ? `404 — blocked (${url})` : `${r.status} — served (${url})`);
    } catch (e) { setProbeResult("error — " + (e as Error).message); }
  }, [probePath]);

  const list = useCallback((key: ListKey, label: string, color: string, placeholder: string) => {
    const items = snap?.[key] ?? [];
    const d = (draft[key] || "").trim();
    return (
      <ListBody>
        <Chips>
          {items.length === 0 && <Empty>None.</Empty>}
          {items.map((n) => (
            <Chip key={n} $color={color}>
              {n}
              <X type="button" title={`Remove ${n}`} disabled={busy} onClick={() => removeFolder(key, n)}>×</X>
            </Chip>
          ))}
        </Chips>
        <AddRow>
          <Input
            placeholder={placeholder}
            value={draft[key]}
            disabled={busy}
            onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") addFolder(key); }}
          />
          <AddBtn type="button" $color={color} disabled={busy || !valid(d)} onClick={() => addFolder(key)}>Add</AddBtn>
        </AddRow>
        {d.length > 0 && !valid(d) && <BadName>Letters, digits, . _ - only · one path segment · no slashes.</BadName>}
        <Hint>{label}</Hint>
      </ListBody>
    );
  }, [snap, draft, busy, addFolder, removeFolder]);

  const mode = snap?.mode ?? "denylist";
  const allowActive = mode === "allowlist";

  const sections: HCMSection[] = useMemo(() => [
    {
      id: "mode",
      title: "Access mode",
      qmbm:
        "Deny-list (default, = historical prod) serves every /media/ path EXCEPT the private folders. " +
        "Allow-list is deny-by-default: nginx serves ONLY the public roots + cabinets, and 404s everything " +
        "else. Private folders are denied in BOTH modes. Flip to allow-list only after probing the paths you " +
        "rely on — it is the strict posture.",
      body: (
        <Body>
          <Rowline>
            <Pill $on={!allowActive}>{allowActive ? "ALLOW-LIST — deny by default" : "DENY-LIST — serve all but private"}</Pill>
          </Rowline>
          <Toggle>
            <TBtn $active={!allowActive} disabled={busy} onClick={() => setMode("denylist")}>Deny-list (open)</TBtn>
            <TBtn $active={allowActive} disabled={busy} onClick={() => setMode("allowlist")}>Allow-list (strict)</TBtn>
          </Toggle>
          <Muted>Edited {fmt(snap?.lastUpdated)} · last applied to nginx {fmt(snap?.lastAppliedAt)}.</Muted>
        </Body>
      ),
    },
    {
      id: "private",
      title: `Private folders — always 404 (${snap?.privateFolders.length ?? 0})`,
      qmbm:
        "These folder names are denied as a path segment anywhere under /media/, in BOTH modes, emitted first " +
        "so a private name always beats a broad public root. This is where documents/users/chat live — the " +
        "sensitive buckets that must never be publicly fetchable.",
      body: list("privateFolders", "Denied anywhere under /media/, in both modes.", colors.pink, "e.g. documents"),
    },
    {
      id: "roots",
      title: `Public roots — whole bucket (${snap?.publicRoots.length ?? 0})`,
      qmbm:
        "A whole /media/<name>/ bucket served publicly. Only takes effect in ALLOW-LIST mode (in deny-list " +
        "mode everything not private is already served). Use for shared buckets like office/embed/gen-favicons.",
      body: (
        <>
          {!allowActive && <ModeNote>Informational in deny-list mode — these are already served. Effective once you switch to allow-list.</ModeNote>}
          {list("publicRoots", "Serves /media/<name>/… for anyone (allow-list mode).", colors.green, "e.g. embed")}
        </>
      ),
    },
    {
      id: "cabinets",
      title: `Public cabinets — per-tenant folder (${snap?.publicCabinets.length ?? 0})`,
      qmbm:
        "A folder name served publicly when it sits one level under a tenant: /media/<tenant>/<name>/… . Only " +
        "effective in ALLOW-LIST mode. Use for the per-site public cabinets (avatars, backgrounds, nav, …).",
      body: (
        <>
          {!allowActive && <ModeNote>Informational in deny-list mode. Effective once you switch to allow-list.</ModeNote>}
          {list("publicCabinets", "Serves /media/<tenant>/<name>/… (allow-list mode).", colors.cyan, "e.g. avatars")}
        </>
      ),
    },
    {
      id: "apply",
      title: "Apply + probe",
      qmbm:
        "Apply installs the generated nginx map and the location /media/ gate, runs nginx -t, and reloads — " +
        "auto-reverting if the test fails. The live probe does a HEAD against the policy nginx is enforcing " +
        "RIGHT NOW (Apply first to test unsaved edits): 200 = served, 404 = blocked.",
      body: (
        <Body>
          <Rowline>
            <ApplyBtn type="button" disabled={busy} onClick={apply}>Apply to nginx + reload</ApplyBtn>
            {applyMsg && <ApplyMsg $ok={applyMsg.startsWith("✓")}>{applyMsg}</ApplyMsg>}
          </Rowline>
          <AddRow>
            <Input
              placeholder="Probe a path, e.g. office/logo.png or documents/x.pdf"
              value={probePath}
              onChange={(e) => setProbePath(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") probe(); }}
            />
            <AddBtn type="button" $color={colors.gold} disabled={!probePath.trim()} onClick={probe}>Probe</AddBtn>
          </AddRow>
          {probeResult && <ProbeOut>{probeResult}</ProbeOut>}
        </Body>
      ),
    },
    {
      id: "preview",
      title: "Generated nginx map",
      qmbm: "Exactly what an Apply installs to /etc/nginx/conf.d/media-allowlist.conf — read-only preview from the current config.",
      body: <Pre>{snap?.generatedMap ?? "…"}</Pre>,
    },
  ], [snap, busy, allowActive, applyMsg, probePath, probeResult, list, setMode, apply, probe]);

  return (
    <HardeningControlModal
      title="Media Folder"
      subtitle="/media/ (CDN) access policy — which folders nginx serves off /srv/refusion-core/cdn."
      qmbm={
        "What is this?\n\n" +
        "The control surface for the /media/ CDN access policy. /media/ aliases /srv/refusion-core/cdn; " +
        "nginx decides per-request whether to serve a file or 404 it.\n\n" +
        "DENY-LIST (default) serves everything except the private folders (documents/users/chat) — the " +
        "exact historical prod behaviour. ALLOW-LIST is the strict posture: serve ONLY the public roots + " +
        "cabinets, 404 the rest. Private folders are denied in both modes.\n\n" +
        "Add/remove folders in the lists, then Apply to push the map to the live nginx (test-gated + " +
        "auto-reverting). The shipped config is a behavioural no-op, so applying it is safe."
      }
      onClose={onClose}
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/hardening/media-folder/audit-log" />}
    />
  );
}

/* ---- styles (cloned from BuildGuard + Fail2ban exemplars) ---- */
const Body = styled.div`display: flex; flex-direction: column; gap: 10px;`;
const Rowline = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`;
const Muted = styled.div`font-size: 11.5px; color: var(--t-textFaint);`;
const Pill = styled.span<{ $on: boolean }>`
  font-size: 11px; font-weight: 650; padding: 3px 10px; border-radius: 999px;
  ${(p) => (p.$on
    ? `background: rgba(${rgb.green},0.14); color: ${colors.green}; border: 1px solid rgba(${rgb.green},0.35);`
    : `background: rgba(${rgb.orange},0.14); color: ${colors.orange}; border: 1px solid rgba(${rgb.orange},0.35);`)}
`;
const Toggle = styled.div`display: inline-flex; border: 1px solid var(--t-border); border-radius: 8px; overflow: hidden; width: fit-content;`;
const TBtn = styled.button<{ $active: boolean }>`
  background: ${(p) => (p.$active ? `rgba(${rgb.gold},0.18)` : "transparent")};
  color: ${(p) => (p.$active ? colors.gold : "var(--t-textFaint)")};
  border: none; padding: 8px 16px; font-size: 12.5px; font-weight: 600; cursor: pointer;
  &:disabled { opacity: 0.5; cursor: default; }
`;
const ListBody = styled.div`display: flex; flex-direction: column; gap: 8px;`;
const Chips = styled.div`display: flex; flex-wrap: wrap; gap: 6px;`;
const Chip = styled.span<{ $color: string }>`
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 6px 3px 10px; border-radius: 999px;
  font-family: var(--font-geist-mono), monospace; font-size: 11.5px;
  background: ${(p) => p.$color}14; color: ${(p) => p.$color};
  border: 1px solid ${(p) => p.$color}59;
`;
const X = styled.button`
  cursor: pointer; border: 0; background: transparent; color: inherit; font-size: 13px; line-height: 1;
  &:hover:not(:disabled) { opacity: 0.6; } &:disabled { opacity: 0.4; cursor: default; }
`;
const AddRow = styled.div`display: flex; gap: 8px; align-items: center;`;
const Input = styled.input`
  flex: 1; padding: 6px 9px; font-family: var(--font-geist-mono), monospace; font-size: 12.5px;
  background: var(--t-inputBg); border: 1px solid var(--t-border); border-radius: 7px; color: var(--t-text);
  &:focus { outline: none; border-color: rgba(${rgb.gold},0.5); }
`;
const AddBtn = styled.button<{ $color: string }>`
  padding: 6px 12px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
  cursor: pointer; border-radius: 7px;
  background: ${(p) => p.$color}1a; color: ${(p) => p.$color}; border: 1px solid ${(p) => p.$color}73;
  &:hover:not(:disabled) { background: ${(p) => p.$color}2e; } &:disabled { opacity: 0.5; cursor: not-allowed; }
`;
const ApplyBtn = styled.button`
  padding: 8px 16px; font-size: 12.5px; font-weight: 700; cursor: pointer; border-radius: 8px;
  background: rgba(${rgb.gold},0.16); color: ${colors.gold}; border: 1px solid rgba(${rgb.gold},0.45);
  &:hover:not(:disabled) { background: rgba(${rgb.gold},0.26); } &:disabled { opacity: 0.5; cursor: not-allowed; }
`;
const ApplyMsg = styled.span<{ $ok: boolean }>`
  font-family: var(--font-geist-mono), monospace; font-size: 11.5px;
  color: ${(p) => (p.$ok ? colors.green : colors.pink)};
`;
const ProbeOut = styled.div`font-family: var(--font-geist-mono), monospace; font-size: 11.5px; color: var(--t-text);`;
const Pre = styled.pre`
  margin: 0; padding: 10px; border-radius: 8px; overflow: auto; max-height: 320px;
  background: var(--t-inputBg); border: 1px solid var(--t-border);
  font-family: var(--font-geist-mono), monospace; font-size: 11px; line-height: 1.5; color: var(--t-textFaint);
`;
const Empty = styled.span`font-size: 11.5px; color: var(--t-textFaint); font-style: italic;`;
const Hint = styled.div`font-size: 10.5px; color: var(--t-textFaint);`;
const BadName = styled.div`font-size: 10.5px; color: ${colors.pink};`;
const ModeNote = styled.div`font-size: 11px; color: var(--t-textFaint); font-style: italic; margin-bottom: 6px;`;
