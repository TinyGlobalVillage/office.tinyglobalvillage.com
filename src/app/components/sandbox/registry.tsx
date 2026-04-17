"use client";

import { useState, useEffect } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";

const PINK = colors.pink;
const PINK_RGB = rgb.pink;
const MUTED = "rgba(255,255,255,0.18)";
const MUTED_TEXT = "rgba(255,255,255,0.35)";

export type SandboxEntry = {
  key: string;
  name: string;
  category: "Navigation" | "Toggles" | "Menus" | "Editor Controls";
  summary: string;
  usage: string;
  code: string;
  style?: string;
  stylePath?: string;
  Demo: React.FC;
};

// ── Reusable highlighter ────────────────────────────────────────────────

const HighlightWrap = styled.div`
  position: relative;
  display: inline-flex;
  padding: 8px;
  border-radius: 12px;
  border: 1px dashed rgba(${PINK_RGB}, 0.55);
  box-shadow: 0 0 22px rgba(${PINK_RGB}, 0.28),
    inset 0 0 12px rgba(${PINK_RGB}, 0.08);
  background: rgba(${PINK_RGB}, 0.04);

  [data-theme="light"] & {
    border-color: rgba(${PINK_RGB}, 0.35);
    box-shadow: 0 0 12px rgba(${PINK_RGB}, 0.1);
    background: rgba(${PINK_RGB}, 0.02);
  }
`;

const HighlightLabel = styled.span`
  position: absolute;
  top: -9px;
  left: 10px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 1px 6px;
  background: rgba(6, 8, 12, 1);
  color: ${PINK};
  border: 1px solid rgba(${PINK_RGB}, 0.5);
  border-radius: 4px;

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: rgba(${PINK_RGB}, 0.3);
  }
`;

function Highlight({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <HighlightWrap>
      {label && <HighlightLabel>{label}</HighlightLabel>}
      {children}
    </HighlightWrap>
  );
}

// ── Demo styled helpers ─────────────────────────────────────────────────

const DemoCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
`;

const DemoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
`;

const MutedRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid ${MUTED};
`;

const MutedLabel = styled.span`
  font-size: 0.75rem;
  color: ${MUTED_TEXT};
`;

const MutedNote = styled.span`
  font-size: 0.625rem;
  color: ${MUTED_TEXT};
`;

// ── GPG demo ────────────────────────────────────────────────────────────
function useGPGColumns() {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 600) setCols(1);
      else if (w < 900) setCols(2);
      else if (w < 1200) setCols(3);
      else setCols(5);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return cols;
}

function GPGDemo() {
  const total = 12;
  const cols = useGPGColumns();
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [cols]);

  const pageSize = cols;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const items = Array.from({ length: pageSize }, (_, i) => start + i).filter((n) => n < total);
  const showPager = total > pageSize;

  return (
    <DemoCol>
      <Highlight label={`GPG · ${cols}-col`}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: 8,
            minWidth: 240,
            width: "100%",
          }}
        >
          {items.map((i) => (
            <div
              key={i}
              style={{
                aspectRatio: "1",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${MUTED}`,
              }}
            >
              <span style={{ fontSize: 10, fontFamily: "var(--font-geist-mono), monospace", color: MUTED_TEXT }}>{i + 1}</span>
            </div>
          ))}
        </div>
      </Highlight>

      {showPager ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            style={{
              width: 28, height: 28, borderRadius: 999,
              border: `1px solid rgba(${PINK_RGB},0.5)`,
              background: `rgba(${PINK_RGB},0.12)`,
              color: PINK, fontSize: 14, fontWeight: 700,
              cursor: safePage === 0 ? "not-allowed" : "pointer",
              opacity: safePage === 0 ? 0.4 : 1,
            }}
          >‹</button>
          <span style={{ color: PINK, fontSize: 12, fontWeight: 700 }}>{safePage + 1} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage === totalPages - 1}
            style={{
              width: 28, height: 28, borderRadius: 999,
              border: `1px solid rgba(${PINK_RGB},0.5)`,
              background: `rgba(${PINK_RGB},0.12)`,
              color: PINK, fontSize: 14, fontWeight: 700,
              cursor: safePage === totalPages - 1 ? "not-allowed" : "pointer",
              opacity: safePage === totalPages - 1 ? 0.4 : 1,
            }}
          >›</button>
        </div>
      ) : (
        <MutedNote>(no pager — total ≤ pageSize)</MutedNote>
      )}
    </DemoCol>
  );
}

// ── TPG demo ────────────────────────────────────────────────────────────
function TPGDemo() {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const total = 3;
  return (
    <DemoCol style={{ gap: "1rem" }}>
      <div style={{ width: "100%", borderRadius: 12, overflow: "hidden", border: `1px solid ${MUTED}` }}>
        {["Row A", "Row B", "Row C", "Row D"].map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.5rem 1rem", borderBottom: i < 3 ? `1px solid ${MUTED}` : "none", background: i % 2 ? "rgba(255,255,255,0.02)" : "transparent" }}>
            <span style={{ fontSize: 11, fontFamily: "var(--font-geist-mono), monospace", color: MUTED_TEXT }}>{r}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>—</span>
          </div>
        ))}
      </div>

      <Highlight label="TPG">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: PINK, fontSize: 11, fontWeight: 600 }}>Page {page} of {total} · 24 results</span>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => setSize(10)}
            style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid rgba(${PINK_RGB},0.5)`, background: `rgba(${PINK_RGB},0.12)`, color: PINK, fontSize: 11 }}
            title="Reset"
          >↺</button>
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid rgba(${PINK_RGB},0.5)`, background: "rgba(6,8,12,0.9)", color: PINK, fontSize: 11 }}
          >
            {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid rgba(${PINK_RGB},0.5)`, background: `rgba(${PINK_RGB},0.12)`, color: PINK, fontSize: 12, opacity: page === 1 ? 0.4 : 1 }}
          >‹</button>
          <button
            onClick={() => setPage((p) => Math.min(total, p + 1))}
            disabled={page === total}
            style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid rgba(${PINK_RGB},0.5)`, background: `rgba(${PINK_RGB},0.12)`, color: PINK, fontSize: 12, opacity: page === total ? 0.4 : 1 }}
          >›</button>
        </div>
      </Highlight>
    </DemoCol>
  );
}

