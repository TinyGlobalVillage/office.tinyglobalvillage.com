"use client";
// Folding@home — Utils tile (Gio 2026-11-22). Donor boxes (today RCS1, the standby box paid to
// June 2027) lend spare CPU to Folding@home protein-folding research. This panel shows each box live,
// switches folding on/off (off = the box is free at once and stays off across reboots), and sets the
// team number points are credited to (a reward team, once one is verified to pay).
import { useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import Tooltip from "@/app/components/ui/Tooltip";
import NeonButton from "@tgv/module-component-library/components/ui/NeonButton";
import Lightswitch from "@tgv/module-component-library/components/ui/Lightswitch";
import { fmtPpd, useFolding } from "./useFolding";

export default function FoldingControlModal({ onClose }: { onClose: () => void }) {
  const { snap, error, busy, act } = useFolding(15000);
  const [teams, setTeams] = useState<Record<string, string>>({});
  const hosts = snap?.hosts ?? [];
  const donor = snap?.donor;

  const sections: HCMSection[] = [
    {
      id: "now",
      title: "Now",
      qmbm: "Each donor box, live. Folding uses the cores shown and leaves the rest free. Points per day is Folding@home's own estimate for the work unit in progress; a unit takes hours, and points are credited when it is returned.",
      body: !snap ? <Muted>{error ? `Could not load: ${error}` : "Loading…"}</Muted> : (
        <Body>
          {hosts.map((h) => (
            <Card key={h.id}>
              <Rowline>
                <strong>{h.label}</strong>
                {h.role && <Muted>{h.role}</Muted>}
                <Pill $tone={!h.reachable ? "critical" : h.active ? "ok" : "idle"}>
                  {!h.reachable ? "Unreachable" : h.active ? "Folding" : "Free"}
                </Pill>
              </Rowline>
              {!h.reachable && <Warn>{h.error}</Warn>}
              {h.reachable && h.active && (
                <>
                  <Muted>
                    {h.cpus ?? "?"} of {h.cores ?? "?"} cores · {fmtPpd(h.ppd)} points/day · load {h.load?.map((x) => x.toFixed(1)).join(" / ") ?? "—"}
                  </Muted>
                  {(h.units ?? []).map((u, i) => (
                    <div key={i}>
                      <Bar aria-label="Work unit progress"><Fill style={{ width: `${Math.round((u.progress ?? 0) * 100)}%` }} /></Bar>
                      <Muted>project {u.project ?? "—"} · {Math.round((u.progress ?? 0) * 1000) / 10}% · {u.state?.toLowerCase()} · ETA {u.eta ?? "—"}</Muted>
                    </div>
                  ))}
                  {h.stateError && <Muted>{h.stateError}</Muted>}
                </>
              )}
              {h.reachable && !h.active && <Muted>Folding is off — the box is free for standby use.</Muted>}
            </Card>
          ))}
        </Body>
      ),
    },
    {
      id: "switch",
      title: "Switch",
      qmbm: "Off stops Folding@home at once and keeps it off across reboots, so the box is free if we need it as the standby. On starts it again; it picks up where it left off.",
      body: (
        <Body>
          {hosts.filter((h) => h.reachable).map((h) => (
            <Rowline key={h.id}>
              <Tooltip label={h.active ? `Folding on ${h.label}` : `${h.label} is free`}>
                <Lightswitch on={!!h.active} disabled={!!busy} ariaLabel={`Folding on ${h.label}`} onChange={(on) => void act(h.id, on ? "start" : "stop")} />
              </Tooltip>
              <Muted>{h.label}: {h.active ? "folding" : "free"}</Muted>
            </Rowline>
          ))}
          {hosts.length > 0 && hosts.every((h) => !h.reachable) && <Muted>No donor box is reachable.</Muted>}
        </Body>
      ),
    },
    {
      id: "rewards",
      title: "Points & team",
      qmbm: "Points are credited to the donor name below and show on Folding@home's public stats once the first work unit is returned. Team 0 means no team. Folding@home itself pays nothing. Checked 2026-11-22: Banano (team 234980) and Gridcoin still pay, Curecoin is unproven, FoldingCoin is dead — at our rate each is worth under $3 a year, and both paying ones need a new folding name. Details: mono rcs-stack/folding-at-home.md.",
      body: (
        <Body>
          <Rowline>
            <Label as="span">Donor</Label>
            <span>{donor?.name ?? "—"}</span>
            <Muted>
              {donor?.score != null ? `${donor.score.toLocaleString()} points · ${donor.wus ?? 0} units${donor.rank ? ` · rank ${donor.rank.toLocaleString()}` : ""}` : "no credited units yet"}
            </Muted>
          </Rowline>
          {hosts.filter((h) => h.reachable && h.active).map((h) => {
            const v = teams[h.id] ?? String(h.team ?? 0);
            const dirty = v !== String(h.team ?? 0);
            return (
              <Rowline key={h.id}>
                <Label htmlFor={`fold-team-${h.id}`}>{h.label} team</Label>
                <Num id={`fold-team-${h.id}`} type="number" min={0} value={v} onChange={(e) => setTeams({ ...teams, [h.id]: e.target.value })} />
                <Tooltip label="Save team">
                  <NeonButton strong disabled={!!busy || !dirty || !/^\d{1,10}$/.test(v)} onClick={() => void act(h.id, "team", Number(v))}>Save</NeonButton>
                </Tooltip>
              </Rowline>
            );
          })}
        </Body>
      ),
    },
  ];

  return (
    <HardeningControlModal
      title="Folding@home"
      subtitle="spare CPU for protein-folding research"
      qmbm={error ? `Error: ${error}` : "Donor boxes lend spare CPU to Folding@home, the Stanford-founded protein-folding research project. Folding stops the moment a box is needed — switch it off here or with the quick button on the tile."}
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/admin/folding/audit-log" />}
      onClose={onClose}
    />
  );
}

const Body = styled.div`display: flex; flex-direction: column; gap: 0.75rem;`;
const Card = styled.div`
  display: flex; flex-direction: column; gap: 0.45rem;
  border: 1px solid var(--t-border); border-radius: 0.5rem; padding: 0.65rem 0.8rem;
`;
const Rowline = styled.div`display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap;`;
const Muted = styled.div`font-size: 0.72rem; color: var(--t-textFaint);`;
const Warn = styled.div`
  font-size: 0.78rem; color: ${colors.gold};
  border: 1px solid rgba(${rgb.gold}, 0.4); background: rgba(${rgb.gold}, 0.08);
  border-radius: 0.5rem; padding: 0.5rem 0.75rem;
`;
const Pill = styled.span<{ $tone: "ok" | "idle" | "critical" }>`
  font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 999px;
  color: ${(p) => (p.$tone === "ok" ? colors.green : p.$tone === "critical" ? colors.red : "var(--t-textMuted)")};
  border: 1px solid currentColor;
`;
const Bar = styled.div`position: relative; height: 0.6rem; border-radius: 999px; overflow: hidden; background: var(--t-border);`;
const Fill = styled.div`height: 100%; border-radius: 999px; background: ${colors.green}; transition: width 0.4s ease;`;
const Label = styled.label`font-size: 0.75rem; font-weight: 650; color: var(--t-textMuted); min-width: 5.5rem;`;
const Num = styled.input`
  width: 8rem; padding: 0.35rem 0.5rem; border-radius: 0.4rem; font-size: 0.8rem;
  background: var(--t-inputBg, transparent); color: var(--t-text); border: 1px solid var(--t-border);
  color-scheme: dark;
`;
