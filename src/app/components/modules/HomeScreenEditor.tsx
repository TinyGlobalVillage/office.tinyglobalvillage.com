// HomeScreenEditor — Modules → Home Screen (Gio 2026-11-24). Split screen: every mode and control on the left, the
// living sun live on the right, exactly as the apps draw it (the shared engine,
// @tgv/module-component-library/components/home-sun). Every change saves a moment later to the shared table
// (Office /api/home-sun → home_sun_settings), and the desktop and phone apps' Home screens follow it in real time
// (tinyglobalvillage.com /api/app/home-sun). Offline devices keep the last look they saw; Office (desktop/web)
// edits always win over phone edits when devices reconnect.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import ADDM from "@tgv/module-component-library/components/ui/ADDM";
import SRT from "@tgv/module-component-library/components/ui/SRT";
import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import Lightswitch from "@tgv/module-component-library/components/ui/Lightswitch";
import {
  createHomeSun,
  DARK_MOTIONS,
  formatSlider,
  HOME_SUN_CONTROLS,
  HOME_SUN_DEFAULTS,
  HOME_SUN_GROUPS,
  HOME_SUN_MODES,
  HOME_SUN_SWITCHES,
  normalizeHomeSun,
  type HomeSun,
  type HomeSunSettings,
} from "@tgv/module-component-library/components/home-sun";

const Split = styled.div`
  display: grid;
  grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
  gap: 18px;
  height: calc(100vh - 170px);
  min-height: 520px;
  @media (max-width: 860px) {
    grid-template-columns: 1fr;
    height: auto;
  }
`;
const Side = styled.div`
  overflow-y: auto;
  display: grid;
  align-content: start;
  /* every section keeps its full height and the panel scrolls (a fixed-height grid squeezes overflow:hidden rows) */
  grid-auto-rows: max-content;
  gap: 10px;
  min-height: 0;
  padding-right: 6px;
  min-width: 0;
`;
const Status = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  font-size: 12.5px;
  opacity: 0.8;
`;
const Btn = styled.button`
  font: inherit;
  font-size: 12.5px;
  color: inherit;
  background: transparent;
  border: 1px solid rgba(var(--tgv-accent-rgb, 0, 228, 253), 0.4);
  border-radius: 999px;
  padding: 4px 12px;
  cursor: pointer;
`;
const Modes = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
`;
const ModeBtn = styled.button<{ $on: boolean }>`
  font: inherit;
  text-align: left;
  color: inherit;
  cursor: pointer;
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 10px;
  background: ${(p) => (p.$on ? "rgba(var(--tgv-accent-rgb, 0, 228, 253), 0.14)" : "transparent")};
  border: 1px solid rgba(var(--tgv-accent-rgb, 0, 228, 253), ${(p) => (p.$on ? 0.6 : 0.2)});
  b {
    font-size: 13px;
  }
  span {
    font-size: 11.5px;
    opacity: 0.65;
  }
`;
const Row = styled.label`
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 52px;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  output {
    text-align: right;
    font-variant-numeric: tabular-nums;
    opacity: 0.85;
  }
`;
const Note = styled.p`
  margin: 0 0 4px;
  font-size: 12px;
  opacity: 0.65;
`;
const Stage = styled.div`
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(var(--tgv-accent-rgb, 0, 228, 253), 0.25);
  min-height: 420px;
`;
const StageCap = styled.div`
  position: absolute;
  left: 14px;
  bottom: 12px;
  font-size: 12px;
  opacity: 0.7;
  pointer-events: none;
  z-index: 2;
`;

type Saved = { version: number; updatedAt: string | null };