// ── ACR demo ────────────────────────────────────────────────────────────
function ACRDemo() {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 600) setCols(1);
      else if (w < 900) setCols(2);
      else if (w < 1200) setCols(3);
      else setCols(5);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <Highlight label="ACR">
      <DemoCol style={{ gap: "0.75rem" }}>
        <span style={{ fontSize: 10, fontFamily: "var(--font-geist-mono), monospace", color: PINK }}>
          viewport → <b>{cols === 1 ? "GPG (mobile)" : `TPG ${cols}-col`}</b>
        </span>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: `repeat(${cols}, 1fr)`, width: 320 }}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} style={{ aspectRatio: "1", borderRadius: 4, background: "rgba(255,255,255,0.06)", border: `1px solid ${MUTED}` }} />
          ))}
        </div>
        <MutedNote>Resize the window — cols switch at 600/900/1200.</MutedNote>
      </DemoCol>
    </Highlight>
  );
}

// ── Lightswitch demo ────────────────────────────────────────────────────
function LightswitchSwitch({ on, onChange, highlighted }: { on: boolean; onChange: (v: boolean) => void; highlighted?: boolean }) {
  const color = highlighted ? PINK : "rgba(255,255,255,0.4)";
  const rgbVal = highlighted ? PINK_RGB : "255,255,255";
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        position: "relative", width: 44, height: 18, borderRadius: 999,
        border: `1px solid ${on ? `rgba(${rgbVal},0.7)` : "rgba(255,255,255,0.15)"}`,
        background: on ? `rgba(${rgbVal},0.18)` : "rgba(255,255,255,0.04)",
        boxShadow: on && highlighted ? `0 0 12px rgba(${rgbVal},0.5)` : "none",
        transition: "all 0.2s",
      }}
    >
      <span
        style={{
          position: "absolute", top: 1, left: on ? 26 : 2,
          width: 14, height: 14, borderRadius: "50%",
          background: on ? color : "rgba(255,255,255,0.3)",
          boxShadow: on && highlighted ? `0 0 10px rgba(${rgbVal},0.8), 0 0 2px rgba(${rgbVal},1)` : "0 1px 2px rgba(0,0,0,0.3)",
          transition: "all 0.2s",
        }}
      />
    </button>
  );
}

function LightswitchDemo() {
  const [a, setA] = useState(false);
  const [b, setB] = useState(true);
  const [c, setC] = useState(true);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 448 }}>
      {[
        { label: "Notifications", state: a, set: setA },
        { label: "Sound effects",  state: b, set: setB },
      ].map((r, i) => (
        <MutedRow key={i}>
          <MutedLabel>{r.label}</MutedLabel>
          <LightswitchSwitch on={r.state} onChange={r.set} highlighted={false} />
        </MutedRow>
      ))}
      <Highlight label="Lightswitch">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 1rem", borderRadius: 8, width: "100%", minWidth: 280 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>Expand section</span>
          <LightswitchSwitch on={c} onChange={setC} highlighted />
        </div>
      </Highlight>
    </div>
  );
}

// ── ECL demo ────────────────────────────────────────────────────────────
function ECLDemo() {
  const [expanded, setExpanded] = useState(true);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 448 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.5rem 0.75rem", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${MUTED}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED_TEXT }}>Zoom</span>
        <div style={{ flex: 1, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
          <div style={{ height: "100%", borderRadius: 999, width: expanded ? "55%" : "0%", background: "rgba(0,191,255,0.4)" }} />
        </div>
        {expanded && (
          <>
            <button style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid rgba(0,228,253,0.25)", background: "rgba(0,228,253,0.08)", color: "rgba(0,228,253,0.8)", fontSize: 11 }}>↺</button>
            <input defaultValue="1.0" style={{ width: 40, textAlign: "center", borderRadius: 4, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 11, padding: "2px 4px" }} />
          </>
        )}
        <Highlight label="ECL">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: PINK }}>{expanded ? "Collapse" : "Expand"}</span>
            <LightswitchSwitch on={expanded} onChange={setExpanded} highlighted />
          </div>
        </Highlight>
      </div>
      <MutedNote>Toggling ECL hides only the controls (↺ + input), not the row or label.</MutedNote>
    </div>
  );
}

// ── Eye Icon demo ───────────────────────────────────────────────────────
function EyeBtn({ visible, onChange, highlighted }: { visible: boolean; onChange: (v: boolean) => void; highlighted?: boolean }) {
  const color = highlighted ? PINK : "rgba(0,228,253,0.6)";
  const rgbVal = highlighted ? PINK_RGB : "0,228,253";
  return (
    <button
      onClick={() => onChange(!visible)}
      style={{
        width: 22, height: 22, borderRadius: 4,
        border: `1px solid rgba(${rgbVal},${visible ? 0.5 : 0.2})`,
        background: `rgba(${rgbVal},${visible ? 0.15 : 0.04})`,
        color: visible ? color : "rgba(255,255,255,0.3)",
        boxShadow: visible && highlighted ? `0 0 10px rgba(${rgbVal},0.5)` : "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12,
      }}
    >{visible ? "👁" : "⊘"}</button>
  );
}

function EyeIconDemo() {
  const [show1, setShow1] = useState(true);
  const [show2, setShow2] = useState(false);
  const [show3, setShow3] = useState(true);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 448 }}>
      {[
        { label: "Header block", state: show1, set: setShow1 },
        { label: "Sidebar widget", state: show2, set: setShow2 },
      ].map((r, i) => (
        <MutedRow key={i}>
          <MutedLabel>{r.label}</MutedLabel>
          <EyeBtn visible={r.state} onChange={r.set} />
        </MutedRow>
      ))}
      <MutedRow>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>Footer section</span>
        <Highlight label="EYE">
          <EyeBtn visible={show3} onChange={setShow3} highlighted />
        </Highlight>
      </MutedRow>
    </div>
  );
}

// ── QMBM demo ───────────────────────────────────────────────────────────
function QMBMBubble({ highlighted, onClick }: { highlighted?: boolean; onClick: () => void }) {
  const color = highlighted ? PINK : "rgba(247,183,0,0.6)";
  const rgbVal = highlighted ? PINK_RGB : "247,183,0";
  return (
    <button
      onClick={onClick}
      style={{
        width: 16, height: 16, borderRadius: "50%",
        border: `1px solid rgba(${rgbVal},0.6)`,
        background: `rgba(${rgbVal},0.15)`,
        color, fontSize: 10, fontWeight: 700, lineHeight: 1,
        boxShadow: highlighted ? `0 0 8px rgba(${rgbVal},0.5)` : "none",
      }}
    >?</button>
  );
}

function QMBMDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 448, minHeight: 200 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ fontSize: 12, color: MUTED_TEXT }}>API Key</label>
        <QMBMBubble onClick={() => {}} />
      </div>
      <input style={{ width: "100%", padding: "6px 12px", borderRadius: 4, fontSize: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${MUTED}`, color: MUTED_TEXT }} placeholder="sk-…" readOnly />
      <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
        <label style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>Webhook secret</label>
        <Highlight label="QMBM">
          <QMBMBubble highlighted onClick={() => setOpen((v) => !v)} />
        </Highlight>
        {open && (
          <div
            style={{
              position: "absolute", top: 26, left: 0, zIndex: 10,
              width: 260, padding: 12, borderRadius: 10,
              background: "rgba(6,8,12,0.98)",
              border: `1px solid rgba(${PINK_RGB},0.45)`,
              boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 16px rgba(${PINK_RGB},0.2)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: PINK }}>Webhook secret</span>
              <button onClick={() => setOpen(false)} style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ fontSize: 11, lineHeight: 1.6, color: "rgba(255,255,255,0.6)", margin: 0 }}>
              Used to sign outbound webhook payloads. Rotate quarterly. Clients verify via HMAC-SHA256.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DDM demo ────────────────────────────────────────────────────────────
function DDMDemo() {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("Markdown");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 448, minHeight: 200 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ fontSize: 12, color: MUTED_TEXT }}>Theme</label>
        <button style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, background: "rgba(255,255,255,0.04)", border: `1px solid ${MUTED}`, color: MUTED_TEXT }}>Dark ▾</button>
      </div>
      <div style={{ position: "relative" }}>
        <Highlight label="DDM">
          <button
            onClick={() => setOpen((v) => !v)}
            style={{ padding: "6px 16px", borderRadius: 999, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, background: `rgba(${PINK_RGB},0.14)`, border: `1px solid rgba(${PINK_RGB},0.5)`, color: PINK }}
          >
            Save as: {val}
            <span style={{ fontSize: 8 }}>▼</span>
          </button>
        </Highlight>
        {open && (
          <div
            style={{
              position: "absolute", top: 52, left: 8, zIndex: 10, width: 180,
              padding: 4, borderRadius: 10,
              background: "rgba(6,8,12,0.98)",
              border: `1px solid rgba(${PINK_RGB},0.45)`,
              boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 16px rgba(${PINK_RGB},0.2)`,
            }}
          >
            {["Markdown", "JSON", "HTML", "Plain text"].map((opt) => (
              <button
                key={opt}
                onClick={() => { setVal(opt); setOpen(false); }}
                style={{ width: "100%", textAlign: "left", padding: "6px 12px", borderRadius: 4, fontSize: 11, color: val === opt ? PINK : "rgba(255,255,255,0.7)", background: val === opt ? `rgba(${PINK_RGB},0.1)` : "transparent", border: "none", cursor: "pointer" }}
              >{opt}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SRT demo ────────────────────────────────────────────────────────────
function SRTDemo() {
  const [v, setV] = useState(1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 448 }}>
      <Highlight label="SRT">
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.5rem 0.75rem", width: "100%", minWidth: 360 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", width: 56, color: PINK }}>Zoom</span>
          <input
            type="range" min={0.5} max={2} step={0.05} value={v}
            onChange={(e) => setV(Number(e.target.value))}
            style={{ flex: 1, accentColor: PINK }}
          />
          <button onClick={() => setV(1)} style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid rgba(${PINK_RGB},0.5)`, background: `rgba(${PINK_RGB},0.15)`, color: PINK, fontSize: 11 }}>↺</button>
          <input
            value={v.toFixed(2)}
            onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) setV(n); }}
            style={{ width: 48, textAlign: "center", borderRadius: 4, fontSize: 12, padding: "2px 4px", background: "rgba(255,255,255,0.05)", border: `1px solid rgba(${PINK_RGB},0.35)`, color: PINK, fontVariantNumeric: "tabular-nums" }}
          />
          <LightswitchSwitch on={true} onChange={() => {}} highlighted={false} />
        </div>
      </Highlight>
      {["X-Axis", "Y-Axis"].map((lbl) => (
        <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.5rem 0.75rem", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${MUTED}` }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", width: 56, color: MUTED_TEXT }}>{lbl}</span>
          <div style={{ flex: 1, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
            <div style={{ height: "100%", borderRadius: 999, width: "50%", background: "rgba(255,255,255,0.15)" }} />
          </div>
          <span style={{ fontSize: 10, color: MUTED_TEXT }}>0.00</span>
        </div>
      ))}
    </div>
  );
}

