"use client";
// Folding@home tile quick-bar (Gio 2026-11-22): live state + ONE click to free the donor box
// ("Free RCS1" = stop + disable fah-client) or hand it back to folding ("Resume").
// Sits beside the tile button (a button can't nest in a button) — see Utils page "folding" tile.
import styled from "styled-components";
import { colors } from "@/app/theme";
import Tooltip from "@/app/components/ui/Tooltip";
import NeonButton from "@tgv/module-component-library/components/ui/NeonButton";
import { fmtPpd, useFolding } from "./useFolding";

export default function FoldingQuickBar() {
  const { snap, error, busy, act } = useFolding(60000);
  const h = snap?.hosts[0];
  if (!h) return <Bar><Dot $c="var(--t-textFaint)" />{error ? "unreachable" : "checking…"}</Bar>;
  const on = !!h.active;
  const label = on ? `Free ${h.label}` : `Resume folding`;
  return (
    <Bar>
      <Dot $c={!h.reachable ? colors.red : on ? colors.green : "var(--t-textFaint)"} />
      <span>{!h.reachable ? `${h.label} unreachable` : on ? `${h.label} folding · ${fmtPpd(h.ppd)} pts/day` : `${h.label} free`}</span>
      <Spacer />
      {h.reachable && (
        <Tooltip label={on ? `Stop folding on ${h.label}` : `Fold on ${h.label}`}>
          <NeonButton strong={on} disabled={!!busy} onClick={() => void act(h.id, on ? "stop" : "start")}>
            {busy ? "…" : label}
          </NeonButton>
        </Tooltip>
      )}
    </Bar>
  );
}

const Bar = styled.div`
  display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
  font-size: 0.72rem; color: var(--t-textMuted);
  padding: 0.5rem 1rem 0.75rem;
`;
const Dot = styled.span<{ $c: string }>`
  width: 0.5rem; height: 0.5rem; border-radius: 999px; background: ${(p) => p.$c}; flex: none;
`;
const Spacer = styled.span`flex: 1 1 auto;`;