export default function HomeScreenEditor() {
  const [s, setS] = useState<HomeSunSettings>(HOME_SUN_DEFAULTS);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [status, setStatus] = useState("Loading…");
  const [open, setOpen] = useState<Record<string, boolean>>({ "3d": true, flare: true, circuit: true, energy: true });
  const stageRef = useRef<HTMLDivElement>(null);
  const sunRef = useRef<HomeSun | null>(null);
  const timer = useRef<number | null>(null);
  const loaded = useRef(false);

  // the live preview: the same engine the apps run
  useEffect(() => {
    if (!stageRef.current) return;
    const sun = createHomeSun({ host: stageRef.current, layout: "element", markUrl: "/brand/tgv-mark.png", settings: HOME_SUN_DEFAULTS, interactive: true });
    sunRef.current = sun;
    return () => {
      sun.destroy();
      sunRef.current = null;
    };
  }, []);
  useEffect(() => {
    sunRef.current?.set(s);
  }, [s]);

  useEffect(() => {
    fetch("/api/home-sun", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { settings: HomeSunSettings; version: number; updatedAt: string | null }) => {
        setS(normalizeHomeSun(d.settings));
        setSaved({ version: d.version, updatedAt: d.updatedAt });
        setStatus("Live on Home");
        loaded.current = true;
      })
      .catch(() => setStatus("Couldn't load the current look."));
  }, []);

  const save = useCallback(async (next: HomeSunSettings) => {
    setStatus("Saving…");
    const r = await fetch("/api/home-sun", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings: next }) }).catch(() => null);
    if (r?.ok) {
      const d = (await r.json()) as { version: number; updatedAt: string };
      setSaved({ version: d.version, updatedAt: d.updatedAt });
      setStatus("Live on Home");
    } else setStatus(r?.status === 403 ? "Only Office admins can change the Home screen." : "Couldn't save. Your change shows here; try again.");
  }, []);

  // every change goes live a moment after you stop moving the control
  const change = useCallback(
    (patch: Partial<HomeSunSettings>) => {
      setS((cur) => {
        const next = normalizeHomeSun({ ...cur, ...patch });
        if (loaded.current) {
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => void save(next), 350);
        }
        return next;
      });
    },
    [save],
  );

  const mode = HOME_SUN_MODES.find((m) => m.key === s.mode)!;

  return (
    <Split>
      <Side>
        <Status role="status">
          <span>
            {status}
            {saved ? ` · version ${saved.version}` : ""}
          </span>
          <Btn type="button" onClick={() => change({ ...HOME_SUN_DEFAULTS, mode: s.mode })}>
            Reset controls
          </Btn>
        </Status>

        {HOME_SUN_GROUPS.map((g) => (
          <ADDM
            key={g.key}
            label={g.label}
            count={HOME_SUN_MODES.filter((m) => m.group === g.key).length}
            accent="gold"
            contained
            open={!!open[g.key]}
            onOpenChange={(o) => setOpen((x) => ({ ...x, [g.key]: o }))}
          >
            <Modes>
              {HOME_SUN_MODES.filter((m) => m.group === g.key).map((m) => (
                <ModeBtn key={m.key} type="button" $on={m.key === s.mode} aria-pressed={m.key === s.mode} onClick={() => change({ mode: m.key })}>
                  <b>{m.name}</b>
                  <span>{m.note}</span>
                </ModeBtn>
              ))}
            </Modes>
          </ADDM>
        ))}

        <ADDM label="Energy" accent="cyan" contained open={!!open.energy} onOpenChange={(o) => setOpen((x) => ({ ...x, energy: o }))}>
          {HOME_SUN_SWITCHES.map((w) => (
            <Row as="div" key={w.key}>
              <span>{w.label}</span>
              <Note style={{ margin: 0 }}>{w.note}</Note>
              <Lightswitch on={s[w.key]} onChange={(v: boolean) => change({ [w.key]: v } as Partial<HomeSunSettings>)} ariaLabel={w.label} title={w.label} />
            </Row>
          ))}
        </ADDM>

        {HOME_SUN_CONTROLS.map((c) => (
          <ADDM key={c.key} label={c.label} accent="cyan" contained open={!!open[c.key]} onOpenChange={(o) => setOpen((x) => ({ ...x, [c.key]: o }))}>
            {c.note && <Note>{c.note}</Note>}
            {c.key === "dark" && (
              <Row as="div">
                <span>Motion</span>
                <PillBar
                  kind="choice"
                  dense
                  stack={false}
                  ariaLabel="Darkness motion"
                  segments={DARK_MOTIONS.map((d) => ({ key: d.key, label: d.label }))}
                  active={mode.dark ?? s.dmode}
                  onChange={(k: string) => change({ dmode: k as HomeSunSettings["dmode"] })}
                />
                <span />
              </Row>
            )}
            {c.sliders.map((d) => (
              <Row key={d.key}>
                <span>{d.label}</span>
                <SRT
                  value={s[d.key] as number}
                  min={d.min}
                  max={d.max}
                  step={d.step}
                  resetValue={HOME_SUN_DEFAULTS[d.key] as number}
                  ariaLabel={`${c.label} ${d.label}`}
                  onChange={(v: number) => change({ [d.key]: v } as Partial<HomeSunSettings>)}
                />
                <output>{formatSlider(d, s[d.key] as number)}</output>
              </Row>
            ))}
          </ADDM>
        ))}
      </Side>
      <Stage ref={stageRef}>
        <StageCap>
          {mode.name}
          {mode.m ? " · drag the sun to turn it" : ""}
        </StageCap>
      </Stage>
    </Split>
  );
}