// ── Reset Button demo ───────────────────────────────────────────────────
function ResetBtnDemo() {
  const [v, setV] = useState(1.35);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 448 }}>
      {[
        { label: "X-Axis" },
        { label: "Y-Axis" },
      ].map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.5rem 0.75rem", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${MUTED}` }}>
          <span style={{ fontSize: 11, width: 56, color: MUTED_TEXT }}>{r.label}</span>
          <div style={{ flex: 1, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
            <div style={{ height: "100%", borderRadius: 999, width: "50%", background: "rgba(255,255,255,0.15)" }} />
          </div>
          <button style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid rgba(0,228,253,0.2)", background: "rgba(0,228,253,0.05)", color: "rgba(0,228,253,0.4)", fontSize: 10 }}>↺</button>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.5rem 0.75rem", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${MUTED}` }}>
        <span style={{ fontSize: 11, width: 56, color: "rgba(255,255,255,0.85)" }}>Zoom</span>
        <div style={{ flex: 1, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
          <div style={{ height: "100%", borderRadius: 999, width: `${(v / 2) * 100}%`, background: "rgba(0,191,255,0.4)" }} />
        </div>
        <Highlight label="RESET">
          <button
            onClick={() => setV(1)}
            style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid rgba(${PINK_RGB},0.5)`, background: `rgba(${PINK_RGB},0.15)`, color: PINK, fontSize: 12, fontWeight: 700 }}
          >↺</button>
        </Highlight>
        <span style={{ fontSize: 10, fontFamily: "var(--font-geist-mono), monospace", color: "rgba(255,255,255,0.5)" }}>{v.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ── TSG demo ────────────────────────────────────────────────────────────
function TSGDemo() {
  const [icons, setIcons] = useState(false);
  const [all, setAll] = useState(true);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 512 }}>
      <Highlight label="TSG">
        <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "0.5rem 1rem", borderRadius: 8, width: "100%", minWidth: 360, background: `rgba(${PINK_RGB},0.04)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: PINK }}>Labels</span>
            <LightswitchSwitch on={icons} onChange={setIcons} highlighted />
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: icons ? PINK : MUTED_TEXT }}>Icons</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: PINK }}>{all ? "Collapse all" : "Expand all"}</span>
            <LightswitchSwitch on={all} onChange={setAll} highlighted />
          </div>
        </div>
      </Highlight>
      {["Sessions", "Members", "Payouts"].map((s) => (
        <MutedRow key={s}>
          <MutedLabel>{s}</MutedLabel>
          <LightswitchSwitch on={all} onChange={() => {}} highlighted={false} />
        </MutedRow>
      ))}
    </div>
  );
}

// ── SBDM demo ───────────────────────────────────────────────────────────
const SBDM_OPTIONS = [
  "Argentina", "Australia", "Brazil", "Canada", "Chile", "Denmark",
  "Egypt", "France", "Germany", "Greece", "India", "Italy",
  "Japan", "Kenya", "Mexico", "Norway", "Poland", "Portugal",
  "Spain", "Sweden", "Thailand", "Turkey",
];

function SBDMDemo() {
  const [outer, setOuter] = useState("");
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState("");
  const [asc, setAsc] = useState(true);

  const filtered = SBDM_OPTIONS
    .filter((o) => o.toLowerCase().includes((open ? inner : outer).toLowerCase()))
    .sort((a, b) => (asc ? a.localeCompare(b) : b.localeCompare(a)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 448, minHeight: 360 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED_TEXT }}>Email</label>
        <input style={{ width: "100%", padding: "6px 12px", borderRadius: 4, fontSize: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${MUTED}`, color: MUTED_TEXT }} placeholder="user@example.com" readOnly />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED_TEXT }}>Tag</label>
        <input style={{ width: "100%", padding: "6px 12px", borderRadius: 4, fontSize: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${MUTED}`, color: MUTED_TEXT }} placeholder="optional" readOnly />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, position: "relative" }}>
        <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: PINK }}>Country</label>
        <Highlight label="SBDM">
          <div style={{ display: "flex", alignItems: "center", width: "100%", minWidth: 320, position: "relative" }}>
            <span style={{ position: "absolute", left: 10, color: `rgba(${PINK_RGB},0.7)`, fontSize: 12, pointerEvents: "none" }}>🔍</span>
            <input
              value={outer}
              onChange={(e) => setOuter(e.target.value)}
              placeholder="Search countries…"
              style={{
                flex: 1, paddingLeft: 32, paddingRight: 40, padding: "6px 40px 6px 32px", borderRadius: 8, outline: "none", fontSize: 12,
                background: `rgba(${PINK_RGB},0.06)`,
                border: `1px solid rgba(${PINK_RGB},0.5)`,
                color: PINK,
              }}
            />
            <button
              onClick={() => setOpen((v) => !v)}
              style={{
                position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                width: 26, height: 26, borderRadius: 6,
                background: open ? `rgba(${PINK_RGB},0.25)` : `rgba(${PINK_RGB},0.12)`,
                border: `1px solid rgba(${PINK_RGB},0.5)`,
                color: PINK, fontSize: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              title={open ? "Close" : "Browse all"}
            >▾</button>
          </div>
        </Highlight>

        {open && (
          <div
            style={{
              position: "absolute", top: 80, left: 0, right: 0, zIndex: 20,
              maxHeight: 240, padding: 6,
              background: "rgba(6,8,12,0.99)",
              border: `1px solid rgba(${PINK_RGB},0.45)`,
              borderRadius: 10,
              boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 18px rgba(${PINK_RGB},0.2)`,
              display: "flex", flexDirection: "column", gap: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px" }}>
              <input
                value={inner}
                onChange={(e) => setInner(e.target.value)}
                placeholder="Search inside…"
                autoFocus
                style={{ flex: 1, padding: "4px 8px", borderRadius: 4, fontSize: 11, outline: "none", background: "rgba(255,255,255,0.04)", border: `1px solid rgba(${PINK_RGB},0.3)`, color: "rgba(255,255,255,0.85)" }}
              />
              <button
                onClick={() => setAsc((v) => !v)}
                style={{ padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", background: `rgba(${PINK_RGB},0.14)`, border: `1px solid rgba(${PINK_RGB},0.5)`, color: PINK, whiteSpace: "nowrap" }}
                title="Toggle sort order"
              >
                {asc ? "Z-A" : "A-Z"} ↕
              </button>
            </div>
            <div style={{ overflowY: "auto", maxHeight: 180, scrollbarWidth: "thin" as const }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "16px 12px", textAlign: "center", fontSize: 10, color: MUTED_TEXT }}>No matches.</div>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o}
                    onClick={() => { setOuter(o); setOpen(false); setInner(""); }}
                    style={{ width: "100%", textAlign: "left", padding: "4px 12px", borderRadius: 4, fontSize: 11, color: outer === o ? PINK : "rgba(255,255,255,0.7)", background: outer === o ? `rgba(${PINK_RGB},0.1)` : "transparent", border: "none", cursor: "pointer" }}
                  >{o}</button>
                ))
              )}
            </div>
            <div style={{ padding: "4px 8px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED_TEXT, borderTop: `1px solid rgba(${PINK_RGB},0.15)` }}>
              {filtered.length} of {SBDM_OPTIONS.length} · sorted {asc ? "A → Z" : "Z → A"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── LDM demo ────────────────────────────────────────────────────
function LDMDemo() {
  const [dark, setDark] = useState(true);
  const [alert, setAlert] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div
        style={{
          padding: 24, borderRadius: 16,
          background: dark ? "rgba(10,10,10,0.95)" : "rgba(248,246,243,0.95)",
          border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
          transition: "all 0.3s",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        }}
      >
        <span style={{ fontSize: 10, color: dark ? MUTED_TEXT : "rgba(0,0,0,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700 }}>
          {dark ? "Dark Mode" : "Light Mode"}
        </span>
        <Highlight label="LDM">
          <button
            onClick={() => { if (dark) setAlert(true); else setDark(true); }}
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
              border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 16,
            }}
          >
            {dark ? "\u{1F319}" : "\u{2600}\u{FE0F}"}
          </button>
        </Highlight>
      </div>
      {alert && (
        <div style={{ padding: 16, borderRadius: 12, background: `rgba(${PINK_RGB},0.04)`, border: `1px solid rgba(${PINK_RGB},0.2)`, textAlign: "center", maxWidth: 220 }}>
          <div style={{ fontSize: 10, color: PINK, fontWeight: 700, marginBottom: 8 }}>Dark mode is greener</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              onClick={() => setAlert(false)}
              style={{ fontSize: 9, padding: "4px 10px", borderRadius: 6, background: "linear-gradient(135deg, #ff4ecb, #a855f7)", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer" }}
            >Stay dark</button>
            <button
              onClick={() => { setDark(false); setAlert(false); }}
              style={{ fontSize: 9, padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
            >Switch anyway</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SuggestionBox demo ──────────────────────────────────────────────────
function SuggestionBoxDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 140, height: 100, borderRadius: 16,
          border: open ? `2px dashed ${PINK}` : `2px dashed ${MUTED}`,
          background: "transparent",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "border-color 0.2s",
        }}
      >
        <Highlight label="tile">
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              padding: "6px 16px", borderRadius: 10,
              background: "linear-gradient(135deg, #ff4ecb, #a855f7)",
              color: "#fff", fontSize: 11, fontWeight: 700,
              border: "none", cursor: "pointer",
              boxShadow: `0 4px 16px rgba(${PINK_RGB},0.3)`,
            }}
          >
            {open ? "Close" : "Make a suggestion"}
          </button>
        </Highlight>
      </div>
      {open && (
        <div style={{ width: 220, padding: 16, borderRadius: 12, background: `rgba(${PINK_RGB},0.04)`, border: `1px solid rgba(${PINK_RGB},0.2)` }}>
          <div style={{ fontSize: 10, color: PINK, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
            SuggestionBox Modal
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ height: 6, borderRadius: 3, background: `rgba(${PINK_RGB},0.15)`, width: "80%" }} />
            <div style={{ height: 6, borderRadius: 3, background: `rgba(${rgb.cyan},0.15)`, width: "100%" }} />
            <div style={{ height: 6, borderRadius: 3, background: `rgba(${rgb.cyan},0.1)`, width: "60%" }} />
          </div>
          <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
            <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, background: "linear-gradient(135deg, #ff4ecb, #a855f7)", color: "#fff", fontWeight: 700 }}>
              Send to admin
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Registry ────────────────────────────────────────────────────────────
export const REGISTRY: SandboxEntry[] = [
  {
    key: "GPG",
    name: "Gallery Pagination Group",
    category: "Navigation",
    summary: "Responsive paginated grid: columns scale 1 → 2 → 3 → 5 across the 600/900/1200px breakpoints, page size always equals column count. Pager (28px circle ‹ ›  + `N / M` counter) only renders when `total > pageSize` — small datasets show as a static grid with no pager.",
    usage: "Wrap any repeated-card collection. Use the canonical Tailwind grid `grid-cols-1 min-[600px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-5`. Track current column count via `matchMedia` for slicing. Reset page to 0 when filter or column count changes.",
    code: "// Hook (mirrors refusionist AnnouncementsWidget)\nfunction useGPGColumns() {\n  const [cols, setCols] = useState(3);\n  useEffect(() => {\n    const update = () => {\n      const w = window.innerWidth;\n      if (w < 600) setCols(1);\n      else if (w < 900) setCols(2);\n      else if (w < 1200) setCols(3);\n      else setCols(5);\n    };\n    update();\n    window.addEventListener(\"resize\", update);\n    return () => window.removeEventListener(\"resize\", update);\n  }, []);\n  return cols;\n}\n\n// Render\nconst cols = useGPGColumns();\nconst pageSize = cols;\nconst totalPages = Math.max(1, Math.ceil(items.length / pageSize));\nconst showPager = items.length > pageSize;\nconst visible = items.slice(page * pageSize, (page + 1) * pageSize);\n\n<>\n  <div style={{ display: \"grid\", gridTemplateColumns: \"repeat(auto-fill, minmax(180px, 1fr))\", gap: \"0.75rem\" }}>\n    {visible.map(renderCard)}\n  </div>\n  {showPager && (\n    <PagerRow>\n      <PagerBtn disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</PagerBtn>\n      <PagerInfo>{page + 1} / {totalPages}</PagerInfo>\n      <PagerBtn disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)}>›</PagerBtn>\n    </PagerRow>\n  )}\n</>",
    style: "const TileGrid = styled.section`\ndisplay: grid;\ngrid-template-columns: 1fr;\ngap: 0.75rem;\n\n@media (min-width: 600px) { grid-template-columns: repeat(2, 1fr); }\n@media (min-width: 900px) { grid-template-columns: repeat(3, 1fr); }\n@media (min-width: 1200px) { grid-template-columns: repeat(5, 1fr); }\n`;\n\nconst PagerRow = styled.div`\ndisplay: flex;\nalign-items: center;\njustify-content: center;\ngap: 0.75rem;\nmargin-top: 0.75rem;\n`;\n\nconst PagerBtn = styled.button`\nwidth: 28px; height: 28px;\nborder-radius: 50%;\nborder: 1px solid rgba(${rgb.pink}, 0.3);\nbackground: rgba(${rgb.pink}, 0.06);\ncolor: ${colors.pink};\ncursor: pointer;\n&:disabled { opacity: 0.3; cursor: not-allowed; }\n`;",
    stylePath: "src/app/dashboard/page.tsx",
    Demo: GPGDemo,
  },
  {
    key: "TPG",
    name: "Table Pagination Group",
    category: "Navigation",
    summary: "Full pagination bar: page info (left), controls (right) = reset + page-size selector + prev/next. Used for grid/table views on tablet+. Two modes: standalone (fixed sizes 5/10/25/50) or inside ACR (column-count multiples).",
    usage: "Place below a table/grid. Show reset button only when custom page size is active. `TpgBtn` is 5×10 padding, radius 8. Dropdown options reflect mode.",
    code: `<TpgRow>
  <TpgInfo>Page {page} of {total} · {count} results</TpgInfo>
  <TpgControls>
    {custom && <ResetBtn onClick={resetSize}>↺</ResetBtn>}
    <TpgSelect value={size} onChange={setSize}>
      {sizes.map(n => <option key={n}>{n}</option>)}
    </TpgSelect>
    <TpgBtn onClick={prev} disabled={page === 1}>‹</TpgBtn>
    <TpgBtn onClick={next} disabled={page === total}>›</TpgBtn>
  </TpgControls>
</TpgRow>`,
    stylePath: "src/app/dashboard/page.tsx",
    Demo: TPGDemo,
  },
  {
    key: "ACR",
    name: "Adaptive Collection Renderer",
    category: "Navigation",
    summary: "Orchestrator that switches between GPG (mobile) and TPG (tablet+) based on viewport. Detects columns via `matchMedia` at 600/900/1200px. Default page size = column count so every page fills one row.",
    usage: "Wrap any repeated-card collection. Provide a shared `renderCard()`. ACR picks the view mode, column count, and page size — child GPG/TPG just render from it.",
    code: `<ACR
  items={items}
  renderCard={(item) => <Card {...item} />}
  breakpoints={{ 600: 1, 900: 2, 1200: 3, Infinity: 5 }}
/>`,
    stylePath: "src/app/dashboard/page.tsx",
    Demo: ACRDemo,
  },
  {
    key: "Lightswitch",
    name: "Lightswitch",
    category: "Toggles",
    summary: "The 3D circle-on-a-stick toggle for collapse/expand and on/off semantics. Glows when on, dims when off, greyed when there's no content to toggle. Use for collapse/expand, on/off, mobile-preview switchers, batch-collapse in TSG.",
    usage: "Do NOT use for show/hide visibility — that's the Eye Icon Toggle. Keep the semantic split clean.",
    code: `<Lightswitch
  on={expanded}
  onChange={setExpanded}
  disabled={!hasContent}
/>`,
    style: "const Track = styled.div<{ $on: boolean; $glow: GlowColor }>`\nwidth: 32px; height: 18px;\nborder-radius: 999px;\nbackground: ${(p) => p.$on ? `rgba(${rgb[p.$glow]}, 0.35)` : \"rgba(255,255,255,0.08)\"};\nborder: 1px solid ${(p) => p.$on ? `rgba(${rgb[p.$glow]}, 0.6)` : \"rgba(255,255,255,0.15)\"};\nposition: relative;\ncursor: pointer;\ntransition: all 0.2s;\n`;\n\nconst Thumb = styled.div<{ $on: boolean; $glow: GlowColor }>`\nwidth: 12px; height: 12px;\nborder-radius: 50%;\nposition: absolute;\ntop: 2px;\nleft: ${(p) => p.$on ? \"17px\" : \"2px\"};\nbackground: ${(p) => p.$on ? colors[p.$glow] : \"rgba(255,255,255,0.4)\"};\nbox-shadow: ${(p) => p.$on ? `0 0 8px ${colors[p.$glow]}` : \"none\"};\ntransition: all 0.2s;\n`;",
    stylePath: "src/app/components/LDM.tsx",
    Demo: LightswitchDemo,
  },
  {
    key: "ECL",
    name: "Expand-Collapse Lightswitch",
    category: "Toggles",
    summary: "A single Lightswitch per component that toggles whether the component's interactive controls are visible (off = controls hidden; label, row, and ECL itself stay visible). Side-label reads 'Collapse' when expanded, 'Expand' when collapsed — immediately left of the switch.",
    usage: "Exactly one ECL per component. On an SRT it hides slider+reset+input. Controlled (`expanded` + `onExpandedChange`) or uncontrolled.",
    code: `<Row>
  <Label>{name}</Label>
  {expanded && <Slider {...} />}
  <CollapseLabel>{expanded ? "Collapse" : "Expand"}</CollapseLabel>
  <Lightswitch on={expanded} onChange={setExpanded} />
</Row>`,
    stylePath: "src/app/components/LDM.tsx",
    Demo: ECLDemo,
  },
  {
    key: "EyeIcon",
    name: "Eye Icon Toggle",
    category: "Toggles",
    summary: "22×22 cyan square button with IconEye/IconEyeOff. Toggles whether a component **renders on the page** (show/hide). Replaces the Lightswitch for visibility specifically — Lightswitch is reserved for expand/collapse and on/off state.",
    usage: "Whole eyeball = visible, crossed-out eyeball = hidden. 4px radius, cyan when visible, dim gray when hidden.",
    code: `<EyeBtn visible={visible} onClick={() => setVisible(v => !v)}>
  {visible ? <IconEye /> : <IconEyeOff />}
</EyeBtn>`,
    style: "const EyeBtn = styled.button<{ $visible: boolean }>`\nwidth: 22px; height: 22px;\nborder-radius: 4px;\nborder: 1px solid rgba(${rgb.cyan}, 0.4);\nbackground: ${(p) => p.$visible ? `rgba(${rgb.cyan}, 0.12)` : \"rgba(255,255,255,0.04)\"};\ncolor: ${(p) => p.$visible ? colors.cyan : \"rgba(255,255,255,0.3)\"};\nfont-size: 12px;\ncursor: pointer;\ndisplay: flex;\nalign-items: center;\njustify-content: center;\n`;",
    stylePath: "src/app/components/LDM.tsx",
    Demo: EyeIconDemo,
  },
  {
    key: "QMBM",
    name: "Question-Mark-Bubble Modal",
    category: "Menus",
    summary: "Small `?` bubble that opens an info card with title + body. Use instead of hover-tooltips when the explanation is longer than a sentence or needs to be touch-friendly. Portaled to body so ancestor overflow/z-index doesn't clip it.",
    usage: "Click toggles, Escape closes, × closes, outside-click closes. Themes: neutral/cyan/lavender. Placements: modal (backdrop) or popover (inside an open modal).",
    code: `<QMBM
  theme="cyan"
  placement="popover"
  title="Webhook secret"
  body="Used to sign outbound payloads…"
/>`,
    style: "const Bubble = styled.button`\nwidth: 20px; height: 20px;\nborder-radius: 50%;\nborder: 1px solid rgba(${rgb.pink}, 0.4);\nbackground: rgba(${rgb.pink}, 0.08);\ncolor: ${colors.pink};\nfont-size: 10px;\nfont-weight: 700;\ncursor: pointer;\ndisplay: flex;\nalign-items: center;\njustify-content: center;\n`;\n\nconst InfoCard = styled.div`\nposition: fixed;\nz-index: 9999;\nwidth: 280px;\nborder-radius: 0.75rem;\npadding: 1rem;\nbackground: rgba(8, 10, 16, 0.98);\nborder: 1px solid rgba(${rgb.pink}, 0.3);\nbox-shadow: 0 12px 40px rgba(0,0,0,0.6);\n`;",
    stylePath: "src/app/components/sandbox/SandboxModal.tsx",
    Demo: QMBMDemo,
  },
  {
    key: "DDM",
    name: "Dropdown Menu",
    category: "Menus",
    summary: "Rounded-pill dropdown. Two variants: simple (whole trigger toggles) and split-pill (left half = default action, right half = triangle that opens menu, divided by 1.5px border). Mystic-purple gradient on hover, filled triangle arrow, fade+slide-down menu entry.",
    usage: "Escape closes before any parent modal's Escape. Outside-click closes. Action pairs use `min-width: 140px` to stay visually matched.",
    code: `<DDMWrapper>
  <DDMTrigger onClick={toggle}>
    {value} <Triangle />
  </DDMTrigger>
  {open && (
    <DDMMenu>
      {options.map(o => <DDMItem onClick={() => pick(o)}>{o}</DDMItem>)}
    </DDMMenu>
  )}
</DDMWrapper>`,
    style: "const DDMTrigger = styled.button`\ndisplay: flex;\nalign-items: center;\ngap: 0.5rem;\npadding: 0.375rem 0.75rem;\nborder-radius: 999px;\nfont-size: 0.6875rem;\nfont-weight: 700;\ntext-transform: uppercase;\nletter-spacing: 0.1em;\nborder: 1px solid rgba(${rgb.pink}, 0.3);\nbackground: rgba(${rgb.pink}, 0.06);\ncolor: ${colors.pink};\ncursor: pointer;\n`;\n\nconst DDMMenu = styled.div`\nposition: absolute;\ntop: 100%;\nright: 0;\nmargin-top: 0.5rem;\nborder-radius: 0.75rem;\nmin-width: 180px;\nbackground: rgba(8, 10, 16, 0.98);\nborder: 1px solid rgba(${rgb.pink}, 0.25);\nbox-shadow: 0 12px 40px rgba(0,0,0,0.7);\nz-index: 80;\noverflow: hidden;\n`;\n\nconst DDMItem = styled.button`\nwidth: 100%;\ntext-align: left;\npadding: 0.5rem 1rem;\nfont-size: 0.6875rem;\nbackground: none;\nborder: none;\ncolor: var(--t-textMuted);\ncursor: pointer;\n&:hover { background: var(--t-inputBg); }\n`;",
    stylePath: "src/app/components/TopNav.tsx",
    Demo: DDMDemo,
  },
  {
    key: "SBDM",
    name: "Search Bar Dropdown Menu",
    category: "Menus",
    summary: "Hybrid type-ahead + browse pattern. Single rounded input with a 🔍 icon (left) and a ▾ dropdown arrow (right). Typing filters in place. Clicking the arrow opens a panel below with its own inner search bar and an A-Z ⇄ Z-A sort toggle whose label reads the OPPOSITE of the current state.",
    usage: "Use when the dataset is large enough that typing alone is faster than scrolling, but the user might not know the exact name. Examples: country picker, tag selector, model picker. Don't use for small fixed lists (≤8 items) — use a DDM instead. Selecting a list item fills the trigger input and closes the panel.",
    code: `<SBDMWrapper>
  <SBDMTrigger>
    <SearchIcon />
    <input value={value} onChange={onChange} placeholder="Search…" />
    <ArrowBtn onClick={() => setOpen(o => !o)}>▾</ArrowBtn>
  </SBDMTrigger>

  {open && (
    <SBDMPanel>
      <PanelHeader>
        <input value={inner} onChange={...} placeholder="Search inside…" autoFocus />
        <SortToggle onClick={() => setAsc(a => !a)}>
          {asc ? "Z-A" : "A-Z"} ↕
        </SortToggle>
      </PanelHeader>
      <PanelList>
        {items
          .filter(matches(inner))
          .sort(asc ? az : za)
          .map(item => (
            <PanelItem onClick={() => select(item)}>{item}</PanelItem>
          ))}
      </PanelList>
    </SBDMPanel>
  )}
</SBDMWrapper>`,
    stylePath: "src/app/dashboard/page.tsx",
    Demo: SBDMDemo,
  },
  {
    key: "SRT",
    name: "Sliding Resize Toggle",
    category: "Editor Controls",
    summary: "Editor slider with cyan gradient track + 3D radial-glow thumb. Four pieces: slider, Reset Button (↺), ValueInput (square, tabular numerals, typing moves slider), and ECL at far right. The canonical 3-axis block is Zoom / X-Axis / Y-Axis in that order.",
    usage: "Use resetValue prop or auto-pick (0 if range straddles 0, else 1 if covers 1, else midpoint). ValueInput is controlled — typing updates slider immediately.",
    code: `<SRT
  label="Zoom"
  min={0.5} max={2} step={0.05}
  resetValue={1}
  value={v} onChange={setV}
/>`,
    style: "const SliderTrack = styled.div`\nflex: 1; height: 6px;\nborder-radius: 999px;\nbackground: rgba(255,255,255,0.06);\nposition: relative;\n`;\n\nconst SliderFill = styled.div<{ $pct: number }>`\nheight: 100%;\nborder-radius: 999px;\nbackground: linear-gradient(90deg, rgba(${rgb.cyan}, 0.4), ${colors.cyan});\nwidth: ${(p) => p.$pct}%;\n`;\n\nconst SliderThumb = styled.div`\nwidth: 16px; height: 16px;\nborder-radius: 50%;\nbackground: radial-gradient(circle at 40% 40%, ${colors.cyan}, rgba(${rgb.cyan}, 0.6));\nbox-shadow: 0 0 8px ${colors.cyan};\nposition: absolute;\ntop: -5px;\ncursor: grab;\n`;\n\nconst ValueInput = styled.input`\nwidth: 48px;\ntext-align: center;\nborder-radius: 4px;\nfont-size: 12px;\npadding: 2px 4px;\nbackground: rgba(255,255,255,0.05);\nborder: 1px solid rgba(${rgb.cyan}, 0.35);\ncolor: ${colors.cyan};\nfont-variant-numeric: tabular-nums;\n`;",
    stylePath: "src/app/dashboard/editor/page.tsx",
    Demo: SRTDemo,
  },
  {
    key: "ResetButton",
    name: "Reset Button",
    category: "Editor Controls",
    summary: "20×20 cyan-bordered square with ↺ glyph. Canonical 'back to default' affordance. Sits left of editable value inputs.",
    usage: "Reuse this exact element anywhere an editor control needs a reset affordance. Don't invent a new look.",
    code: `<ResetBtn onClick={() => setValue(defaultValue)}>↺</ResetBtn>

// styled
const ResetBtn = styled.button\`
  width: 20px; height: 20px; border-radius: 4px;
  border: 1px solid rgba(0,228,253,0.25);
  background: rgba(0,228,253,0.08);
  color: rgba(0,228,253,0.95);
  font-size: 12px;
  &:hover { background: rgba(0,228,253,0.2); }
\`;`,
    stylePath: "src/app/dashboard/editor/page.tsx",
    Demo: ResetBtnDemo,
  },
  {
    key: "TSG",
    name: "Tab Switch Group",
    category: "Editor Controls",
    summary: "Horizontal control row at the top of a dashboard tab. Contains: (1) Labels/Icons Lightswitch (toggles text labels vs. SVG icons), (2) Collapse-All Lightswitch (expands/collapses every collapsible section in the tab).",
    usage: "Both switches left-aligned. Tooltip on hover (mouse) or always visible (touch). Add a TSG to every new dashboard tab with collapsible sections.",
    code: `<TSG>
  <Lightswitch on={iconMode} onChange={setIconMode} />
  <Label>Labels / Icons</Label>
  <Lightswitch on={allExpanded} onChange={setAllExpanded} />
  <Label>{allExpanded ? "Collapse all" : "Expand all"}</Label>
</TSG>`,
    stylePath: "src/app/dashboard/page.tsx",
    Demo: TSGDemo,
  },
  {
    key: "LDM",
    name: "Light-Dark Mode Toggle",
    category: "Toggles",
    summary: "Moon/sun icon button that toggles between dark (default) and light themes. On first switch to light, a popup explains dark mode uses less power and is better for the environment, with 'Stay dark', 'Switch anyway', and 'Do not show again' options. Persists choice to localStorage. Theme applied via data-theme attribute on <html>.",
    usage: "Place in the top nav bar next to user controls. Wrap the app with ThemeProvider. Add [data-theme=\"light\"] CSS overrides in globals.css. The accentColor prop lets each project set its own brand accent. Size prop controls the icon button dimensions.",
    code: `// ThemeProvider wraps the app
import ThemeProvider from "./ThemeProvider";
<ThemeProvider>{children}</ThemeProvider>

// LDM in the nav
import LDM from "./LDM";
<LDM size={28} accentColor="#ff4ecb" />

// CSS: [data-theme="light"] body { background: #f8f6f3; color: #1a1a2e; }
// [data-theme="light"] .nav-tgv { ... }`,
    style: "const LDMBtn = styled.button`\nwidth: var(--ldm-size, 28px);\nheight: var(--ldm-size, 28px);\nborder-radius: 50%;\nborder: 1px solid var(--t-border);\nbackground: var(--t-inputBg);\ncolor: var(--t-textMuted);\nfont-size: calc(var(--ldm-size, 28px) * 0.5);\ncursor: pointer;\ndisplay: flex;\nalign-items: center;\njustify-content: center;\ntransition: all 0.2s;\n&:hover {\nborder-color: var(--t-borderStrong);\ncolor: var(--t-text);\n}\n`;\n\nconst Popup = styled.div`\nposition: fixed;\ntop: 50%; left: 50%;\ntransform: translate(-50%, -50%);\nz-index: 9999;\npadding: 1.5rem;\nborder-radius: 1rem;\nbackground: var(--t-surface);\nborder: 1px solid var(--t-border);\nbox-shadow: 0 24px 80px rgba(0,0,0,0.4);\nmax-width: 320px;\ntext-align: center;\n`;",
    stylePath: "src/app/components/LDM.tsx",
    Demo: LDMDemo,
  },
  {
    key: "SB",
    name: "SuggestionBox",
    category: "Navigation",
    summary: "Dashed-border dashboard tile that opens a feature-request modal. Users describe an idea, Claude AI generates a structured implementation plan, GPG paginates responses. A 'Send to admin team' button emails the full conversation via Fastmail JMAP with an 'Implement immediately' CTA that routes to Sandbox staging.",
    usage: "Add as the final dashboard tile. Tile has transparent background with dashed pink border. Modal has three phases: form (name + description), chat (Claude conversation with GPG), sent (confirmation). The API route handles both Claude chat and email sending via action parameter.",
    code: `// Tile (in dashboard page.tsx tiles array)\n{ key: "Suggest", title: "Suggest", subtitle: "Feature ideas",\n  glow: "pink", icon: <span>💡</span>,\n  onClick: () => setSuggestionOpen(true) }\n\n// Special dashed border in tile renderer\nconst isSuggest = tile.key === "Suggest";\nstyle={{ background: isSuggest ? "transparent" : "rgba(...)",\n  border: isSuggest ? "dashed..." : "solid..." }}\n\n// Modal import\nimport SuggestionBoxModal from "./suggestion/SuggestionBoxModal";\n{suggestionOpen && <SuggestionBoxModal onClose={() => setSuggestionOpen(false)} />}`,
    stylePath: "src/app/components/suggestion/SuggestionBoxModal.tsx",
    Demo: SuggestionBoxDemo,
  },
];

export const CATEGORIES: Array<SandboxEntry["category"]> = ["Navigation", "Toggles", "Menus", "Editor Controls"];
